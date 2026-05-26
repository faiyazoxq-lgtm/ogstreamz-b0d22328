import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Plus, Loader2, ArrowDownRight, ArrowUpRight, Gift, Sparkles, Crown, Infinity as InfinityIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { isBossProfile } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * MusicHUB live coin balance.
 *
 * Subscribes to the signed-in user's `profiles` row and `credit_ledger`
 * inserts so the displayed balance updates the instant a portal is spawned,
 * an item is unlocked, or the boss gifts coins. Shows a brief delta chip
 * (e.g. "−1 🪙") whenever the value changes.
 */
export function MusicHubBalance({ className }: { className?: string }) {
  const { user, profile, loading, hasStoredSession, refresh } = useAuth();
  const isBoss = isBossProfile(profile);

  const [liveCredits, setLiveCredits] = useState<number | null>(null);
  const [delta, setDelta] = useState<{ value: number; reason: string | null; key: number } | null>(null);
  const prevRef = useRef<number | null>(null);

  // Reset live state on user switch
  useEffect(() => {
    setLiveCredits(null);
    prevRef.current = null;
  }, [user?.id]);

  // Sync from auth-loaded profile
  useEffect(() => {
    if (profile && liveCredits === null) {
      setLiveCredits(profile.credits ?? 0);
      prevRef.current = profile.credits ?? 0;
    }
  }, [profile, liveCredits]);

  // profiles + credit_ledger were removed from the realtime publication for
  // security (broadcast was visible to any signed-in subscriber). We now
  // poll the user's own balance + most recent ledger entry every 6s — RLS
  // still scopes both reads to the signed-in user.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let lastLedgerId: string | null = null;

    const tick = async () => {
      const [{ data: prof }, { data: ledger }] = await Promise.all([
        supabase.from("profiles").select("credits").eq("id", user.id).maybeSingle(),
        supabase
          .from("credit_ledger")
          .select("id, delta, reason")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const next = typeof prof?.credits === "number" ? prof.credits : null;
      if (next !== null) {
        const prev = prevRef.current;
        setLiveCredits(next);
        if (prev !== null && next !== prev) {
          setDelta((d) => ({ value: next - prev, reason: d?.reason ?? null, key: Date.now() }));
        }
        prevRef.current = next;
      }
      const row = ledger as { id?: string; delta?: number; reason?: string } | null;
      if (row?.id && row.id !== lastLedgerId && typeof row.delta === "number") {
        if (lastLedgerId !== null) {
          setDelta({ value: row.delta, reason: row.reason ?? null, key: Date.now() });
          refresh().catch(() => {});
        }
        lastLedgerId = row.id;
      }
    };

    tick();
    const interval = setInterval(tick, 6_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, refresh]);

  // Auto-clear the delta chip after a few seconds
  useEffect(() => {
    if (!delta) return;
    const t = setTimeout(() => setDelta(null), 4000);
    return () => clearTimeout(t);
  }, [delta]);

  if (!user && (loading || hasStoredSession)) {
    return (
      <div
        className={[
          "rounded-3xl border border-gold/30 bg-gradient-to-r from-gold/10 to-transparent p-5 flex items-center gap-3",
          className ?? "",
        ].join(" ")}
      >
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
        <span className="text-sm text-muted-foreground">Loading your coin balance…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={[
          "rounded-3xl border border-border bg-card p-5 flex flex-wrap items-center gap-3",
          className ?? "",
        ].join(" ")}
      >
        <Coins className="h-6 w-6 text-gold" />
        <span className="text-sm text-muted-foreground">
          Sign in to track your 🪙 in real time.
        </span>
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  // Boss has unlimited credits — show a status card, never a balance.
  if (isBoss) {
    return (
      <div
        className={[
          "relative overflow-hidden rounded-3xl border border-pink-400/40 bg-gradient-to-br from-pink-500/15 via-fuchsia-500/10 to-transparent p-5 flex flex-wrap items-center gap-4",
          className ?? "",
        ].join(" ")}
        aria-label="Boss — unlimited credits"
      >
        <div className="rounded-full bg-pink-500/20 border border-pink-400/50 p-3">
          <Crown className="h-6 w-6 text-pink-300" />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-semibold">
            Boss access
          </div>
          <div className="font-[Montserrat] font-black text-3xl text-foreground tracking-tight inline-flex items-center gap-2">
            <InfinityIcon className="h-7 w-7 text-pink-300" />
            Unlimited
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            No coin balance — every spawn, unlock & joke is on the house.
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="ml-auto border-pink-400/40 text-pink-200 hover:bg-pink-500/10">
          <Link to="/boss/members" hash="roster">Manage credits</Link>
        </Button>
      </div>
    );
  }

  const credits = liveCredits ?? profile?.credits ?? 0;
  const low = credits <= 1;
  const positive = (delta?.value ?? 0) > 0;

  const reasonLabel = (() => {
    const r = delta?.reason ?? "";
    if (!r) return null;
    if (r.startsWith("boss:gift")) return "Gifted by Boss";
    if (r.startsWith("boss:adjust")) return "Boss adjustment";
    if (r.startsWith("redeem:")) return "Code redeemed";
    if (r.startsWith("topup")) return "Top-up";
    if (r.startsWith("purchase:")) return `Spent on ${r.slice("purchase:".length).replace(/_/g, " ")}`;
    if (r.startsWith("portal:") || r === "portal_spawn") return "Portal spawn";
    if (r === "track_unlock") return "Track unlocked";
    if (r === "joke_play") return "Joke played";
    return r.replace(/_/g, " ");
  })();

  return (
    <div
      className={[
        "relative overflow-hidden rounded-3xl border p-5 flex flex-wrap items-center gap-4 transition-colors",
        low
          ? "border-destructive/50 bg-destructive/5"
          : "border-gold/50 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent shadow-[0_0_60px_oklch(0.82_0.16_88_/_0.12)]",
        className ?? "",
      ].join(" ")}
      aria-live="polite"
      aria-label={`Coin balance: ${credits} coins`}
    >
      {/* subtle pulse on the gold gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.82_0.16_88_/_0.18),transparent_60%)]" />

      <div className="relative flex items-center gap-3">
        <div className="rounded-full bg-gold/20 border border-gold/50 p-3">
          <Coins className="h-6 w-6 text-gold" />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-semibold">
            Coin balance · live
          </div>
          <div
            key={credits}
            className="font-[Montserrat] font-black text-4xl text-foreground tracking-tight animate-fade-in"
          >
            {credits.toLocaleString()}
            <span className="text-base font-bold text-gold ml-1.5 align-middle">🪙</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-gold" /> Updates instantly as you spawn or unlock
          </div>
        </div>
      </div>

      {delta && delta.value !== 0 && (
        <div
          key={delta.key}
          className={[
            "relative ml-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold animate-fade-in",
            positive
              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
              : "border-amber-400/60 bg-amber-500/15 text-amber-200",
          ].join(" ")}
          aria-live="polite"
        >
          {positive ? (
            reasonLabel === "Gifted by Boss" ? <Gift className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {positive ? "+" : ""}
          {delta.value} 🪙
          {reasonLabel && <span className="opacity-80 font-medium">· {reasonLabel}</span>}
        </div>
      )}

      <div className="relative ml-auto flex items-center gap-2">
        {low && (
          <span className="text-[10px] uppercase tracking-[0.25em] text-destructive font-semibold">
            Low — top up to keep spawning
          </span>
        )}
        <Button asChild size="sm" variant={low ? "default" : "outline"} className="font-semibold">
          <Link to="/store">
            <Plus className="h-3.5 w-3.5 mr-1" /> Buy 🪙
          </Link>
        </Button>
      </div>
    </div>
  );
}