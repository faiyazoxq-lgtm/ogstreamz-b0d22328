import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Coins, TrendingDown, Activity } from "lucide-react";
import { getBossSpendSummary, listBossSpendEntries } from "@/lib/boss-spend.functions";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function BossSpendPanel() {
  const summaryFn = useServerFn(getBossSpendSummary);
  const listFn = useServerFn(listBossSpendEntries);

  const { data: summary } = useQuery({
    queryKey: ["boss-spend-summary"],
    queryFn: () => summaryFn(),
    staleTime: 30_000,
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["boss-spend-entries"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listFn({ data: { cursor: pageParam, limit: 20 } }),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <div
      className="mt-4 rounded-2xl p-[1.5px] relative overflow-hidden shadow-[0_0_40px_-16px_oklch(0.72_0.22_245/0.5)]"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.95 0.005 240) 0%, oklch(0.72 0.22 245) 30%, oklch(0.55 0.02 240) 55%, oklch(0.85 0.18 235) 80%, oklch(0.95 0.01 240) 100%)",
      }}
    >
      <div className="rounded-[14px] bg-[oklch(0.13_0.02_250)] p-5 sm:p-6 relative">
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] font-semibold"
            style={{ color: "var(--neon-blue-bright)" }}
          >
            <Activity className="h-3.5 w-3.5" />
            Spend Activity
          </div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Live</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div
            className="rounded-lg px-3 py-3"
            style={{
              border: "1px solid oklch(0.72 0.22 245 / 0.28)",
              background:
                "linear-gradient(180deg, oklch(0.18 0.02 250 / 0.85), oklch(0.13 0.02 250 / 0.9))",
              boxShadow:
                "inset 0 1px 0 oklch(0.95 0.01 240 / 0.08), 0 0 24px -16px oklch(0.72 0.22 245 / 0.7)",
            }}
          >
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              <Coins className="h-3 w-3" /> Lifetime spend
            </div>
            <p className="mt-1 font-[Montserrat] font-black text-2xl text-metallic">
              {summary ? fmt(summary.lifetime) : "—"}
            </p>
          </div>
          <div
            className="rounded-lg px-3 py-3"
            style={{
              border: "1px solid oklch(0.72 0.22 245 / 0.28)",
              background:
                "linear-gradient(180deg, oklch(0.18 0.02 250 / 0.85), oklch(0.13 0.02 250 / 0.9))",
              boxShadow:
                "inset 0 1px 0 oklch(0.95 0.01 240 / 0.08), 0 0 24px -16px oklch(0.72 0.22 245 / 0.7)",
            }}
          >
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              <TrendingDown className="h-3 w-3" /> Last 7 days
            </div>
            <p className="mt-1 font-[Montserrat] font-black text-2xl text-metallic">
              {summary ? fmt(summary.last7) : "—"}
            </p>
          </div>
        </div>

        <div
          className="mt-4 rounded-lg max-h-72 overflow-y-auto divide-y"
          style={{
            border: "1px solid oklch(0.72 0.22 245 / 0.22)",
            background: "oklch(0.11 0.02 250 / 0.7)",
            borderColor: "oklch(0.72 0.22 245 / 0.18)",
          }}
        >
          {isLoading && (
            <div className="px-3 py-4 text-xs text-muted-foreground">Loading activity…</div>
          )}
          {!isLoading && entries.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground">No spend yet.</div>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
              style={{ borderColor: "oklch(0.72 0.22 245 / 0.12)" }}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{e.reason || "spend"}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {relTime(e.created_at)}
                </p>
              </div>
              <span
                className="font-[Montserrat] font-black text-sm"
                style={{ color: "var(--neon-blue-bright)" }}
              >
                −{fmt(e.amount)}
              </span>
            </div>
          ))}
          <div ref={sentinelRef} />
          {isFetchingNextPage && (
            <div className="px-3 py-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground text-center">
              Loading more…
            </div>
          )}
          {!hasNextPage && entries.length > 0 && (
            <div className="px-3 py-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 text-center">
              End of ledger
            </div>
          )}
        </div>
      </div>
    </div>
  );
}