import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { RefreshCw, ShieldAlert, Filter } from "lucide-react";
import { listSecurityEvents } from "@/lib/security-monitor.functions";

export const Route = createFileRoute("/boss/security-events")({
  head: () => ({
    meta: [
      { title: "Security Events · 0G Boss" },
      {
        name: "description",
        content:
          "Audit feed of authentication and privileged-access events: sign-ins, role changes, rank changes, bans.",
      },
    ],
  }),
  component: BossSecurityEventsPage,
});

type Event = {
  id: string;
  event_type: string;
  severity: "info" | "warn" | "error";
  user_id: string | null;
  actor_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function BossSecurityEventsPage() {
  const list = useServerFn(listSecurityEvents);
  const [rows, setRows] = useState<Event[]>([]);
  const [last24h, setLast24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [eventLike, setEventLike] = useState("");
  const [sinceHours, setSinceHours] = useState<number>(24);

  async function load() {
    setLoading(true);
    try {
      const r = await list({
        data: { limit: 200, eventLike: eventLike.trim() || undefined, sinceHours },
      });
      setRows((r.events ?? []) as Event[]);
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
  }, [eventLike, sinceHours]);

  const sevTone = (s: string) =>
    s === "error"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : s === "warn"
        ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-600"
        : "border-border bg-muted text-muted-foreground";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Security events</h1>
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
        Auth + privileged-access audit trail: sign-ins (with new-device /
        unusual-hour flags), role grants &amp; revocations, rank changes, bans.{" "}
        <strong className="text-foreground">{last24h}</strong> events in the last
        24h.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="mr-1 inline h-3 w-3" /> Event contains
          </span>
          <input
            value={eventLike}
            onChange={(e) => setEventLike(e.target.value)}
            placeholder="sign_in, role_, rank_…"
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
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No events in window.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const meta = (r.metadata ?? {}) as Record<string, unknown>;
              const flags: string[] = [];
              if (meta.new_device) flags.push("new device");
              if (meta.unusual_hour) flags.push("unusual hour");
              if (meta.role) flags.push(`role=${String(meta.role)}`);
              if (meta.from && meta.to) flags.push(`${meta.from}→${meta.to}`);
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.event_type}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${sevTone(r.severity)}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.user_id ? r.user_id.slice(0, 8) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.actor_id ? r.actor_id.slice(0, 8) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {r.ip ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {flags.length ? flags.join(" · ") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}