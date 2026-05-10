import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Power, ShieldAlert, Snowflake, Undo2, Zap, AlertTriangle } from "lucide-react";
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
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading power controls…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
          <Power className="h-5 w-5 text-gold" />
        </span>
        <div>
          <h1 className="syndicate-header text-2xl text-foreground">Power Controls</h1>
          <p className="text-sm text-muted-foreground">Master switches for payments and in-app coin movement. Use with care.</p>
        </div>
      </header>

      {/* Toggles */}
      <div className="grid gap-4 md:grid-cols-2">
        <ToggleCard
          title="Payments mode"
          description="When in TEST mode, real charges are paused and Stripe runs against sandbox."
          state={paymentsMode === "live" ? "live" : "frozen"}
          liveLabel="Live"
          frozenLabel="Test (frozen)"
          icon={paymentsMode === "live" ? Zap : Snowflake}
          onToggle={togglePayments}
          saving={savingMode}
        />
        <ToggleCard
          title="In-app coin transactions"
          description="When frozen, coin spend / earn flows that check this flag should refuse new charges."
          state={coinFrozen ? "frozen" : "live"}
          liveLabel="Live"
          frozenLabel="Frozen"
          icon={coinFrozen ? Snowflake : Zap}
          onToggle={toggleCoin}
          saving={savingCoin}
        />
      </div>

      {/* Reverse purchases */}
      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/15 ring-1 ring-destructive/40">
            <Undo2 className="h-4 w-4 text-destructive" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">Freeze & reverse recent purchases</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Refunds coin grants from credit purchases and logs track purchase reversals for the past N minutes.
              Run a dry-run preview before committing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Window (minutes)
            <input
              type="number"
              min={1}
              max={10080}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(e.target.value)}
              className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-muted-foreground flex-1 min-w-[180px]">
            Confirm (type REVERSE)
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="REVERSE"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => runReverse(true)}
              disabled={running || !minutes}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />} Dry run
            </button>
            <button
              type="button"
              onClick={() => runReverse(false)}
              disabled={running || !minutes || confirmText.trim().toUpperCase() !== "REVERSE"}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Reverse now
            </button>
          </div>
        </div>

        {lastResult && (
          <div className="rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-2 text-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-gold" />
              <span className="font-bold">{lastResult.dry_run ? "Dry-run preview" : "Reversal complete"}</span>
              <span>· cutoff {new Date(lastResult.cutoff).toLocaleString()}</span>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Credit purchases" value={lastResult.credit_purchases_reversed} />
              <Stat label="Track purchases" value={lastResult.track_purchases_reversed} />
              <Stat label="Coins refunded" value={lastResult.credits_refunded} />
              <Stat label="Amount (¢)" value={lastResult.amount_cents_affected} />
            </ul>
          </div>
        )}
      </section>

      {/* History */}
      <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-[0.2em]">Recent reversals</h2>
          <span className="text-[11px] text-muted-foreground">{history.length} shown</span>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No reversals yet.</p>
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
                  <tr key={r.id}>
                    <td className="py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 font-mono text-[11px]">{r.source_table}</td>
                    <td className="py-2 font-mono text-[11px] truncate max-w-[140px]" title={r.user_id}>{r.user_id.slice(0,8)}…</td>
                    <td className="py-2 text-right tabular-nums text-gold">-{r.credits_reversed}</td>
                    <td className="py-2 text-right tabular-nums">{(r.amount_cents/100).toFixed(2)} {r.currency.toUpperCase()}</td>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground tabular-nums">{value}</div>
    </li>
  );
}

function ToggleCard({
  title, description, state, liveLabel, frozenLabel, icon: Icon, onToggle, saving,
}: {
  title: string;
  description: string;
  state: "live" | "frozen";
  liveLabel: string;
  frozenLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  onToggle: () => void;
  saving: boolean;
}) {
  const live = state === "live";
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${live ? "border-emerald-500/30 bg-emerald-500/5" : "border-sky-500/30 bg-sky-500/5"}`}>
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${live ? "bg-emerald-500/15 ring-emerald-500/40" : "bg-sky-500/15 ring-sky-500/40"}`}>
          <Icon className={`h-4 w-4 ${live ? "text-emerald-400" : "text-sky-300"}`} />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full ${live ? "bg-emerald-500/20 text-emerald-300" : "bg-sky-500/20 text-sky-300"}`}>
          {live ? liveLabel : frozenLabel}
        </span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
        Switch to {live ? frozenLabel : liveLabel}
      </button>
    </div>
  );
}