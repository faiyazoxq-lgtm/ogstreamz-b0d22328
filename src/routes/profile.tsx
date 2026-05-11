import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Coins, LogOut, Shield, Sparkles, Zap, Flame, Skull, Settings, Heart, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { FlameBackdrop } from "@/components/FlameBackdrop";
import { CREDIT_PACK_LIST } from "@/lib/credit-packs";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useServerFn } from "@tanstack/react-start";
import { requestTopup, listMyTopupRequests } from "@/lib/topup-requests.functions";
import { checkIsBoss } from "@/lib/boss.functions";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RealOgBadge } from "@/components/RealOgBadge";
import { StreamLinkCard } from "@/components/StreamLinkCard";
import { CoinActivity } from "@/components/CoinActivity";
import { OgStatusCard } from "@/components/OgStatusCard";

import { requireMember } from "@/lib/route-guards";
export const Route = createFileRoute("/profile")({
  beforeLoad: requireMember,
  head: () => ({
    meta: [
      { title: "Vault · 0G-PORTAL" },
      { name: "description", content: "Your 0G-PORTAL membership vault." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const checkBoss = useServerFn(checkIsBoss);
  const { data: bossCheck } = useQuery({
    queryKey: ["check-is-boss", user?.id],
    queryFn: () => checkBoss(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const verifiedBoss = bossCheck?.isBoss === true;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Loading vault…</main>;
  }

  const isVip = profile?.status === "vip";
  const isBoss = profile?.rank === "boss";
  const isFriendsFamily =
    isBoss || ((profile as any)?.feature_flags?.friends_family === true);
  const credits = profile?.credits ?? 0;
  // Cap visual scale: full bar at 100 credits.
  const creditPct = Math.max(2, Math.min(100, (credits / 100) * 100));

  const buy = (priceId: string) => {
    if (!user) return;
    openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <main className="relative min-h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <FlameBackdrop className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
      </div>

      <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <header className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
            Member Vault
          </p>
          <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-5xl text-metallic">
            Welcome back
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">{isBoss ? "— BOSS ACCOUNT —" : (profile?.email ?? user.email)}</p>
          {verifiedBoss && (
            <div className="mt-4 flex justify-center">
              <span
                role="status"
                aria-label="Verified Boss account"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)] bg-[color-mix(in_oklab,var(--gold)_12%,transparent)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--gold)] shadow-[0_0_24px_-6px_var(--electric-gold-glow)]"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verified Boss
              </span>
            </div>
          )}
          {isVip && !isBoss && (
            <div className="mt-4 flex justify-center">
              <RealOgBadge variant="badge" size="lg" />
            </div>
          )}
        </header>

        {/* Real 0G status tag */}
        <section className="mb-8 flex justify-center">
          <RealOgBadge variant="badge" size="lg" />
        </section>

        <section className="grid sm:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8 animate-pulse-gold">
            <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em]">
              {isVip ? <Crown className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              Access Level
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-[Montserrat] font-black text-4xl sm:text-5xl text-metallic">
                {isBoss ? "BOSS" : isVip ? "VIP" : "Free"}
              </span>
              {isVip && <Sparkles className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />}
            </div>
            {isVip && !isBoss && (
              <div className="mt-3">
                <RealOgBadge size="sm" />
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              {isBoss ? "Sovereign access. All systems unlocked." : isVip ? "All vaults unlocked. Premium frequencies active." : "Unlock VIP for premium tracks and tools."}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em]">
              <Coins className="h-4 w-4" />
              Credit Balance
            </div>
            <div className="mt-4">
              <span className="digital-display inline-block px-5 py-3 text-4xl sm:text-5xl">
                {isBoss ? "∞" : credits}
              </span>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-secondary/60 overflow-hidden border border-[oklch(0.72_0.22_245/0.3)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[oklch(0.55_0.24_255)] via-[var(--neon-blue-bright)] to-[oklch(0.85_0.18_235)] shadow-[0_0_18px_oklch(0.72_0.22_245/0.9)] transition-all"
                style={{ width: `${isBoss ? 100 : creditPct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{isBoss ? "Unlimited reserve. No caps." : "Spend credits to unlock single VIP items."}</p>
          </div>
        </section>

        {/* Buy Credits */}
        <section className="mt-12">
          <header className="text-center mb-6">
            <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
              Vault Wallet
            </p>
            <h2 className="mt-3 font-[Montserrat] font-black text-2xl sm:text-3xl text-metallic">
              Buy 0G Credits
            </h2>
          </header>
        </section>

        {/* Stream Account Link */}
        <section className="mt-10">
          <StreamLinkCard />
        </section>

        {/* Recent coin activity — gifts, top-ups, spends */}
        <section className="mt-10">
          <CoinActivity limit={8} />
        </section>

        <section className="mt-12">
          <div className="grid sm:grid-cols-3 gap-4">
            {CREDIT_PACK_LIST.map((p) => {
              const Icon = p.priceId === "starter_pack_10" ? Zap : p.priceId === "enforcer_pack_50" ? Flame : Skull;
              const featured = p.recurring;
              return (
                <div
                  key={p.priceId}
                  className={
                    "relative rounded-2xl p-6 bg-card border " +
                    (featured
                      ? "border-[oklch(0.72_0.22_245/0.7)] shadow-[0_0_40px_-10px_oklch(0.72_0.22_245/0.8)]"
                      : "border-border")
                  }
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full bg-[var(--neon-blue-bright)] text-black">
                      VIP
                    </span>
                  )}
                  <Icon className="h-6 w-6" style={{ color: "var(--neon-blue-bright)" }} />
                  <h3 className="mt-4 font-[Montserrat] font-black text-xl text-white">{p.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
                  <p className="mt-4 font-[Montserrat] font-black text-3xl text-metallic">
                    £{(p.amountCents / 100).toFixed(2)} <span className="text-base text-yellow-300">({Math.round(p.amountCents / 100)} 🪙)</span>
                    {p.recurring && <span className="text-sm text-muted-foreground font-normal">/mo</span>}
                  </p>
                  <Button
                    onClick={() => buy(p.priceId)}
                    className="btn-glass-blue mt-5 w-full text-white text-xs uppercase tracking-[0.25em] font-bold py-5"
                  >
                    {p.recurring ? "Go Boss" : "Top Up"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/settings"
            className="btn-glass-blue inline-flex items-center gap-2 px-6 py-3 rounded-md text-xs uppercase tracking-[0.25em] font-bold text-white"
          >
            <Settings className="h-4 w-4" />
            Account Settings
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="btn-glass-blue inline-flex items-center gap-2 px-6 py-3 rounded-md text-xs uppercase tracking-[0.25em] font-bold text-white"
            >
              <Shield className="h-4 w-4" />
              Admin Console
            </Link>
          )}
          <Button onClick={signOut} variant="outline" className="h-11 px-6 uppercase tracking-[0.25em] text-xs font-bold">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </section>

        {isFriendsFamily && <FriendsFamilyTopUp />}

        {isOpen && (
          <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-8">
              <button
                onClick={closeCheckout}
                className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white mb-4"
              >
                ← Back to Vault
              </button>
              {checkoutElement}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function FriendsFamilyTopUp() {
  const askFn = useServerFn(requestTopup);
  const listFn = useServerFn(listMyTopupRequests);
  const [credits, setCredits] = useState(20);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const refresh = async () => {
    try {
      const r = await listFn();
      setHistory((r as any).requests);
    } catch (e: any) {
      // ignore
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await askFn({ data: { credits, reason } });
      toast.success("Request sent — boss will review.");
      setReason("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pending = history.find((h) => h.status === "pending");

  return (
    <section className="mt-12 max-w-2xl mx-auto">
      <div className="rounded-2xl border border-rose-400/30 bg-card p-6 sm:p-8">
        <div className="flex items-center gap-2 text-rose-300">
          <Heart className="h-4 w-4" />
          <span className="text-xs uppercase tracking-[0.3em] font-bold">
            Friends &amp; Family · Free Top-Up
          </span>
        </div>
        <h2 className="mt-3 font-[Montserrat] font-black text-2xl text-white">
          Need more credits? Just ask.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You're on the inside. Submit a request and the boss will approve it.
        </p>

        {pending ? (
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-amber-400 font-bold">
              Pending
            </div>
            <div className="mt-2 text-sm">
              Requested <strong>{pending.credits_requested}</strong> credits
              {pending.reason && <> · "{pending.reason}"</>}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Submitted {new Date(pending.created_at).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="mt-5 grid sm:grid-cols-[140px_1fr_auto] gap-3 items-start">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Credits
              </label>
              <Input
                type="number"
                min={1}
                max={500}
                value={credits}
                onChange={(e) => setCredits(Math.max(1, Math.min(500, Number(e.target.value))))}
                className="bg-background/60 mt-1 text-center font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Reason (optional)
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                placeholder="What you need them for…"
                className="bg-background/60 mt-1 min-h-[44px]"
              />
            </div>
            <Button
              onClick={submit}
              disabled={busy}
              className="btn-glass-blue text-xs uppercase tracking-[0.25em] font-bold text-white sm:mt-5 py-5"
            >
              <Send className="h-4 w-4 mr-1" /> Request
            </Button>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Recent requests
            </div>
            {history.slice(0, 5).map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-background/40 border border-white/5 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Coins className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                  <span className="font-mono">
                    {h.credits_granted ?? h.credits_requested}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {h.reason ? `· "${h.reason}"` : ""}
                  </span>
                </div>
                <span
                  className={
                    "text-[10px] uppercase tracking-[0.2em] font-bold " +
                    (h.status === "pending"
                      ? "text-amber-400"
                      : h.status === "approved"
                      ? "text-emerald-400"
                      : "text-rose-400")
                  }
                >
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}