import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Crown, Loader2, Calculator, TrendingDown, Wallet } from "lucide-react";
import { peekPortalDownload, type DownloadPeek } from "@/lib/portal-downloads.functions";

type Props = {
  /** Portal the action belongs to (used for VIP-pass scoping). */
  portalId: string;
  /** Credits the action will cost if paid (default 2). */
  cost?: number;
  /** Friendly action name shown in the breakdown ("Download track"). */
  actionLabel?: string;
  /** Hide the panel entirely when no action is selected. */
  enabled?: boolean;
  className?: string;
};

/**
 * Inline live cost estimate for the user's currently selected action.
 * Pulls fresh balance + VIP-pass status from the server and projects the
 * resulting balance, applied passes, and subscription savings in coins 🪙.
 */
export function CostEstimatePanel({
  portalId,
  cost = 2,
  actionLabel = "this action",
  enabled = true,
  className = "",
}: Props) {
  const peek = useServerFn(peekPortalDownload);
  const [info, setInfo] = useState<DownloadPeek | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !portalId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    peek({ data: { portalId, cost } })
      .then((i) => { if (!cancelled) setInfo(i); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || "Couldn't load estimate"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [portalId, cost, enabled, peek]);

  if (!enabled) return null;

  const vipFree = !!info?.vip_free_available;
  const projectedCharge = vipFree ? 0 : cost;
  const balanceAfter = info ? Math.max(0, info.balance - projectedCharge) : null;
  // If the user is a Real OG, every VIP-free pass burned today saved `cost` coins.
  const savingsToday = info?.is_real_og
    ? (info.vip_free_used_today * cost) + (vipFree ? cost : 0)
    : 0;

  return (
    <section
      aria-label="Live cost estimate"
      className={`rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 ${className}`}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" /> Live cost estimate
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </header>

      {error ? (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      ) : (
        <>
          {/* Per-action line */}
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-foreground/90 truncate pr-2">{actionLabel}</span>
            <span className="inline-flex items-center gap-1 font-mono">
              {vipFree ? (
                <>
                  <span className="text-muted-foreground line-through">{cost} 🪙</span>
                  <span className="font-bold text-emerald-400">FREE</span>
                </>
              ) : (
                <span className="font-bold">{cost} 🪙</span>
              )}
            </span>
          </div>

          {/* VIP pass row */}
          {info?.is_real_og && (
            <div className="mt-2 flex items-center justify-between rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <Crown className="h-3.5 w-3.5" /> VIP free pass
              </span>
              <span className="font-mono text-muted-foreground">
                {vipFree ? "Applied (-" + cost + " 🪙)" : "Used today"}
              </span>
            </div>
          )}

          {/* Total */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Total now</span>
            <span className="inline-flex items-center gap-1 text-lg font-bold">
              {projectedCharge} <span aria-hidden>🪙</span>
            </span>
          </div>

          {/* Balance projection */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-secondary/40 border border-border px-2.5 py-2">
              <div className="inline-flex items-center gap-1 text-muted-foreground">
                <Wallet className="h-3 w-3" /> Balance
              </div>
              <div className="mt-1 font-mono font-bold">
                {info ? `${info.balance} 🪙` : "—"}
              </div>
            </div>
            <div className="rounded-md bg-secondary/40 border border-border px-2.5 py-2">
              <div className="inline-flex items-center gap-1 text-muted-foreground">
                <Coins className="h-3 w-3" /> After
              </div>
              <div
                className={`mt-1 font-mono font-bold ${
                  info && !vipFree && !info.can_pay ? "text-destructive" : ""
                }`}
              >
                {balanceAfter !== null ? `${balanceAfter} 🪙` : "—"}
              </div>
            </div>
          </div>

          {/* Subscription savings */}
          {info?.is_real_og && (
            <div className="mt-3 flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <TrendingDown className="h-3.5 w-3.5" /> VIP saved today
              </span>
              <span className="font-mono font-bold text-emerald-300">
                {savingsToday} 🪙
              </span>
            </div>
          )}

          {info && !vipFree && !info.can_pay && (
            <p className="mt-3 text-[11px] text-destructive">
              Not enough credits to unlock — top up before continuing.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default CostEstimatePanel;