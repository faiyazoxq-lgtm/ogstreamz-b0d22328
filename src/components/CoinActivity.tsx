import { useEffect, useRef, useState } from "react";
import { Coins, Gift, ArrowDownRight, ArrowUpRight, RefreshCw, ChevronDown, Loader2, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
};

function describeReason(reason: string, delta: number): { label: string; note: string | null; gift: boolean } {
  const r = (reason || "").trim();
  // Boss gift: "boss:gift" or "boss:gift:<note>"
  if (r.startsWith("boss:gift")) {
    const note = r.slice("boss:gift".length).replace(/^:/, "").trim();
    return { label: "🎁 Gift from Boss", note: note || null, gift: true };
  }
  if (r.startsWith("boss:adjust")) {
    const note = r.slice("boss:adjust".length).replace(/^:/, "").trim();
    return { label: delta >= 0 ? "Boss adjustment" : "Boss removed coins", note: note || null, gift: false };
  }
  if (r.startsWith("topup:approved")) {
    return { label: "✅ Top-up approved", note: null, gift: true };
  }
  if (r.startsWith("redeem:")) {
    return { label: `Redeemed code · ${r.slice("redeem:".length)}`, note: null, gift: true };
  }
  if (r.startsWith("purchase:")) {
    return { label: `Spent on ${r.slice("purchase:".length).replace(/_/g, " ")}`, note: null, gift: false };
  }
  if (r.includes("vip")) {
    return { label: "VIP perk (no spend)", note: null, gift: false };
  }
  return { label: r || "Adjustment", note: null, gift: delta > 0 };
}

export function CoinActivity({
  limit = 8,
  loadMore = false,
  pageSize = 20,
}: { limit?: number; loadMore?: boolean; pageSize?: number }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  const initialSize = loadMore ? pageSize : limit;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(initialSize);
    const next = (data ?? []) as LedgerRow[];
    setRows(next);
    setHasMore(loadMore && next.length === initialSize);
    setLoading(false);
  };

  const loadNext = async () => {
    if (!user || loadingMore || rows.length === 0) return;
    setLoadingMore(true);
    const last = rows[rows.length - 1];
    // Keyset pagination on (created_at desc, id desc) so rows that share a
    // created_at timestamp are neither dropped nor returned twice.
    const { data } = await supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`)
      .limit(pageSize);
    const fetched = (data ?? []) as LedgerRow[];
    // Defensive de-dupe in case anything slips through.
    const seen = new Set(rows.map((r) => r.id));
    const next = fetched.filter((r) => !seen.has(r.id));
    setRows((prev) => [...prev, ...next]);
    setHasMore(fetched.length === pageSize);
    setLoadingMore(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  if (!user) return null;

  const scrollToTop = () => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const skeletonCount = Math.min(6, initialSize);

  return (
    <section ref={sectionRef} className="scroll-mt-20 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 via-card to-card p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-gold" />
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-gold">Coin Activity</h2>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      {loading && rows.length === 0 ? (
        <ol className="space-y-2" aria-busy="true" aria-label="Loading coin activity">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <LedgerSkeleton key={i} />
          ))}
        </ol>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">No activity yet.</p>
      ) : (
        <>
        <ol className="space-y-2">
          {rows.map((row) => {
            const meta = describeReason(row.reason, row.delta);
            const positive = row.delta > 0;
            const zero = row.delta === 0;
            return (
              <li
                key={row.id}
                className={[
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                  meta.gift
                    ? "border-gold/40 bg-gold/10"
                    : positive
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : zero
                        ? "border-border bg-background/40"
                        : "border-border bg-background/40",
                ].join(" ")}
              >
                <div className="shrink-0 mt-0.5">
                  {meta.gift ? (
                    <Gift className="h-4 w-4 text-gold" />
                  ) : positive ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground truncate">{meta.label}</p>
                    <span
                      className={[
                        "text-sm font-[Montserrat] font-black tabular-nums",
                        positive ? "text-emerald-400" : zero ? "text-muted-foreground" : "text-destructive",
                      ].join(" ")}
                    >
                      {positive ? "+" : ""}
                      {row.delta} 🪙
                    </span>
                  </div>
                  {meta.note && (
                    <p className="mt-1 text-xs italic text-foreground/80">"{meta.note}"</p>
                  )}
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            );
          })}
          {loadingMore && Array.from({ length: 3 }).map((_, i) => (
            <LedgerSkeleton key={`more-${i}`} />
          ))}
        </ol>
        {loadMore && hasMore && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={loadNext}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 text-gold px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] hover:bg-gold/15 disabled:opacity-60"
            >
              {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
        {loadMore && !hasMore && rows.length > 0 && (
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">End of ledger</p>
        )}
        {loadMore && rows.length > pageSize && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <ArrowUp className="h-3 w-3" /> Back to top
            </button>
          </div>
        )}
        </>
      )}
    </section>
  );
}

function LedgerSkeleton() {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 animate-pulse">
      <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-muted/50" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-1/2 rounded bg-muted/50" />
          <div className="h-3 w-12 rounded bg-muted/50" />
        </div>
        <div className="h-2 w-1/3 rounded bg-muted/40" />
      </div>
    </li>
  );
}