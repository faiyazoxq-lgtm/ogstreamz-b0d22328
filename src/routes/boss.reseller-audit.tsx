import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, RefreshCw, Filter } from "lucide-react";
import { listResellerAudit, type ResellerAuditRow } from "@/lib/reseller-audit.functions";
import { requireBoss } from "@/lib/route-guards";

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

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function ActionBadge({ action }: { action: string }) {
  const tint: Record<string, string> = { create: "#3ad6ff", topup: "#ffd166" };
  const c = tint[action] ?? "#64748b";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14` }}
    >
      {action}
    </span>
  );
}

function SourceBadge({ source }: { source: "live" | "archive" }) {
  const c = source === "live" ? "#22c55e" : "#94a3b8";
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em]"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14` }}
    >
      {source}
    </span>
  );
}

function BossResellerAuditPage() {
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

  const refresh = useCallback(async () => {
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
        },
      });
      setRows(res.rows);
      setCounts(res.counts);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [list, action, resellerId, actorUserId, targetUserId, from, to, includeArchive, limit]);

  useEffect(() => { refresh(); }, []); // initial load

  const summary = useMemo(() => {
    if (!counts) return `${rows.length} entries`;
    return `${counts.returned} shown · live ${counts.live} / archive ${counts.archive}`;
  }, [counts, rows.length]);

  function clearFilters() {
    setAction(""); setResellerId(""); setActorUserId(""); setTargetUserId("");
    setFrom(""); setTo(""); setIncludeArchive(true); setLimit(100);
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
            Boss Console
          </p>
          <h1 className="mt-1 font-[Montserrat] font-black text-2xl sm:text-3xl text-foreground inline-flex items-center gap-2">
            <ScrollText className="h-6 w-6" /> Reseller Audit
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every <code>bossCreateReseller</code> and <code>bossTopupReseller</code> call. Live entries (last 90 days) plus archive.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] hover:bg-secondary"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </header>

      <div className="rounded-xl border border-border bg-card p-3 mb-4">
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
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
          <label className="flex items-end gap-2">
            <input
              id="include-archive"
              type="checkbox"
              checked={includeArchive}
              onChange={(e) => setIncludeArchive(e.target.checked)}
            />
            <span className="text-muted-foreground">Include archive (&gt; 90 days)</span>
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
            onClick={refresh}
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
          <div>When</div>
          <div>Action</div>
          <div>Source</div>
          <div>Actor</div>
          <div>Target user</div>
          <div>Reseller</div>
          <div className="text-right">Delta</div>
        </div>
        {rows.length === 0 && !loading ? (
          <p className="p-6 text-sm text-muted-foreground">No entries match the current filters.</p>
        ) : (
          rows.map((r) => (
            <div
              key={`${r.source}:${r.id}`}
              title={r.reason ? `Reason: ${r.reason}` : undefined}
              className="grid grid-cols-[160px_100px_70px_1fr_1fr_1fr_80px] items-center gap-2 border-b border-border/60 px-3 py-2 text-xs last:border-b-0 hover:bg-secondary/30"
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
            </div>
          ))
        )}
      </div>

      {rows.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Hover any row to see the audit <code>reason</code>. Use the SQL editor for full JSON detail.
        </p>
      )}
    </div>
  );
}