import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Sparkles, Inbox, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listSystemAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
} from "@/lib/system-alerts.functions";

export const Route = createFileRoute("/boss/alerts")({
  head: () => ({
    meta: [
      { title: "System Alerts · 0G Boss" },
      { name: "description", content: "Live API errors and Perplexity fallback activity." },
    ],
  }),
  component: BossAlertsPage,
});

type Alert = {
  id: string;
  category: "fallback" | "api_error";
  severity: "info" | "warn" | "error";
  source: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  related_job_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
};

const sevTint: Record<Alert["severity"], string> = {
  info: "#3ad6ff",
  warn: "#ffd166",
  error: "#ff5577",
};

function BossAlertsPage() {
  const list = useServerFn(listSystemAlerts);
  const ack = useServerFn(acknowledgeAlert);
  const ackAll = useServerFn(acknowledgeAllAlerts);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [includeAcknowledged, setIncludeAcknowledged] = useState(false);
  const [filter, setFilter] = useState<"all" | "fallback" | "api_error">("all");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await list({ data: { includeAcknowledged, limit: 200 } });
      setAlerts((r.alerts ?? []) as Alert[]);
      setUnread(r.unread ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("system_alerts_boss")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeAcknowledged]);

  const visible = useMemo(
    () => (filter === "all" ? alerts : alerts.filter((a) => a.category === filter)),
    [alerts, filter],
  );

  async function onAck(id: string) {
    setBusy(id);
    try { await ack({ data: { id } }); await load(); } finally { setBusy(null); }
  }
  async function onAckAll() {
    setBusy("__all");
    try { await ackAll({}); await load(); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <header className="glass-obsidian-cmd rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6" style={{ color: "#ff5577" }} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ff8aa3" }}>
                0G · Command Centre
              </p>
              <h1 className="syndicate-header text-2xl text-white/95">System Alerts</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] terminal-mono"
              style={{
                background: unread ? "rgba(255,85,119,0.10)" : "rgba(0,224,138,0.10)",
                border: `1px solid ${unread ? "#ff557755" : "#00e08a55"}`,
                color: unread ? "#ff8aa3" : "#00e08a",
              }}
            >
              {unread ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {unread ? `${unread} unread` : "All clear"}
            </span>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/15 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={onAckAll}
              disabled={!unread || busy === "__all"}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Ack all
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/65 max-w-2xl">
          Live feed of upstream API errors and Perplexity-powered fallback activity. Realtime — no refresh needed.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-white/50 mr-1">
          <Filter className="h-3 w-3" /> Filter
        </span>
        {(["all", "api_error", "fallback"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] border transition ${
              filter === f
                ? "bg-white/10 border-white/30 text-white"
                : "bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/5"
            }`}
          >
            {f === "api_error" ? "API errors" : f === "fallback" ? "Fallbacks" : "All"}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-2 text-[11px] text-white/60">
          <input
            type="checkbox"
            checked={includeAcknowledged}
            onChange={(e) => setIncludeAcknowledged(e.target.checked)}
            className="h-3.5 w-3.5 accent-yellow-400"
          />
          Show acknowledged
        </label>
      </div>

      <ul className="space-y-2">
        {loading && alerts.length === 0 && (
          <li className="text-center text-xs text-white/45 py-8">Loading alerts…</li>
        )}
        {!loading && visible.length === 0 && (
          <li className="glass-obsidian-cmd rounded-2xl p-8 text-center text-sm text-white/55">
            <Inbox className="h-6 w-6 mx-auto mb-2 text-white/30" />
            No alerts to show.
          </li>
        )}
        {visible.map((a) => {
          const tint = sevTint[a.severity];
          const acknowledged = !!a.acknowledged_at;
          const Icon = a.category === "fallback" ? Sparkles : AlertTriangle;
          return (
            <li
              key={a.id}
              className="glass-obsidian-cmd rounded-2xl p-4"
              style={{ borderColor: `${tint}55`, opacity: acknowledged ? 0.55 : 1 }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: `${tint}1f`, border: `1px solid ${tint}55` }}
                >
                  <Icon className="h-4 w-4" style={{ color: tint }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="syndicate-header text-sm text-white/95 truncate">{a.title}</h3>
                    <span
                      className="text-[9px] uppercase tracking-[0.25em] px-1.5 py-0.5 rounded-full"
                      style={{ background: `${tint}22`, color: tint, border: `1px solid ${tint}55` }}
                    >
                      {a.category === "fallback" ? "Fallback" : "API error"}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                      {a.source}
                    </span>
                    <span className="ml-auto text-[10px] text-white/40 terminal-mono">
                      {new Date(a.created_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                  {a.message && (
                    <p className="mt-1 text-xs text-white/65 break-words">{a.message}</p>
                  )}
                  {a.metadata && Object.keys(a.metadata).length > 0 && (
                    <pre className="mt-2 text-[10px] text-white/45 bg-black/30 rounded-md px-2 py-1.5 overflow-auto max-h-32">
                      {JSON.stringify(a.metadata, null, 2)}
                    </pre>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {!acknowledged ? (
                      <button
                        type="button"
                        onClick={() => onAck(a.id)}
                        disabled={busy === a.id}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Acknowledge
                      </button>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/70">
                        ✓ Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}