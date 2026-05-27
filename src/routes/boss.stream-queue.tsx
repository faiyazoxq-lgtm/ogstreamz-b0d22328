import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Tv, CheckCircle2, XCircle, Loader2, RefreshCw, Clock, AlertTriangle, ShieldCheck, Lock, KeyRound, Inbox, MessageSquare, User2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { bossListStreamRequests, bossDecideStreamRequest } from "@/lib/boss-admin-misc.functions";
import { useAuth } from "@/hooks/use-auth";
import { CoinChip } from "@/components/CoinChip";
import { useCreditsMap } from "@/hooks/use-credits-map";

export const Route = createFileRoute("/boss/stream-queue")({
  component: StreamQueuePage,
});

type Req = {
  id: string;
  user_id: string;
  email: string | null;
  rank: string | null;
  username: string;
  has_password: boolean;
  auto_status: string | null;
  auto_expires_at: string | null;
  status: string;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString() : "—";
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.round(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const TAB_META: Record<"pending" | "approved" | "rejected", { label: string; tint: string; desc: string }> = {
  pending:  { label: "Pending",  tint: "#ffd166", desc: "Awaiting your decision" },
  approved: { label: "Approved", tint: "#7be3b6", desc: "Promoted to stream access" },
  rejected: { label: "Rejected", tint: "#ff8aa3", desc: "Declined — no promotion" },
};

function StreamQueuePage() {
  const { profile, isAdmin } = useAuth();
  const isBoss = profile?.rank === "boss" || isAdmin;
  const listStreamReqsFn = useServerFn(bossListStreamRequests);
  const decideStreamReqFn = useServerFn(bossDecideStreamRequest);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!isBoss) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { rows: r } = await listStreamReqsFn({ data: { status: tab } });
      setRows(r as Req[]);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [tab, listStreamReqsFn, isBoss]);

  useEffect(() => { load(); }, [load]);

  const creditsMap = useCreditsMap(rows.map((r) => r.user_id));

  const decide = async (id: string, approve: boolean) => {
    setBusyId(id);
    const note = noteFor[id] ?? undefined;
    // Snapshot for rollback + optimistic removal from current tab
    const snapshot = rows;
    const target = rows.find((r) => r.id === id);
    const label = target?.email || target?.username || "request";
    setRows((prev) => prev.filter((r) => r.id !== id));
    const verb = approve ? "Approving" : "Rejecting";
    const toastId = toast.loading(`${verb} ${label}…`);
    try {
      await decideStreamReqFn({ data: { id, approve, note } });
      toast.success(approve ? `Approved & promoted ${label}` : `Rejected ${label}`, {
        id: toastId,
        description: note ? `Note: ${note}` : undefined,
      });
      setBusyId(null);
      await load();
    } catch (e: any) {
      // Roll back optimistic removal
      setRows(snapshot);
      setBusyId(null);
      toast.error(approve ? "Approve failed" : "Reject failed", {
        id: toastId,
        description: e?.message ?? "Please try again.",
      });
    }
  };

  if (!isBoss) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-card p-8 text-center max-w-md mx-auto">
        <Lock className="h-8 w-8 mx-auto text-destructive" />
        <h2 className="mt-3 font-[Montserrat] font-black text-lg text-metallic">Restricted Area</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The Stream Verification Queue is boss-only. Stream requests are not loaded for your account.
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground/70">
          <ShieldCheck className="inline h-3 w-3 mr-1" /> Boss credentials required
        </p>
      </div>
    );
  }

  const meta = TAB_META[tab];
  const count = rows.length;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40">
            <Tv className="h-5 w-5 text-gold" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-[Montserrat] font-black text-2xl text-metallic">Stream Verification Queue</h1>
            <p className="text-sm text-muted-foreground">
              Confirm 0G STREAMZ portal access for members and promote verified accounts.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border bg-secondary/60 hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100/90">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-300" />
          <span>
            <span className="font-bold text-emerald-200">Approve & Promote</span> grants stream access immediately.
            <span className="font-bold text-emerald-200"> Reject</span> closes the request without changes. Passwords are encrypted at rest and never visible here.
          </span>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected"] as const).map((t) => {
          const m = TAB_META[t];
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] rounded-md border transition"
              style={{
                borderColor: active ? `${m.tint}88` : "rgba(255,255,255,0.08)",
                background: active ? `${m.tint}1a` : "rgba(255,255,255,0.02)",
                color: active ? m.tint : "rgba(255,255,255,0.55)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: m.tint, boxShadow: active ? `0 0 6px ${m.tint}` : "none" }}
              />
              {m.label}
              {active && !loading && (
                <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums">{count}</span>
              )}
            </button>
          );
        })}
        <span className="ml-auto self-center text-[11px] text-muted-foreground">{meta.desc}</span>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading queue…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-500/25 bg-card p-10 text-center">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
            {tab === "pending" ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Inbox className="h-5 w-5 text-muted-foreground" />}
          </span>
          <p className="font-[Montserrat] font-black text-base text-metallic">
            {tab === "pending" ? "Queue is clear" : `No ${tab} requests`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "pending"
              ? "All caught up — no stream verifications waiting on you."
              : `Nothing has landed in ${tab} yet.`}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const autoOk = (r.auto_status ?? "").toLowerCase() === "active";
            return (
              <li
                key={r.id}
                className="rounded-xl border bg-card p-4 transition-colors"
                style={{
                  borderColor:
                    tab === "pending"
                      ? autoOk ? "rgba(123,227,182,0.25)" : "rgba(255,209,102,0.3)"
                      : "rgba(255,255,255,0.08)",
                }}
              >
                {/* Identity row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <User2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-semibold text-foreground truncate">{r.email || r.user_id}</span>
                      <CoinChip credits={creditsMap[r.user_id]} />
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        {r.rank ?? "no rank"}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Submitted {relativeTime(r.created_at)}
                      <span className="text-muted-foreground/50">·</span>
                      <span className="text-muted-foreground/70">{fmt(r.created_at)}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
                      autoOk
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    }`}
                    title="Result of automated subscription check"
                  >
                    {autoOk ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    Auto-check: {r.auto_status || "Unknown"}
                    {r.auto_expires_at && <> · <Clock className="h-3 w-3" />{new Date(r.auto_expires_at).toLocaleDateString()}</>}
                  </span>
                </div>

                {/* Credentials cluster */}
                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                  <div className="rounded-md bg-secondary/40 border border-border px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Submitted username</div>
                    <div className="mt-0.5 font-mono text-xs break-all text-foreground">{r.username}</div>
                  </div>
                  <div className="rounded-md bg-secondary/40 border border-border px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Password</div>
                    <div className="mt-0.5 font-mono text-xs break-all inline-flex items-center gap-1.5 text-muted-foreground">
                      {r.has_password
                        ? (<><KeyRound className="h-3 w-3 text-emerald-300" /> encrypted at rest</>)
                        : (<><Lock className="h-3 w-3" /> scrubbed</>)}
                    </div>
                  </div>
                </div>

                {/* Decision panel */}
                {tab === "pending" ? (
                  <div className="mt-3 rounded-lg border border-gold/25 bg-gold/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gold font-bold">
                      <ShieldCheck className="h-3 w-3" /> Decide
                    </div>
                    <label className="block">
                      <span className="sr-only">Decision note</span>
                      <div className="relative">
                        <MessageSquare className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
                        <input
                          value={noteFor[r.id] ?? ""}
                          onChange={(e) => setNoteFor((s) => ({ ...s, [r.id]: e.target.value }))}
                          placeholder="Decision note (optional — shown in toast & history)"
                          className="w-full bg-background/60 border border-border rounded-md pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </label>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        disabled={busyId === r.id}
                        onClick={() => decide(r.id, false)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => decide(r.id, true)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve & Promote
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
                    <span className="font-bold uppercase tracking-[0.2em] text-foreground/80">{TAB_META[tab].label}</span>
                    {" · "}{relativeTime(r.decided_at)}
                    <span className="text-muted-foreground/60"> ({fmt(r.decided_at)})</span>
                    {r.decision_note ? (
                      <div className="mt-1 inline-flex items-start gap-1.5">
                        <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground/70" />
                        <span className="text-foreground">{r.decision_note}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
