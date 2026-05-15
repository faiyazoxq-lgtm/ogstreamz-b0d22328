import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Crown, Tv, Receipt, CheckSquare, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listPassOrders, decidePassOrder, type PassOrderRow } from "@/lib/overlord.functions";
import { coinChip } from "@/lib/coins";
import { CoinChip } from "@/components/CoinChip";
import { useCreditsMap } from "@/hooks/use-credits-map";

type StatusFilter = "pending_approval" | "issued" | "denied" | "all";

function fmtMoney(cents: number, currency: string) {
  try {
    const base = new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "gbp").toUpperCase() }).format((cents ?? 0) / 100);
    return (currency || "gbp").toLowerCase() === "gbp" ? `${base} ${coinChip(cents)}` : base;
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency?.toUpperCase() ?? ""} ${coinChip(cents)}`;
  }
}

function kindMeta(kind: string) {
  if (kind === "vip_pass") return { label: "VIP Pass", icon: Crown, tint: "text-amber-300 border-amber-700/50 bg-amber-500/10" };
  if (kind === "streams_pass") return { label: "Streams Pass", icon: Tv, tint: "text-cyan-300 border-cyan-700/50 bg-cyan-500/10" };
  if (kind === "real_og") return { label: "Real OG", icon: Crown, tint: "text-fuchsia-300 border-fuchsia-700/50 bg-fuchsia-500/10" };
  return { label: kind, icon: Receipt, tint: "text-emerald-300 border-emerald-700/50 bg-emerald-500/10" };
}

function statusBadge(status: string) {
  if (status === "pending_approval") return <Badge className="bg-yellow-500/20 text-yellow-200 border border-yellow-700/50 uppercase tracking-wider">Pending</Badge>;
  if (status === "issued") return <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-700/50 uppercase tracking-wider">Issued</Badge>;
  if (status === "denied") return <Badge className="bg-red-500/20 text-red-200 border border-red-700/50 uppercase tracking-wider">Denied</Badge>;
  return <Badge variant="outline" className="uppercase tracking-wider">{status}</Badge>;
}

export function PassOrdersPanel() {
  const list = useServerFn(listPassOrders);
  const decide = useServerFn(decidePassOrder);
  const [status, setStatus] = useState<StatusFilter>("pending_approval");
  const [rows, setRows] = useState<PassOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastRun, setLastRun] = useState<{
    approve: boolean;
    note: string;
    failed: { id: string; error: string }[];
  } | null>(null);

  const creditsMap = useCreditsMap(rows.map((r) => r.user_id));

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list({ data: { status } });
      setRows(r.orders);
      setSelected((prev) => {
        const ids = new Set(r.orders.filter(o => o.status === "pending_approval").map(o => o.id));
        const next = new Set<string>();
        prev.forEach((id) => { if (ids.has(id)) next.add(id); });
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load pass orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [status]);

  const pendingCount = useMemo(() => rows.filter(r => r.status === "pending_approval").length, [rows]);
  const pendingRows = useMemo(() => rows.filter(r => r.status === "pending_approval"), [rows]);
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every(r => selected.has(r.id));
  const somePendingSelected = selected.size > 0 && !allPendingSelected;

  const toggleOne = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allPendingSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingRows.map(r => r.id)));
    }
  };

  const runBulk = async (approve: boolean, ids: string[], note: string) => {
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    const failed: { id: string; error: string }[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        await decide({ data: { orderId: id, approve, note: note || (notes[id] ?? "") } });
        ok++;
      } catch (e: any) {
        failed.push({ id, error: e?.message ?? "Action failed" });
        console.error("bulk decide failed", id, e);
      }
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkBusy(false);
    setBulkProgress(null);
    setLastRun({ approve, note, failed });
    if (failed.length === 0) {
      toast.success(`${approve ? "Issued" : "Denied"} ${ok} order${ok === 1 ? "" : "s"}`);
    } else {
      toast.warning(`${ok} done · ${failed.length} failed — use Retry failed`);
    }
    await refresh();
    return failed;
  };

  const bulkAct = async (approve: boolean) => {
    if (selected.size === 0) return;
    const ids = pendingRows.filter(r => selected.has(r.id)).map(r => r.id);
    if (ids.length === 0) {
      toast.error("No pending orders selected");
      return;
    }
    const verb = approve ? "Issue" : "Deny";
    if (!window.confirm(`${verb} ${ids.length} pass order${ids.length === 1 ? "" : "s"}?`)) return;
    const note = bulkNote;
    await runBulk(approve, ids, note);
    setSelected(new Set());
    setBulkNote("");
  };

  const retryFailed = async () => {
    if (!lastRun || lastRun.failed.length === 0) return;
    const stillPending = new Set(pendingRows.map(r => r.id));
    const ids = lastRun.failed.map(f => f.id).filter(id => stillPending.has(id));
    if (ids.length === 0) {
      toast.info("No failed orders are still pending");
      setLastRun((p) => p ? { ...p, failed: [] } : p);
      return;
    }
    const verb = lastRun.approve ? "re-issue" : "re-deny";
    if (!window.confirm(`Retry ${verb} on ${ids.length} failed order${ids.length === 1 ? "" : "s"}?`)) return;
    await runBulk(lastRun.approve, ids, lastRun.note);
  };

  const act = async (orderId: string, approve: boolean) => {
    setBusy(orderId);
    try {
      const r: any = await decide({ data: { orderId, approve, note: notes[orderId] ?? "" } });
      if (r?.status === "issued") {
        toast.success(`Pass issued: ${r.pass_number}`);
      } else if (r?.status === "denied") {
        toast.success("Order denied");
      } else {
        toast.success("Done");
      }
      setNotes((n) => { const cp = { ...n }; delete cp[orderId]; return cp; });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-800/40 bg-black/60 backdrop-blur p-5 sm:p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-cyan-200 flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Pass Orders
            <span className="text-xs text-yellow-300 font-bold uppercase tracking-[0.3em] ml-2">
              {pendingCount} pending
            </span>
          </h3>
          <p className="text-sm text-emerald-400/80 mt-1">
            Approve a paid order to mint and issue the actual VIP / Streams pass.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-44 h-10 bg-black/70 border-2 border-emerald-800/50 text-emerald-100 font-bold uppercase tracking-wider text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_approval">Pending</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={refresh}
            variant="outline"
            className="h-10 border-emerald-800/50 text-emerald-200 hover:bg-emerald-900/30 uppercase tracking-wider text-xs font-black"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-12 text-center text-emerald-400/70">
          <Loader2 className="h-6 w-6 animate-spin inline-block" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-emerald-500/70 border border-dashed border-emerald-800/40 rounded-xl">
          <Clock className="h-6 w-6 mx-auto mb-2 opacity-60" />
          No {status === "all" ? "" : status.replace("_", " ")} orders.
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRows.length > 0 && (
            <div className="rounded-xl border-2 border-cyan-800/40 bg-cyan-950/20 p-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] font-black text-cyan-200 hover:text-cyan-100"
              >
                {allPendingSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allPendingSelected ? "Clear" : somePendingSelected ? "Select all pending" : "Select all pending"}
              </button>
              <span className="text-[11px] text-cyan-400/80 font-bold">
                {selected.size} selected / {pendingRows.length} pending
              </span>
              <Input
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Bulk note (overrides per-row notes)"
                className="flex-1 min-w-[180px] h-9 bg-black/70 border-2 border-emerald-800/50 text-emerald-100 placeholder:text-emerald-700 text-xs"
                disabled={bulkBusy}
              />
              <Button
                onClick={() => bulkAct(true)}
                disabled={bulkBusy || selected.size === 0}
                className="h-9 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase tracking-wider text-xs"
              >
                {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Approve {selected.size > 0 ? `(${selected.size})` : ""}
              </Button>
              <Button
                onClick={() => bulkAct(false)}
                disabled={bulkBusy || selected.size === 0}
                variant="outline"
                className="h-9 border-red-700/60 text-red-200 hover:bg-red-900/30 font-black uppercase tracking-wider text-xs"
              >
                <XCircle className="h-4 w-4 mr-1" /> Deny {selected.size > 0 ? `(${selected.size})` : ""}
              </Button>
              {bulkProgress && (
                <span className="w-full text-[10px] uppercase tracking-[0.3em] text-cyan-300 font-bold">
                  Processing {bulkProgress.done} / {bulkProgress.total}…
                </span>
              )}
              {lastRun && lastRun.failed.length > 0 && !bulkBusy && (
                <div className="w-full flex flex-wrap items-center gap-2 pt-2 border-t border-red-900/40">
                  <span className="text-[11px] uppercase tracking-[0.25em] font-black text-red-300">
                    Last run: {lastRun.failed.length} failed ({lastRun.approve ? "issue" : "deny"})
                  </span>
                  <Button
                    onClick={retryFailed}
                    disabled={bulkBusy}
                    variant="outline"
                    className="h-8 border-yellow-700/60 text-yellow-200 hover:bg-yellow-900/30 font-black uppercase tracking-wider text-[11px]"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry failed ({lastRun.failed.length})
                  </Button>
                  <Button
                    onClick={() => setLastRun(null)}
                    variant="ghost"
                    className="h-8 text-emerald-400/70 hover:text-emerald-200 uppercase tracking-wider text-[11px] font-bold"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          )}
          {rows.map((o) => {
            const meta = kindMeta(o.kind);
            const KindIcon = meta.icon;
            const isPending = o.status === "pending_approval";
            const isSelected = selected.has(o.id);
            return (
              <div
                key={o.id}
                className={`rounded-xl border-2 p-4 transition-colors ${
                  isSelected
                    ? "border-cyan-500/70 bg-cyan-950/30"
                    : "border-emerald-800/40 bg-emerald-950/30 hover:border-cyan-700/50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {isPending && (
                    <div className="pt-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) => toggleOne(o.id, !!v)}
                        disabled={bulkBusy}
                        aria-label="Select order"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${meta.tint} text-[10px] uppercase tracking-[0.3em] font-black`}>
                        <KindIcon className="h-3 w-3" /> {meta.label}
                      </span>
                      {statusBadge(o.status)}
                      <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-500/70 font-bold">
                        {o.duration_days}d · {fmtMoney(o.amount_cents, o.currency)} · {o.environment}
                      </span>
                    </div>
                    <div className="text-sm text-emerald-100 font-bold truncate">
                      {o.display_name || o.email || o.user_id}
                    </div>
                    <div className="mt-1">
                      <CoinChip credits={creditsMap[o.user_id] ?? 0} />
                    </div>
                    {o.email && o.display_name ? (
                      <div className="text-xs text-emerald-400/70 truncate">{o.email}</div>
                    ) : null}
                    <div className="text-[11px] text-emerald-600 mt-1 font-mono truncate">
                      {new Date(o.created_at).toLocaleString()} · session {o.stripe_session_id.slice(-12)}
                      {o.pass_number ? ` · ${o.pass_number}` : ""}
                    </div>
                    {o.boss_decision_note ? (
                      <div className="text-xs text-cyan-300/80 mt-1 italic">Note: {o.boss_decision_note}</div>
                    ) : null}
                  </div>
                </div>

                {isPending && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Input
                      value={notes[o.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [o.id]: e.target.value }))}
                      placeholder="Optional note (visible in receipt)"
                      className="h-10 bg-black/70 border-2 border-emerald-800/50 text-emerald-100 placeholder:text-emerald-700 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => act(o.id, true)}
                        disabled={busy === o.id}
                        className="h-10 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase tracking-wider text-xs"
                      >
                        {busy === o.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        Approve & issue
                      </Button>
                      <Button
                        onClick={() => act(o.id, false)}
                        disabled={busy === o.id}
                        variant="outline"
                        className="h-10 border-red-700/60 text-red-200 hover:bg-red-900/30 font-black uppercase tracking-wider text-xs"
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Deny
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}