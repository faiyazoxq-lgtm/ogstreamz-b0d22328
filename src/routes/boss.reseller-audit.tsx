import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, RefreshCw, Filter, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, UserPlus, Coins, Archive, Radio, X } from "lucide-react";
import { listResellerAudit, type ResellerAuditRow } from "@/lib/reseller-audit.functions";
import { requireBoss } from "@/lib/route-guards";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export const Route = createFileRoute("/boss/reseller-audit")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Reseller Audit · Boss" },
      { name: "description", content: "Append-only audit log of reseller creation and credit top-up actions, with filters." },
    ],
  }),
  component: BossResellerAuditPage,
});

const ACTIONS = ["", "create", "topup"] as const;

type SortBy = "created_at" | "action" | "source" | "delta";
type SortDir = "asc" | "desc";

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function ActionBadge({ action }: { action: string }) {
  const meta: Record<string, { c: string; Icon: typeof UserPlus; label: string }> = {
    create: { c: "#3ad6ff", Icon: UserPlus, label: "New reseller" },
    topup:  { c: "#ffd166", Icon: Coins,    label: "Top-up"      },
  };
  const m = meta[action] ?? { c: "#64748b", Icon: ScrollText, label: action || "—" };
  const Icon = m.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
      style={{ color: m.c, border: `1px solid ${m.c}55`, background: `${m.c}14` }}
    >
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function SourceBadge({ source }: { source: "live" | "archive" }) {
  const c = source === "live" ? "#22c55e" : "#94a3b8";
  const Icon = source === "live" ? Radio : Archive;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em]"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14` }}
      title={source === "live" ? "Recent entry (last 90 days)" : "Older than 90 days (from archive)"}
    >
      <Icon className="h-2.5 w-2.5" /> {source}
    </span>
  );
}

function SortHeader({
  label, col, sortBy, sortDir, onSort, align,
}: {
  label: string;
  col: SortBy;
  sortBy: SortBy;
  sortDir: SortDir;
  onSort: (c: SortBy) => void;
  align?: "right";
}) {
  const active = sortBy === col;
  const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
        active ? "text-foreground" : ""
      } ${align === "right" ? "justify-end w-full" : ""}`}
      title={`Sort by ${label}${active ? ` (${sortDir})` : ""}`}
    >
      <span>{label}</span>
      <Icon className="h-3 w-3" />
    </button>
  );
}

export function BossResellerAuditPage() {
  const list = useServerFn(listResellerAudit);
  const [rows, setRows] = useState<ResellerAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ live: number; archive: number; returned: number } | null>(null);

  const [action, setAction] = useState<string>("");
  const [resellerId, setResellerId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeArchive, setIncludeArchive] = useState(true);
  const [limit, setLimit] = useState(100);

  // Pagination: stack of cursors for back-navigation. Top of stack is the
  // cursor used to fetch the CURRENT page. Page 1 has no cursor (empty stack).
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // When true, the next fetch is initiated by a filter change → reset paging.
  const filtersDirty = useRef(false);

  // Sorting (server-side via filter args). Default: created_at desc.
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Row detail drawer
  const [selected, setSelected] = useState<ResellerAuditRow | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPage = useCallback(async (cursor: string | null, sb: SortBy = sortBy, sd: SortDir = sortDir) => {
    setLoading(true); setErr(null);
    try {
      // datetime-local has no timezone — treat as local and convert to ISO
      const fromIso = from ? new Date(from).toISOString() : "";
      const toIso = to ? new Date(to).toISOString() : "";
      const res = await list({
        data: {
          action: (action || "") as "" | "create" | "topup",
          resellerId: resellerId.trim(),
          actorUserId: actorUserId.trim(),
          targetUserId: targetUserId.trim(),
          from: fromIso,
          to: toIso,
          includeArchive,
          limit,
          before: cursor ?? "",
          sortBy: sb,
          sortDir: sd,
        },
      });
      setRows(res.rows);
      setCounts(res.counts);
      setNextCursor(res.nextCursor ?? null);
      setHasMore(!!res.hasMore);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [list, action, resellerId, actorUserId, targetUserId, from, to, includeArchive, limit, sortBy, sortDir]);

  // Apply filters / refresh: reset to page 1.
  const applyFilters = useCallback(async () => {
    setCursorStack([]);
    await fetchPage(null);
  }, [fetchPage]);

  // Click a column header: cycle desc → asc → (back to default created_at desc).
  const onSort = useCallback(async (col: SortBy) => {
    let nextBy: SortBy = col;
    let nextDir: SortDir = "desc";
    if (sortBy === col) {
      if (sortDir === "desc") {
        nextDir = "asc";
      } else {
        // Reset to default
        nextBy = "created_at";
        nextDir = "desc";
      }
    }
    setSortBy(nextBy);
    setSortDir(nextDir);
    setCursorStack([]);
    await fetchPage(null, nextBy, nextDir);
  }, [sortBy, sortDir, fetchPage]);

  const goNext = useCallback(async () => {
    if (!nextCursor || loading) return;
    setCursorStack((prev) => [...prev, nextCursor]);
    await fetchPage(nextCursor);
  }, [nextCursor, loading, fetchPage]);

  const goPrev = useCallback(async () => {
    if (cursorStack.length === 0 || loading) return;
    const newStack = cursorStack.slice(0, -1);
    setCursorStack(newStack);
    const prevCursor = newStack.length > 0 ? newStack[newStack.length - 1] : null;
    await fetchPage(prevCursor);
  }, [cursorStack, loading, fetchPage]);

  useEffect(() => { applyFilters(); }, []); // initial load

  const summary = useMemo(() => {
    if (!counts) return `${rows.length} entries`;
    const pageLabel = `Page ${cursorStack.length + 1}`;
    return `${pageLabel} · ${counts.returned} shown · live ${counts.live} / archive ${counts.archive}`;
  }, [counts, rows.length, cursorStack.length]);

  function clearFilters() {
    setAction(""); setResellerId(""); setActorUserId(""); setTargetUserId("");
    setFrom(""); setTo(""); setIncludeArchive(true); setLimit(100);
    setSortBy("created_at"); setSortDir("desc");
  }

  const selectedJson = useMemo(
    () => (selected ? JSON.stringify(selected, null, 2) : ""),
    [selected],
  );

  async function copyJson() {
    if (!selectedJson) return;
    try {
      await navigator.clipboard.writeText(selectedJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="font-[Montserrat] font-black text-xl sm:text-2xl text-foreground inline-flex items-center gap-2">
            <ScrollText className="h-5 w-5" /> Reseller Audit
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Append-only ledger of every reseller created and every credit top-up issued by boss accounts. Read-only — nothing in this view changes data.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
              <Radio className="h-3 w-3" /> Live = last 90 days
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5">
              <Archive className="h-3 w-3" /> Archive = older
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={applyFilters}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <div className="rounded-xl border border-border bg-card p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          {(action || resellerId || actorUserId || targetUserId || from || to || !includeArchive || limit !== 100) && (
            <button
              type="button"
              onClick={() => { clearFilters(); void applyFilters(); }}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Action</span>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5"
            >
              {ACTIONS.map((a) => (
                <option key={a || "all"} value={a}>{a || "All actions"}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Reseller ID</span>
            <input
              value={resellerId}
              onChange={(e) => setResellerId(e.target.value)}
              placeholder="reseller_accounts.id (uuid)"
              className="rounded-md border border-border bg-background px-2 py-1.5 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Actor user ID</span>
            <input
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
              placeholder="auth.users.id (uuid)"
              className="rounded-md border border-border bg-background px-2 py-1.5 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Target user ID</span>
            <input
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="auth.users.id (uuid)"
              className="rounded-md border border-border bg-background px-2 py-1.5 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">From</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">To</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Result limit</span>
            <input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 100)))}
              className="rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>
          <label className="flex items-end gap-2 cursor-pointer">
            <input
              id="include-archive"
              type="checkbox"
              checked={includeArchive}
              onChange={(e) => setIncludeArchive(e.target.checked)}
            />
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Archive className="h-3 w-3" /> Include archive (&gt; 90 days)
            </span>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-secondary"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="rounded-md border border-primary bg-primary/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-primary/20 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Apply filters"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>{summary}</span>
        {err && <span className="text-destructive">{err}</span>}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[160px_100px_70px_1fr_1fr_1fr_80px] items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
          <SortHeader label="When" col="created_at" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Action" col="action" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Source" col="source" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <div>Actor</div>
          <div>Target user</div>
          <div>Reseller</div>
          <SortHeader label="Delta" col="delta" sortBy={sortBy} sortDir={sortDir} onSort={onSort} align="right" />
        </div>
        {rows.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <ScrollText className="h-5 w-5 mx-auto mb-2 opacity-60" />
            <p>No audit entries match the current filters.</p>
            <p className="text-xs mt-1 opacity-80">Try clearing the action filter, widening the date range, or enabling the archive.</p>
          </div>
        ) : (
          rows.map((r) => (
            <button
              type="button"
              key={`${r.source}:${r.id}`}
              onClick={() => setSelected(r)}
              title={r.reason ? `Reason: ${r.reason}` : undefined}
              className="grid w-full grid-cols-[160px_100px_70px_1fr_1fr_1fr_80px] items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-left last:border-b-0 hover:bg-secondary/30 cursor-pointer"
            >
              <div className="text-muted-foreground" title={r.created_at}>{fmtTime(r.created_at)}</div>
              <div><ActionBadge action={r.action} /></div>
              <div><SourceBadge source={r.source} /></div>
              <div className="min-w-0 truncate font-mono text-[11px]" title={r.actor_user_id ?? ""}>
                {r.actor_user_id ?? "—"}
              </div>
              <div className="min-w-0 truncate font-mono text-[11px]" title={r.target_user_id ?? ""}>
                {r.target_user_id ?? "—"}
              </div>
              <div className="min-w-0 truncate font-mono text-[11px]" title={r.reseller_id ?? ""}>
                {r.reseller_id ?? "—"}
              </div>
              <div className="text-right tabular-nums">
                {r.delta == null ? "—" : (r.delta > 0 ? `+${r.delta}` : `${r.delta}`)}
              </div>
            </button>
          ))
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-xs flex-wrap">
          <p className="text-[11px] text-muted-foreground">
            Click a row for full detail · hover for the audit reason.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={loading || cursorStack.length === 0}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-secondary disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-muted-foreground tabular-nums">Page {cursorStack.length + 1}</span>
            <button
              type="button"
              onClick={goNext}
              disabled={loading || !hasMore}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-secondary disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      {/* keep ref in module to avoid unused-import warning */}
      {filtersDirty.current ? null : null}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="inline-flex items-center gap-2">
                  <ActionBadge action={selected.action} />
                  <SourceBadge source={selected.source} />
                  <span>Audit entry</span>
                </SheetTitle>
                <SheetDescription>
                  {fmtTime(selected.created_at)} · <span className="font-mono text-[11px]">{selected.id}</span>
                </SheetDescription>
              </SheetHeader>

              <dl className="mt-5 space-y-3 text-xs">
                <Field label="Action" mono={false} value={selected.action} />
                <Field label="When" mono={false} value={`${fmtTime(selected.created_at)}  (${selected.created_at})`} />
                <Field label="Source" mono={false} value={selected.source} />
                <Field label="Audit row id" value={selected.id} />
                <Field label="Actor user id" value={selected.actor_user_id ?? "—"} />
                <Field label="Target user id" value={selected.target_user_id ?? "—"} />
                <Field label="Reseller id" value={selected.reseller_id ?? "—"} />
                <Field
                  label="Delta"
                  mono={false}
                  value={selected.delta == null
                    ? "—"
                    : (selected.delta > 0 ? `+${selected.delta}` : `${selected.delta}`)}
                />
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">Reason</dt>
                  <dd className="rounded-md border border-border bg-background p-3 text-xs whitespace-pre-wrap break-words min-h-[3rem]">
                    {selected.reason && selected.reason.trim().length > 0
                      ? selected.reason
                      : <span className="text-muted-foreground italic">No reason provided.</span>}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                    Raw payload (JSON)
                  </p>
                  <button
                    type="button"
                    onClick={copyJson}
                    className="rounded-md border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] hover:bg-secondary"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="max-h-80 overflow-auto rounded-md border border-border bg-background p-3 text-[11px] font-mono leading-relaxed">
{selectedJson}
                </pre>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  This audit table stores no extra JSON payload column. For richer context, cross-reference{" "}
                  <code>actor_user_id</code> and <code>target_user_id</code> in the SQL editor.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold pt-0.5">{label}</dt>
      <dd className={`break-all ${mono ? "font-mono text-[11px]" : "text-xs"}`}>{value}</dd>
    </div>
  );
}