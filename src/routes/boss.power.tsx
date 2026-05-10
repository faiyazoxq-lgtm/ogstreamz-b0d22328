import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Power, ShieldAlert, Snowflake, Undo2, Zap, AlertTriangle,
  CreditCard, Coins, Activity, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireBoss } from "@/lib/route-guards";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/boss/power")({
  beforeLoad: requireBoss,
  component: PowerControlsPage,
});

type Reversal = {
  id: string;
  source_table: string;
  source_id: string;
  user_id: string;
  credits_reversed: number;
  amount_cents: number;
  currency: string;
  reason: string | null;
  created_at: string;
};

type ReverseResult = {
  dry_run: boolean;
  window_minutes: number;
  cutoff: string;
  credit_purchases_reversed: number;
  track_purchases_reversed: number;
  credits_refunded: number;
  amount_cents_affected: number;
};

const WINDOW_PRESETS = [5, 15, 60, 240, 1440];

function PowerControlsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [paymentsMode, setPaymentsMode] = useState<"test" | "live">("test");
  const [coinFrozen, setCoinFrozen] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [savingCoin, setSavingCoin] = useState(false);

  const [windowMinutes, setWindowMinutes] = useState<string>("60");
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ReverseResult | null>(null);
  const [history, setHistory] = useState<Reversal[]>([]);

  const refreshHistory = async () => {
    const { data } = await supabase
      .from("purchase_reversals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    setHistory((data ?? []) as Reversal[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: pay }, { data: coin }] = await Promise.all([
        supabase.from("payments_settings").select("mode").eq("id", 1).maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "power.coin_frozen").maybeSingle(),
      ]);
      if (cancelled) return;
      setPaymentsMode((pay?.mode as "test" | "live") ?? "test");
      setCoinFrozen(coin?.value === true);
      await refreshHistory();
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const togglePayments = async () => {
    const next = paymentsMode === "live" ? "test" : "live";
    setSavingMode(true);
    const { error } = await supabase
      .from("payments_settings")
      .update({ mode: next, updated_by: user?.id ?? null })
      .eq("id", 1);
    setSavingMode(false);
    if (error) { toast.error(error.message); return; }
    setPaymentsMode(next);
    toast.success(next === "live" ? "Payments are LIVE" : "Payments frozen — TEST mode");
  };

  const toggleCoin = async () => {
    const next = !coinFrozen;
    setSavingCoin(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "power.coin_frozen", value: next, updated_by: user?.id ?? null }, { onConflict: "key" });
    setSavingCoin(false);
    if (error) { toast.error(error.message); return; }
    setCoinFrozen(next);
    toast.success(next ? "Coin transactions FROZEN" : "Coin transactions LIVE");
  };

  const minutes = useMemo(() => Math.max(0, Math.trunc(Number(windowMinutes) || 0)), [windowMinutes]);

  const runReverse = async (dryRun: boolean) => {
    if (!minutes) { toast.error("Enter a window in minutes"); return; }
    if (!dryRun && confirmText.trim().toUpperCase() !== "REVERSE") {
      toast.error('Type REVERSE to confirm');
      return;
    }
    setRunning(true);
    const { data, error } = await supabase.rpc("reverse_recent_purchases", {
      window_minutes: minutes,
      dry_run: dryRun,
    });
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    const result = data as unknown as ReverseResult;
    setLastResult(result);
    if (dryRun) {
      toast.success(`Preview: would reverse ${result.credit_purchases_reversed + result.track_purchases_reversed} purchase(s)`);
    } else {
      toast.success(`Reversed ${result.credit_purchases_reversed + result.track_purchases_reversed} purchase(s) · refunded ${result.credits_refunded} 🪙`);
      setConfirmText("");
      await refreshHistory();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading power controls…
      </div>
    );
  }

  const paymentsLive = paymentsMode === "live";
  const anyFrozen = !paymentsLive || coinFrozen;

  return (
    <div className="space-y-6">
      {/* Header / status banner */}
      <header className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 via-card/40 to-transparent p-5 shadow-[0_0_60px_-30px_rgba(255,209,102,0.6)]">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40 shrink-0">
            <Power className="h-6 w-6 text-gold" />
          </span>
          <div className="flex-1 min-w-[200px]">
            <h1 className="syndicate-header text-2xl md:text-3xl text-foreground tracking-tight">Power Controls</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Master switches for payments & in-app coin movement. Press a tile to flip its mode.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill
              tone={paymentsLive ? "live" : "test"}
              label={paymentsLive ? "Payments live" : "Payments test"}
            />
            <StatusPill
              tone={coinFrozen ? "frozen" : "live"}
              label={coinFrozen ? "Coins frozen" : "Coins live"}
            />
            {anyFrozen && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 ring-1 ring-amber-500/40">
                <Lock className="h-3 w-3" /> Safe-mode
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Toggle tiles */}
      <div className="grid gap-4 md:grid-cols-2">
        <PowerToggle
          title="Payments mode"
          description="When TEST, real charges are paused and Stripe runs against sandbox keys."
          activeLabel="LIVE"
          inactiveLabel="TEST"
          isActive={paymentsLive}
          activeIcon={Zap}
          inactiveIcon={Snowflake}
          activeTint="emerald"
          inactiveTint="amber"
          onToggle={togglePayments}
          saving={savingMode}
          activeMicro="Charges enabled"
          inactiveMicro="Sandbox only"
        />
        <PowerToggle
          title="Coin transactions"
          description="When frozen, coin spend / earn flows that check this flag refuse new charges."
          activeLabel="LIVE"
          inactiveLabel="FROZEN"
          isActive={!coinFrozen}
          activeIcon={Coins}
          inactiveIcon={Snowflake}
          activeTint="emerald"
          inactiveTint="rose"
          onToggle={toggleCoin}
          saving={savingCoin}
          activeMicro="Earn & spend on"
          inactiveMicro="All flows blocked"
        />
      </div>

      {/* Reverse purchases */}
      <section className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-card/30 to-transparent p-5 space-y-4 shadow-[0_0_60px_-40px_rgba(244,63,94,0.6)]">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 ring-1 ring-rose-500/40">
            <Undo2 className="h-5 w-5 text-rose-300" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-foreground tracking-tight">Reverse recent purchases</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Refund coin grants from credit purchases & log track-purchase reversals for the past N minutes.
              <span className="text-rose-300 font-bold"> Always dry-run first.</span>
            </p>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mr-1">Window</span>
          {WINDOW_PRESETS.map((m) => {
            const active = minutes === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setWindowMinutes(String(m))}
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tabular-nums transition-all active:scale-[0.96]",
                  active
                    ? "bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/60 shadow-[0_0_20px_-6px_rgba(244,63,94,0.7)]"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-border",
                ].join(" ")}
              >
                {m < 60 ? `${m}m` : m < 1440 ? `${m / 60}h` : `${m / 1440}d`}
              </button>
            );
          })}
          <input
            type="number"
            min={1}
            max={10080}
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(e.target.value)}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground tabular-nums"
            aria-label="Custom window in minutes"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold flex-1 min-w-[200px]">
            Confirm — type <span className="text-rose-300">REVERSE</span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="REVERSE"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono tracking-widest"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => runReverse(true)}
              disabled={running || !minutes}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-4 py-2.5 text-xs font-bold text-foreground hover:bg-secondary/80 disabled:opacity-50 active:scale-[0.97] transition-all"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />} Dry run
            </button>
            <button
              type="button"
              onClick={() => runReverse(false)}
              disabled={running || !minutes || confirmText.trim().toUpperCase() !== "REVERSE"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/60 bg-rose-500/20 px-4 py-2.5 text-xs font-extrabold text-rose-200 hover:bg-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all shadow-[0_0_20px_-8px_rgba(244,63,94,0.8)]"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Reverse now
            </button>
          </div>
        </div>

        {lastResult && (
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-foreground text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-gold" />
              <span className="font-extrabold uppercase tracking-[0.2em]">
                {lastResult.dry_run ? "Dry-run preview" : "Reversal complete"}
              </span>
              <span className="text-muted-foreground">· cutoff {new Date(lastResult.cutoff).toLocaleString()}</span>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Credit purchases" value={lastResult.credit_purchases_reversed} icon={CreditCard} />
              <Stat label="Track purchases" value={lastResult.track_purchases_reversed} icon={Activity} />
              <Stat label="Coins refunded" value={lastResult.credits_refunded} icon={Coins} />
              <Stat label="Amount (¢)" value={lastResult.amount_cents_affected} icon={CreditCard} />
            </ul>
          </div>
        )}
      </section>

      {/* History */}
      <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-[0.2em]">Recent reversals</h2>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground tabular-nums">
            {history.length} shown
          </span>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No reversals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="text-left py-2">When</th>
                  <th className="text-left py-2">Source</th>
                  <th className="text-left py-2">User</th>
                  <th className="text-right py-2">Coins</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 font-mono text-[11px]">{r.source_table}</td>
                    <td className="py-2 font-mono text-[11px] truncate max-w-[140px]" title={r.user_id}>{r.user_id.slice(0, 8)}…</td>
                    <td className="py-2 text-right tabular-nums text-gold font-bold">-{r.credits_reversed}</td>
                    <td className="py-2 text-right tabular-nums">{(r.amount_cents / 100).toFixed(2)} {r.currency.toUpperCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label, value, icon: Icon,
}: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <li className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-base font-extrabold text-foreground tabular-nums mt-0.5">{value}</div>
    </li>
  );
}

type Tint = "emerald" | "amber" | "rose";
const TINT: Record<Tint, { ring: string; bg: string; text: string; pillBg: string; pillText: string; glow: string }> = {
  emerald: {
    ring: "ring-emerald-400/60",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    pillBg: "bg-emerald-500/25",
    pillText: "text-emerald-200",
    glow: "shadow-[0_0_50px_-20px_rgba(16,185,129,0.55)]",
  },
  amber: {
    ring: "ring-amber-400/60",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    pillBg: "bg-amber-500/25",
    pillText: "text-amber-200",
    glow: "shadow-[0_0_50px_-20px_rgba(245,158,11,0.55)]",
  },
  rose: {
    ring: "ring-rose-400/60",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
    pillBg: "bg-rose-500/25",
    pillText: "text-rose-200",
    glow: "shadow-[0_0_50px_-20px_rgba(244,63,94,0.55)]",
  },
};

function PowerToggle({
  title, description, activeLabel, inactiveLabel, isActive,
  activeIcon: ActiveIcon, inactiveIcon: InactiveIcon,
  activeTint, inactiveTint, onToggle, saving,
  activeMicro, inactiveMicro,
}: {
  title: string;
  description: string;
  activeLabel: string;
  inactiveLabel: string;
  isActive: boolean;
  activeIcon: React.ComponentType<{ className?: string }>;
  inactiveIcon: React.ComponentType<{ className?: string }>;
  activeTint: Tint;
  inactiveTint: Tint;
  onToggle: () => void;
  saving: boolean;
  activeMicro: string;
  inactiveMicro: string;
}) {
  const t = TINT[isActive ? activeTint : inactiveTint];
  const Icon = isActive ? ActiveIcon : InactiveIcon;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      aria-pressed={isActive}
      className={[
        "group relative w-full text-left rounded-2xl border p-5 transition-all overflow-hidden",
        "active:scale-[0.985] disabled:opacity-70 disabled:cursor-wait",
        "bg-gradient-to-br from-card/80 to-card/30",
        t.ring.replace("ring-", "border-"),
        t.glow,
      ].join(" ")}
    >
      {/* status pill */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${t.bg} ${t.ring}`}>
            <Icon className={`h-5 w-5 ${t.text}`} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-foreground tracking-tight leading-tight">{title}</h3>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mt-0.5">
              {isActive ? activeMicro : inactiveMicro}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] ${t.pillBg} ${t.pillText} ring-1 ${t.ring}`}
        >
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${t.text.replace("text-", "bg-")}`}>
            <span className={`absolute inset-0 rounded-full ${t.text.replace("text-", "bg-")} animate-ping opacity-75`} />
          </span>
          {isActive ? activeLabel : inactiveLabel}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>

      {/* switch */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
          {saving ? "Saving…" : "Tap to toggle"}
        </span>
        <span
          className={[
            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors",
            isActive ? `${t.pillBg} ring-1 ${t.ring}` : "bg-secondary ring-1 ring-border",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-5 w-5 transform rounded-full bg-foreground shadow transition-transform",
              isActive ? "translate-x-8" : "translate-x-1",
            ].join(" ")}
          />
        </span>
      </div>
    </button>
  );
}

function StatusPill({ tone, label }: { tone: "live" | "test" | "frozen"; label: string }) {
  const map = {
    live: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/50",
    test: "bg-amber-500/20 text-amber-200 ring-amber-400/50",
    frozen: "bg-rose-500/20 text-rose-200 ring-rose-400/50",
  };
  const dot = {
    live: "bg-emerald-300",
    test: "bg-amber-300",
    frozen: "bg-rose-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] ring-1 ${map[tone]}`}>
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot[tone]}`}>
        <span className={`absolute inset-0 rounded-full ${dot[tone]} animate-ping opacity-75`} />
      </span>
      {label}
    </span>
  );
}