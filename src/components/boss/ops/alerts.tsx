import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Inbox,
  ShieldCheck,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listSystemAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
} from "@/lib/system-alerts.functions";

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

const sevLabel: Record<Alert["severity"], string> = {
  info: "Info",
  warn: "Warning",
  error: "Error",
};

const catLabel: Record<Alert["category"], string> = {
  fallback: "Fallback",
  api_error: "API Error",
};

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AlertsPanel() {
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
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeAcknowledged]);

  const visible = useMemo(
    () => (filter === "all" ? alerts : alerts.filter((a) => a.category === filter)),
    [alerts, filter],
  );

  async function onAck(id: string) {
    setBusy(id);
    try {
      await ack({ data: { id } });
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function onAckAll() {
    setBusy("__all");
    try {
      await ackAll({});
      await load();
    } finally {
      setBusy(null);
    }
  }

  const unacknowledged = visible.filter((a) => !a.acknowledged_at);
  const errorCount = unacknowledged.filter((a) => a.severity === "error").length;
  const warnCount = unacknowledged.filter((a) => a.severity === "warn").length;

  return (
    <div className="space-y-5">
      {/* ── Status bar ── */}
      <div className="rounded-xl border border-white/10 bg-background/40 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {unread === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="h-3.5 w-3.5" /> All clear
            </span>
          ) : (
            <>
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  <Zap className="h-3.5 w-3.5" />
                  {errorCount} error{errorCount !== 1 ? "s" : ""}
                </span>
              )}
              {warnCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {warnCount} warning{warnCount !== 1 ? "s" : ""}
                </span>
              )}
              {unacknowledged.length > errorCount + warnCount && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {unacknowledged.length - errorCount - warnCount} info
                </span>
              )}
            </>
          )}
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {visible.length} visible · realtime
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={onAckAll}
            disabled={!unread || busy === "__all"}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-30 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Ack all
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "all" as const, label: "All" },
            { key: "api_error" as const, label: "API Errors" },
            { key: "fallback" as const, label: "Fallbacks" },
          ] as const
        ).map((f) => {
          const active = filter === f.key;
          const count =
            f.key === "all"
              ? unacknowledged.length
              : unacknowledged.filter((a) => a.category === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] transition-colors border " +
                (active
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-secondary/40 text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/60")
              }
            >
              {f.label}
              {count > 0 && (
                <span className="text-white/40 font-mono text-[9px]">{count}</span>
              )}
            </button>
          );
        })}
        <label className="ml-auto inline-flex items-center gap-2 text-[11px] text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={includeAcknowledged}
            onChange={(e) => setIncludeAcknowledged(e.target.checked)}
            className="h-3.5 w-3.5 accent-yellow-400 rounded"
          />
          Include acknowledged
        </label>
      </div>

      {/* ── Alert list ── */}
      <ul className="space-y-2.5">
        {loading && alerts.length === 0 && (
          <li className="text-center text-xs text-white/45 py-10">
            <Zap className="h-5 w-5 mx-auto mb-2 text-white/20 animate-pulse" />
            Loading alerts…
          </li>
        )}

        {!loading && visible.length === 0 && (
          <li className="rounded-2xl border border-white/5 bg-background/20 px-6 py-10 text-center">
            <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-emerald-400/40" />
            <p className="text-sm font-semibold text-white/70">No alerts</p>
            <p className="text-xs text-white/40 mt-1">
              {includeAcknowledged
                ? "Everything is quiet right now."
                : "All alerts are acknowledged. Toggle above to see history."}
            </p>
          </li>
        )}

        {visible.map((a) => (
          <AlertCard
            key={a.id}
            alert={a}
            busy={busy === a.id}
            onAck={() => onAck(a.id)}
          />
        ))}
      </ul>
    </div>
  );
}

/* ── AlertCard ─────────────────────────────────────────────── */

function AlertCard({
  alert: a,
  busy,
  onAck,
}: {
  alert: Alert;
  busy: boolean;
  onAck: () => void;
}) {
  const tint = sevTint[a.severity];
  const acknowledged = !!a.acknowledged_at;
  const [metaOpen, setMetaOpen] = useState(false);

  const Icon = a.category === "fallback" ? Sparkles : AlertTriangle;
  const isUrgent = a.severity === "error" && !acknowledged;

  return (
    <li
      className={
        "rounded-xl border p-4 transition-colors " +
        (isUrgent
          ? "border-rose-500/30 bg-rose-500/[0.04]"
          : acknowledged
          ? "border-white/5 bg-background/20 opacity-60"
          : "border-white/10 bg-background/40")
      }
      style={!acknowledged && !isUrgent ? { borderLeft: `2px solid ${tint}88` } : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Severity icon */}
        <span
          className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center"
          style={{
            background: `${tint}18`,
            border: `1px solid ${tint}44`,
          }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: tint }} />
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className={
                "text-sm truncate " +
                (acknowledged ? "text-white/50" : "text-white/90")
              }
            >
              {a.title}
            </h3>
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] font-bold border"
              style={{
                background: `${tint}15`,
                color: tint,
                borderColor: `${tint}44`,
              }}
            >
              {sevLabel[a.severity]}
            </span>
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] font-bold border bg-white/[0.03] text-white/50 border-white/10"
            >
              {catLabel[a.category]}
            </span>
          </div>

          {/* Meta line: source + time */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-white/40">
            <span className="inline-flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {a.source}
            </span>
            <span className="inline-flex items-center gap-1" title={new Date(a.created_at).toLocaleString("en-GB")}>
              <Clock className="h-3 w-3" />
              {relativeTime(a.created_at)}
            </span>
            {a.related_job_id && (
              <span className="font-mono text-white/30">job {a.related_job_id.slice(0, 8)}</span>
            )}
          </div>

          {/* Message */}
          {a.message && (
            <p className={"text-xs leading-relaxed " + (acknowledged ? "text-white/35" : "text-white/60")}>
              {a.message}
            </p>
          )}

          {/* Collapsible metadata */}
          {a.metadata && Object.keys(a.metadata).length > 0 && (
            <div>
              <button
                onClick={() => setMetaOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/60 transition-colors"
              >
                {metaOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                Metadata
              </button>
              {metaOpen && (
                <pre className="mt-1.5 text-[10px] text-white/40 bg-black/30 rounded-md px-3 py-2 overflow-auto max-h-40 font-mono leading-relaxed">
                  {JSON.stringify(a.metadata, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Action */}
          <div className="pt-1">
            {!acknowledged ? (
              <button
                type="button"
                onClick={onAck}
                disabled={busy}
                className={
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors disabled:opacity-40 " +
                  (isUrgent
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80")
                }
              >
                <CheckCircle2 className="h-3 w-3" />
                {isUrgent ? "Acknowledge" : "Ack"}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-emerald-400/60">
                <CheckCircle2 className="h-3 w-3" /> Acknowledged
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
