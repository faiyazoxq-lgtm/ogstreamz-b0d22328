import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { RefreshCw, ShieldAlert, Filter } from "lucide-react";
import { listRealtimeDenials } from "@/lib/realtime-monitor.functions";

export const Route = createFileRoute("/boss/realtime-denials")({
  head: () => ({
    meta: [
      { title: "Realtime Denials · 0G Boss" },
      {
        name: "description",
        content:
          "Audit log of denied / errored Realtime channel subscriptions.",
      },
    ],
  }),
  component: BossRealtimeDenialsPage,
});

type Denial = {
  id: string;
  user_id: string | null;
  topic: string;
  status: string;
  reason: string | null;
  user_agent: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function BossRealtimeDenialsPage() {
  const list = useServerFn(listRealtimeDenials);

  const [rows, setRows] = useState<Denial[]>([]);
  const [last24h, setLast24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [topicLike, setTopicLike] = useState("");
  const [sinceHours, setSinceHours] = useState<number>(24);

  async function load() {
    setLoading(true);
    try {
      const r = await list({
        data: {
          limit: 200,
          topicLike: topicLike.trim() || undefined,
          sinceHours,
        },
      });
      setRows((r.denials ?? []) as Denial[]);
      setLast24h(r.last24h ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicLike, sinceHours]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Realtime denials</h1>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <p className="text-sm text-muted-foreground">
        Logged when a client's Realtime subscription is rejected, errored, or
        torn down. Use this to spot users probing topics they don't own —{" "}
        <strong className="text-foreground">{last24h}</strong> events in the last
        24h.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="mr-1 inline h-3 w-3" /> Topic contains
          </span>
          <input
            value={topicLike}
            onChange={(e) => setTopicLike(e.target.value)}
            placeholder="suno-jobs-…"
            className="w-64 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            Window
          </span>
          <select
            value={sinceHours}
            onChange={(e) => setSinceHours(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value={1}>Last hour</option>
            <option value={24}>Last 24h</option>
            <option value={24 * 7}>Last 7d</option>
            <option value={24 * 30}>Last 30d</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Topic</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No denials in window.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.topic}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.user_id ? r.user_id.slice(0, 8) : <span className="text-muted-foreground">anon</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.ip ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}