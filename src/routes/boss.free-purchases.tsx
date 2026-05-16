import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crown, RefreshCw, Filter, Calendar as CalendarIcon, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listBossFreePurchases, type BossFreePurchaseRow } from "@/lib/boss-purchase-audit.functions";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/free-purchases")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Boss Free Purchases · Boss" },
      { name: "description", content: "Audit log of every free unlock granted by a Boss override." },
    ],
  }),
  component: BossFreePurchasesPage,
});

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function KindBadge({ kind }: { kind: string }) {
  const tints: Record<string, string> = {
    track_unlock: "#3ad6ff",
    real_og: "#ffd166",
    store_pass: "#a78bfa",
  };
  const c = tints[kind] ?? "#64748b";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14` }}
    >
      {kind.replace("_", " ")}
    </span>
  );
}

type Filters = {
  userQuery: string;
  titleQuery: string;
  kind: string;
  fromDate: string; // yyyy-mm-dd
  toDate: string;
};

const EMPTY: Filters = { userQuery: "", titleQuery: "", kind: "", fromDate: "", toDate: "" };

function BossFreePurchasesPage() {
  const list = useServerFn(listBossFreePurchases);
  const [rows, setRows] = useState<BossFreePurchaseRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const fetchPage = useCallback(async (reset: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await list({
        data: {
          limit: 50,
          cursor: reset ? null : cursor,
          userQuery: applied.userQuery || undefined,
          titleQuery: applied.titleQuery || undefined,
          kind: applied.kind || undefined,
          fromDate: applied.fromDate ? new Date(applied.fromDate).toISOString() : null,
          toDate: applied.toDate ? new Date(applied.toDate + "T23:59:59.999Z").toISOString() : null,
        },
      });
      setRows((prev) => reset ? res.rows : [...prev, ...res.rows]);
      setCursor(res.nextCursor);
      setHasMore(!!res.hasMore);
    } catch (e: any) {
      setError(e?.message || "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [list, cursor, applied]);

  useEffect(() => { fetchPage(true); }, [applied]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalShown = rows.length;
  const totalCredits = useMemo(
    () => rows.reduce((acc, r) => acc + (r.would_have_cost_credits || 0), 0),
    [rows],
  );

  const apply = () => setApplied(filters);
  const clear = () => { setFilters(EMPTY); setApplied(EMPTY); };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-[Montserrat] font-black text-2xl md:text-3xl text-metallic flex items-center gap-2">
            <Crown className="h-6 w-6 text-gold" /> Boss Free Purchases
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            Every unlock granted via the Boss override. No coins were deducted —
            this log records who, what, and when so you can audit the bypass.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPage(true)}
          disabled={loading}
        >
          <RefreshCw className={"h-3.5 w-3.5 mr-2 " + (loading ? "animate-spin" : "")} />
          Refresh
        </Button>
      </header>

      {/* Filters */}
      <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <Filter className="h-3 w-3" /> Filters
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">User (email or id)</Label>
            <Input
              value={filters.userQuery}
              onChange={(e) => setFilters((f) => ({ ...f, userQuery: e.target.value }))}
              placeholder="alice@…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Item title</Label>
            <Input
              value={filters.titleQuery}
              onChange={(e) => setFilters((f) => ({ ...f, titleQuery: e.target.value }))}
              placeholder="My song…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Kind</Label>
            <Select
              value={filters.kind || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, kind: v === "all" ? "" : v }))}
            >
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                <SelectItem value="track_unlock">Track unlock</SelectItem>
                <SelectItem value="real_og">Real OG Pass</SelectItem>
                <SelectItem value="store_pass">Store pass</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">From</Label>
            <Input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">To</Label>
            <Input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={apply} size="sm" disabled={loading}>Apply</Button>
          <Button onClick={clear} size="sm" variant="ghost"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button>
        </div>
      </section>

      {/* Summary */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{totalShown}</strong> entries shown</span>
        <span><strong className="text-foreground">{totalCredits}</strong> 🪙 would-have-cost (saved by boss override)</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Kind</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Would-have-cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-xs text-muted-foreground">No Boss free purchases match these filters.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtTime(r.created_at)}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium text-foreground">{r.user_email ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{r.user_id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2"><KindBadge kind={r.kind} /></td>
                  <td className="px-3 py-2 text-xs">
                    <div>{r.item_title ?? "—"}</div>
                    {r.ref_id && <div className="text-[10px] text-muted-foreground font-mono">{r.ref_id.slice(0, 8)}…</div>}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <span className="line-through text-muted-foreground/70">{r.would_have_cost_credits} 🪙</span>
                    <span className="ml-2 font-bold text-gold">FREE</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {hasMore && (
        <div className="text-center">
          <Button onClick={() => fetchPage(false)} disabled={loading} variant="outline" size="sm">
            <ChevronDown className="h-3.5 w-3.5 mr-2" /> Load more
          </Button>
        </div>
      )}
    </div>
  );
}
