import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, RefreshCw, Filter, ChevronDown } from "lucide-react";
import { listBossAudit, type BossAuditRow } from "@/lib/boss-audit.functions";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/audit-log")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Audit Log · Boss" },
      { name: "description", content: "Append-only record of every Boss-only action with timestamps and affected user IDs." },
    ],
  }),
  component: BossAuditLogPage,
});

const ACTIONS = [
  "", "set_rank", "set_status", "adjust_credits", "set_banned",
  "force_sign_out", "set_user_swearing",
] as const;

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function ActionBadge({ action }: { action: string }) {
  const tint: Record<string, string> = {
    set_rank: "#a78bfa",
    set_status: "#3ad6ff",
    adjust_credits: "#ffd166",
    set_banned: "#ff2e55",
    force_sign_out: "#ff8c42",
    set_user_swearing: "#94a3b8",
  };
  const c = tint[action] ?? "#64748b";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14` }}
    >
      {action}
    </span>
  );
}

function BossAuditLogPage() {
  const list = useServerFn(listBossAudit);
  const [rows, setRows] = useState<BossAuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [targetFilter, setTargetFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await list({ data: { limit: 50, cursor: null, action: actionFilter, targetUserId: targetFilter } });
      setRows(res.rows);
      setCursor(res.nextCursor ?? null);
      setHasMore(!!res.hasMore);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [list, actionFilter, targetFilter]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursor || loading) return;
    setLoading(true);
    try {
      const res = await list({ data: { limit: 50, cursor, action: actionFilter, targetUserId: targetFilter } });
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...res.rows.filter((r) => !seen.has(r.id))];
      });
      setCursor(res.nextCursor ?? null);
      setHasMore(!!res.hasMore);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load more");
    } finally {
      setLoading(false);
    }
  }, [list, cursor, hasMore, loading, actionFilter, targetFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const summary = useMemo(() => `${rows.length} entr${rows.length === 1 ? "y" : "ies"}${hasMore ? " (more available)" : ""}`, [rows.length, hasMore]);

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
            Boss Console
          </p>
          <h1 className="mt-1 font-[Montserrat] font-black text-2xl sm:text-3xl text-foreground inline-flex items-center gap-2">
            <ScrollText className="h-6 w-6" /> Audit Log
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Append-only record of every Boss-only mutation on <code>/boss</code> and <code>/boss/users</code>.
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

      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
        <div className="inline-flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <label htmlFor="audit-action" className="text-muted-foreground">Action</label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {ACTIONS.map((a) => (
              <option key={a || "all"} value={a}>{a || "All actions"}</option>
            ))}
          </select>
        </div>
        <div className="inline-flex items-center gap-2">
          <label htmlFor="audit-target" className="text-muted-foreground">Target user ID</label>
          <input
            id="audit-target"
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            placeholder="uuid…"
            className="w-72 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono"
          />
        </div>
        <span className="ml-auto text-muted-foreground">{summary}</span>
      </div>

      {err && <p className="text-sm text-destructive mb-3">{err}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[160px_140px_1fr_44px] items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
          <div>When</div>
          <div>Action</div>
          <div>Actor → Target</div>
          <div className="text-right">Detail</div>
        </div>
        {rows.length === 0 && !loading ? (
          <p className="p-6 text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          rows.map((r) => {
            const open = openId === r.id;
            return (
              <div key={r.id} className="border-b border-border/60 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="grid w-full grid-cols-[160px_140px_1fr_44px] items-center gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/30"
                >
                  <div className="text-muted-foreground" title={r.created_at}>{fmtTime(r.created_at)}</div>
                  <div><ActionBadge action={r.action} /></div>
                  <div className="min-w-0 truncate">
                    <span className="text-foreground">{r.actor_email ?? r.actor_id.slice(0, 8) + "…"}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    {r.target_user_id ? (
                      <Link
                        to="/boss/audit-log"
                        search={{ target: r.target_user_id }}
                        className="text-foreground hover:underline"
                        onClick={(e) => { e.stopPropagation(); setTargetFilter(r.target_user_id!); }}
                      >
                        {r.target_email ?? r.target_user_id.slice(0, 8) + "…"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {r.surface && <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{r.surface}</span>}
                  </div>
                  <ChevronDown className={`h-4 w-4 justify-self-end transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="grid grid-cols-1 gap-3 border-t border-border/60 bg-background/50 p-3 text-[11px] sm:grid-cols-3">
                    <Detail label="Before" value={r.before_value} />
                    <Detail label="After" value={r.after_value} />
                    <Detail
                      label="Reason / metadata"
                      value={{
                        reason: r.reason,
                        target_user_id: r.target_user_id,
                        actor_id: r.actor_id,
                        ...((r.metadata && Object.keys(r.metadata).length) ? { metadata: r.metadata } : {}),
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border border-border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] hover:bg-secondary disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground mb-1">{label}</p>
      <pre className="overflow-x-auto rounded-md bg-secondary/40 p-2 text-[11px] leading-snug">
        {value === null || value === undefined ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}