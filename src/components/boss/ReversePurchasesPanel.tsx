import { useEffect, useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CollapsiblePanel } from "@/components/boss/CollapsiblePanel";
import { toast } from "sonner";

type Reversal = {
  id: string; source_table: string; source_id: string; user_id: string;
  credits_reversed: number; amount_cents: number; currency: string;
  reason: string | null; created_at: string;
};
type ReverseResult = {
  dry_run: boolean; window_minutes: number; cutoff: string;
  credit_purchases_reversed: number; track_purchases_reversed: number;
  credits_refunded: number; amount_cents_affected: number;
};

const WINDOW_PRESETS = [5, 15, 60, 240, 1440];

/**
 * Canonical reverse-recent-purchases tool + recent reversal history.
 * Mounted on /boss/overview as the single source of truth.
 */
export function ReversePurchasesPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [windowMinutes, setWindowMinutes] = useState<string>("60");
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ReverseResult | null>(null);
  const [history, setHistory] = useState<Reversal[]>([]);
  const minutes = useMemo(
    () => Math.max(0, Math.trunc(Number(windowMinutes) || 0)),
    [windowMinutes],
  );

  async function loadHistory() {
    const { data } = await supabase
      .from("purchase_reversals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15);
    setHistory((data ?? []) as Reversal[]);
  }

  useEffect(() => {
    void loadHistory();
    const t = setInterval(loadHistory, 60_000);
    return () => clearInterval(t);
  }, []);

  async function runReverse(dryRun: boolean) {
    if (!minutes) { toast.error("Enter a window in minutes"); return; }
    if (!dryRun && confirmText.trim().toUpperCase() !== "REVERSE") {
      toast.error('Type REVERSE to confirm'); return;
    }
    setRunning(true);
    const { data, error } = await supabase.rpc("reverse_recent_purchases", {
      window_minutes: minutes, dry_run: dryRun,
    });
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    const result = data as unknown as ReverseResult;
    setLastResult(result);
    if (dryRun) {
      toast.success(`Preview: would reverse ${result.credit_purchases_reversed + result.track_purchases_reversed} purchase(s)`);
    } else {
      toast.success(`Reversed ${result.credit_purchases_reversed + result.track_purchases_reversed} purchase(s)`);
      setConfirmText("");
      void loadHistory();
    }
  }

  return (
    <div id="reverse">
      <CollapsiblePanel
        id="pwr.reverse"
        title="Reverse Recent Purchases"
        Icon={Undo2}
        tint="#ff5577"
        defaultOpen={defaultOpen}
        subtitle="Refund credit purchases & log track reversals — always dry-run first"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-200 ring-1 ring-rose-400/40">
            destructive
          </span>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55 font-bold mr-1">Window</span>
            {WINDOW_PRESETS.map((m) => {
              const active = minutes === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWindowMinutes(String(m))}
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tabular-nums transition active:scale-[0.96]",
                    active
                      ? "bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/60 shadow-[0_0_18px_-6px_rgba(244,63,94,0.7)]"
                      : "bg-white/5 text-white/55 hover:text-white/90 ring-1 ring-white/10",
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
              className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/90 tabular-nums"
              aria-label="Custom window in minutes"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55 font-bold">
              Type REVERSE to arm
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="REVERSE"
                className="w-44 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm font-bold tracking-widest text-rose-200 placeholder:text-white/20"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => runReverse(true)}
                disabled={running}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-white/90 hover:bg-white/10 disabled:opacity-50"
              >
                Dry-run preview
              </button>
              <button
                type="button"
                onClick={() => runReverse(false)}
                disabled={running || confirmText.trim().toUpperCase() !== "REVERSE"}
                className="rounded-md bg-rose-500/90 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Execute reverse
              </button>
            </div>
          </div>

          {lastResult && (
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] terminal-mono text-white/45 font-bold">Credit purchases</div>
                <div className="text-sm font-extrabold text-white/95 tabular-nums mt-0.5">{lastResult.credit_purchases_reversed}</div>
              </li>
              <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] terminal-mono text-white/45 font-bold">Track purchases</div>
                <div className="text-sm font-extrabold text-white/95 tabular-nums mt-0.5">{lastResult.track_purchases_reversed}</div>
              </li>
              <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] terminal-mono text-white/45 font-bold">Credits refunded</div>
                <div className="text-sm font-extrabold text-white/95 tabular-nums mt-0.5">{lastResult.credits_refunded}</div>
              </li>
              <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] terminal-mono text-white/45 font-bold">Cents affected</div>
                <div className="text-sm font-extrabold text-white/95 tabular-nums mt-0.5">{lastResult.amount_cents_affected}</div>
              </li>
            </ul>
          )}

          {history.length > 0 && (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <div className="px-3 py-2 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55 font-bold bg-white/5">
                Recent reversals
              </div>
              <ul className="divide-y divide-white/5">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white/85 truncate">{h.source_table} · {h.source_id.slice(0, 8)}</div>
                      <div className="text-white/45 text-[10px]">{new Date(h.created_at).toLocaleString("en-GB")}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-rose-200 font-extrabold">−{h.credits_reversed}c</div>
                      <div className="text-white/45 text-[10px]">{h.amount_cents}{h.currency}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
}