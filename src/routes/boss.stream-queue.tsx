import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Tv, CheckCircle2, XCircle, Loader2, RefreshCw, Clock, AlertTriangle, ShieldCheck, Lock, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
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
    try {
      await decideStreamReqFn({ data: { id, approve, note: noteFor[id] ?? undefined } });
    } catch (e: any) {
      setBusyId(null);
      alert(e?.message ?? "Failed");
      return;
    }
    setBusyId(null);
    await load();
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Tv className="h-5 w-5 text-gold" />
          <h1 className="font-[Montserrat] font-black text-2xl text-metallic">Stream Verification Queue</h1>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border bg-secondary/60 hover:bg-secondary">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-md border ${tab === t ? "bg-primary text-primary-foreground border-primary" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No {tab} requests.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const autoOk = (r.auto_status ?? "").toLowerCase() === "active";
            return (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{r.email || r.user_id}</span>
                      <CoinChip credits={creditsMap[r.user_id]} />
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Current rank: <span className="text-foreground">{r.rank ?? "—"}</span> · Submitted {fmt(r.created_at)}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
                      autoOk
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {autoOk ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    Auto-check: {r.auto_status || "Unknown"}
                    {r.auto_expires_at && <> · <Clock className="h-3 w-3" />{new Date(r.auto_expires_at).toLocaleDateString()}</>}
                  </span>
                </div>

                <div className="mt-3 grid sm:grid-cols-3 gap-2 text-sm">
                  <div className="rounded-md bg-secondary/40 border border-border px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Username</div>
                    <div className="font-mono text-xs break-all">{r.username}</div>
                  </div>
                  <div className="rounded-md bg-secondary/40 border border-border px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Password</div>
                    <div className="font-mono text-xs break-all inline-flex items-center gap-1.5 text-muted-foreground">
                      {r.has_password
                        ? (<><KeyRound className="h-3 w-3" /> encrypted at rest</>)
                        : (<><Lock className="h-3 w-3" /> scrubbed</>)}
                    </div>
                  </div>
                </div>

                {tab === "pending" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={noteFor[r.id] ?? ""}
                      onChange={(e) => setNoteFor((s) => ({ ...s, [r.id]: e.target.value }))}
                      placeholder="Decision note (optional)"
                      className="flex-1 min-w-[200px] bg-background/60 border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, true)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve & Promote
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, false)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    Decided {fmt(r.decided_at)}
                    {r.decision_note ? <> · note: <span className="text-foreground">{r.decision_note}</span></> : null}
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
