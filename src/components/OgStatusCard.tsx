import { useEffect, useMemo, useState } from "react";
import { Crown, RefreshCw, ShieldCheck, Tv, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { reverifyStream } from "@/lib/stream-link.functions";
import { toast } from "sonner";

type ActivePass = {
  id: string;
  source: string | null;
  notes: string | null;
  expires_at: string;
  revoked_at: string | null;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

function timeLeft(iso: string | null | undefined): { label: string; tone: "ok" | "warn" | "crit" | "dead" } {
  if (!iso) return { label: "—", tone: "dead" };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Expired", tone: "dead" };
  const days = ms / 86_400_000;
  if (days >= 365 * 10) return { label: "Lifetime", tone: "ok" };
  if (days >= 30) return { label: `${Math.floor(days)}d left`, tone: "ok" };
  if (days >= 7) return { label: `${Math.floor(days)}d left`, tone: "warn" };
  if (days >= 1) return { label: `${Math.floor(days)}d left`, tone: "crit" };
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return { label: `${hours}h left`, tone: "crit" };
}

const TONE: Record<"ok" | "warn" | "crit" | "dead", string> = {
  ok:   "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  crit: "border-rose-400/50 bg-rose-500/10 text-rose-300",
  dead: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
};

export function OgStatusCard() {
  const { user, profile, refresh } = useAuth();
  const reverify = useServerFn(reverifyStream);
  const [busy, setBusy] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [passes, setPasses] = useState<ActivePass[]>([]);
  const [loadingPasses, setLoadingPasses] = useState(false);

  const isBoss = profile?.rank === "boss";
  const isVip = profile?.status === "vip";
  const isRealOg = (profile as any)?.feature_flags?.real_og === true;

  const loadPasses = async () => {
    if (!user) return;
    setLoadingPasses(true);
    try {
      const { data } = await supabase
        .from("vip_passes")
        .select("id,source,notes,expires_at,revoked_at")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false });
      setPasses((data as ActivePass[] | null) ?? []);
    } finally {
      setLoadingPasses(false);
    }
  };

  useEffect(() => { loadPasses(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const topPass = passes[0] ?? null;
  const vipExpiry = topPass?.expires_at ?? null;
  const vipTime = useMemo(() => timeLeft(vipExpiry), [vipExpiry]);
  const streamTime = useMemo(() => timeLeft(profile?.stream_expires_at ?? null), [profile?.stream_expires_at]);

  const checkNow = async () => {
    if (!user || busy) return;
    setBusy(true);
    const t = toast.loading("Re-checking OG status…");
    try {
      // Re-probe IPTV provider for fresh stream state (best-effort).
      try {
        await reverify({ data: {} });
      } catch { /* non-fatal — provider may be unreachable */ }
      // Reload profile + role flags.
      await refresh();
      // Reload active VIP passes.
      await loadPasses();
      setLastChecked(new Date());
      toast.success("OG status refreshed", { id: t });
    } catch (e: any) {
      toast.error(e?.message ?? "Re-check failed", { id: t });
    } finally {
      setBusy(false);
    }
  };

  const vipLabel = isBoss ? "Boss · Sovereign" : isRealOg ? "Real OG · Lifetime" : isVip ? "VIP · Active" : "Free";
  const vipTone: "ok" | "warn" | "crit" | "dead" =
    isBoss || isRealOg ? "ok" : isVip ? vipTime.tone : "dead";

  const streamStatus = (profile?.stream_status ?? "Not linked").toString();
  const streamTone: "ok" | "warn" | "crit" | "dead" =
    !profile?.stream_status ? "dead"
      : /active/i.test(streamStatus) ? streamTime.tone
      : /pending/i.test(streamStatus) ? "warn"
      : "crit";

  return (
    <section className="rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-[0.3em] font-bold">
            <ShieldCheck className="h-3.5 w-3.5" />
            OG Status
          </div>
          <h2 className="mt-2 font-[Montserrat] font-black text-2xl text-metallic">
            Membership Snapshot
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {lastChecked
              ? <>Last checked {fmtDate(lastChecked.toISOString())}</>
              : <>Tap <strong className="text-white">Check OG Status</strong> to re-fetch JT data and re-tag your profile.</>}
          </p>
        </div>
        <Button
          onClick={checkNow}
          disabled={busy}
          className="btn-glass-blue h-10 px-5 text-[11px] uppercase tracking-[0.25em] font-bold text-white"
          aria-label="Manually re-check OG status"
        >
          <RefreshCw className={"h-4 w-4 mr-2 " + (busy ? "animate-spin" : "")} />
          {busy ? "Checking…" : "Check OG Status"}
        </Button>
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        {/* VIP panel */}
        <div className={"rounded-xl border p-4 " + TONE[vipTone]}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold opacity-90">
              <Crown className="h-3.5 w-3.5" />
              VIP Status
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-full bg-black/30">
              {isBoss || isRealOg ? "Lifetime" : isVip ? vipTime.label : "None"}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="font-[Montserrat] font-black text-xl text-white">{vipLabel}</span>
            {(isVip || isBoss) && <Sparkles className="h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />}
          </div>
          <div className="mt-2 text-[11px] opacity-80 space-y-0.5">
            {isBoss
              ? <div>All systems unlocked.</div>
              : isRealOg
                ? <div>Real OG Pass active — never expires.</div>
                : isVip && vipExpiry
                  ? <div>Renews / expires {fmtDate(vipExpiry)}</div>
                  : <div>No active VIP pass on file.</div>}
            {!isBoss && !isRealOg && passes.length > 1 && (
              <div className="opacity-70">+{passes.length - 1} other active pass{passes.length - 1 === 1 ? "" : "es"}</div>
            )}
            {loadingPasses && <div className="opacity-60">Loading passes…</div>}
          </div>
        </div>

        {/* Stream subscription panel */}
        <div className={"rounded-xl border p-4 " + TONE[streamTone]}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold opacity-90">
              <Tv className="h-3.5 w-3.5" />
              Stream Subscription
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-full bg-black/30">
              {profile?.stream_status ? streamTime.label : "None"}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="font-[Montserrat] font-black text-xl text-white capitalize">{streamStatus}</span>
            {streamTone === "crit" && <AlertTriangle className="h-4 w-4 text-rose-300" />}
          </div>
          <div className="mt-2 text-[11px] opacity-80 space-y-0.5">
            {profile?.stream_expires_at
              ? <div>Expires {fmtDate(profile.stream_expires_at)}</div>
              : <div>No stream profile linked yet.</div>}
            {profile?.stream_auto_checked_at && (
              <div className="opacity-70">Auto-checked {fmtDate(profile.stream_auto_checked_at)}</div>
            )}
            {profile?.stream_boss_verified_at && (
              <div className="opacity-70">Boss-verified {fmtDate(profile.stream_boss_verified_at)}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default OgStatusCard;