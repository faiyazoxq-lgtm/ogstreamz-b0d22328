import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  X,
  Coins,
  Heart,
  UserPlus,
  Trash2,
  RefreshCw,
  Inbox,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoinChip } from "@/components/CoinChip";
import { useCreditsMap } from "@/hooks/use-credits-map";
import {
  bossListTopupRequests,
  bossApproveTopup,
  bossDenyTopup,
  bossListFriendsFamily,
  bossSetFriendsFamily,
} from "@/lib/topup-requests.functions";

type Req = {
  id: string;
  user_id: string;
  email: string | null;
  credits_requested: number;
  reason: string;
  status: string;
  credits_granted: number | null;
  decision_note: string | null;
  created_at: string;
};

type Friend = {
  id: string;
  email: string;
  credits: number;
  feature_flags: any;
};

const FILTERS = [
  { key: "pending", label: "Pending", tint: "#fbbf24" },
  { key: "approved", label: "Approved", tint: "#34d399" },
  { key: "denied", label: "Denied", tint: "#f87171" },
  { key: "all", label: "All", tint: "#94a3b8" },
] as const;

export function TopUpRequestsPanel() {
  const list = useServerFn(bossListTopupRequests);
  const approve = useServerFn(bossApproveTopup);
  const deny = useServerFn(bossDenyTopup);
  const listFF = useServerFn(bossListFriendsFamily);
  const setFF = useServerFn(bossSetFriendsFamily);

  const [requests, setRequests] = useState<Req[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "denied" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [grants, setGrants] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [newEmail, setNewEmail] = useState("");
  const [ffOpen, setFfOpen] = useState(false);

  const reqCredits = useCreditsMap(requests.map((r) => r.user_id));

  const refresh = async () => {
    try {
      const [r, f] = await Promise.all([list({ data: { status: filter } }), listFF()]);
      setRequests((r as any).requests);
      setFriends((f as any).friends);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, [filter]);

  const onApprove = async (req: Req) => {
    setBusy(req.id);
    try {
      const credits = grants[req.id] ?? req.credits_requested;
      const res = await approve({ data: { id: req.id, credits, note: notes[req.id] ?? "" } });
      toast.success(`Approved · +${(res as any).credits} credits`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const onDeny = async (req: Req) => {
    setBusy(req.id);
    try {
      await deny({ data: { id: req.id, note: notes[req.id] ?? "" } });
      toast.success("Denied");
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const addFriend = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setBusy("add-friend");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email")
        .ilike("email", email)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No member found with that email");
      await setFF({ data: { userId: (data as any).id, enabled: true } });
      toast.success(`${email} added to Friends & Family`);
      setNewEmail("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const removeFriend = async (id: string, email: string) => {
    setBusy(id);
    try {
      await setFF({ data: { userId: id, enabled: false } });
      toast.success(`${email} removed`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* === Top-up Queue === */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4" style={{ color: "#ff5577" }} />
            <h3 className="font-[Montserrat] font-black text-lg text-white">
              Top-Up Queue
            </h3>
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] font-bold bg-white/10 text-white/70"
              title={`${requests.length} visible`}
            >
              {requests.length}
            </span>
            {filter === "pending" && pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <AlertCircle className="h-3 w-3" />
                {pendingCount} awaiting action
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            className="text-xs uppercase tracking-[0.2em]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count =
              f.key === "all"
                ? requests.length
                : requests.filter((r) => r.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as typeof filter)}
                className={
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] transition-colors border " +
                  (active
                    ? "bg-white/10 text-white border-white/20"
                    : "bg-secondary/40 text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/60")
                }
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: f.tint }}
                />
                {f.label}
                <span className="text-white/40 font-mono text-[9px]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Requests */}
        <div className="space-y-3">
          {requests.length === 0 && (
            <div className="rounded-xl border border-white/5 bg-background/30 px-4 py-8 text-center">
              <Inbox className="h-5 w-5 text-white/25 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground italic">
                No {filter === "all" ? "" : filter + " "}requests.
              </p>
            </div>
          )}
          {requests.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              currentCredits={reqCredits[req.user_id]}
              busy={busy}
              grant={grants[req.id]}
              note={notes[req.id] ?? ""}
              onGrantChange={(v) => setGrants((g) => ({ ...g, [req.id]: v }))}
              onNoteChange={(v) => setNotes((n) => ({ ...n, [req.id]: v }))}
              onApprove={() => onApprove(req)}
              onDeny={() => onDeny(req)}
            />
          ))}
        </div>
      </div>

      {/* === Friends & Family === */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
        <button
          onClick={() => setFfOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-400" />
            <h3 className="font-[Montserrat] font-black text-base text-white">
              Friends &amp; Family
            </h3>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {friends.length} member{friends.length !== 1 ? "s" : ""}
            </span>
          </div>
          {ffOpen ? (
            <ChevronUp className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
          )}
        </button>

        {ffOpen && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <Input
                placeholder="member@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-background/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addFriend();
                }}
              />
              <Button
                onClick={addFriend}
                disabled={busy === "add-friend"}
                className="btn-glass-blue text-xs uppercase tracking-[0.2em] font-bold text-white shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-1.5">
              {friends.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">
                  No Friends &amp; Family members yet.
                </p>
              ) : (
                friends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-background/40 border border-white/5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Heart className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                      <span className="text-sm font-mono truncate min-w-0">{f.email}</span>
                      <CoinChip credits={f.credits} />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === f.id}
                      onClick={() => removeFriend(f.id, f.email)}
                      className="text-rose-400 hover:text-rose-300 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Request card ─────────────────────────────────────────────── */

function RequestCard({
  req,
  currentCredits,
  busy,
  grant,
  note,
  onGrantChange,
  onNoteChange,
  onApprove,
  onDeny,
}: {
  req: Req;
  currentCredits: number | undefined;
  busy: string | null;
  grant: number | undefined;
  note: string;
  onGrantChange: (v: number) => void;
  onNoteChange: (v: string) => void;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const isPending = req.status === "pending";
  const isApproved = req.status === "approved";
  const isDenied = req.status === "denied";
  const resolved = !isPending;

  const statusBadge = isPending
    ? { icon: AlertCircle, text: "Pending", bg: "bg-amber-500/15", border: "border-amber-500/30", color: "text-amber-300" }
    : isApproved
    ? { icon: CheckCircle2, text: "Approved", bg: "bg-emerald-500/15", border: "border-emerald-500/30", color: "text-emerald-300" }
    : { icon: XCircle, text: "Denied", bg: "bg-rose-500/15", border: "border-rose-500/30", color: "text-rose-300" };

  const StatusIcon = statusBadge.icon;

  return (
    <div
      className={
        "rounded-xl border p-4 space-y-3 transition-colors " +
        (isPending
          ? "border-white/15 bg-background/50"
          : "border-white/5 bg-background/30")
      }
      style={isPending ? { borderLeft: "2px solid #fbbf24" } : undefined}
    >
      {/* Row 1: identity + status + amount */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-mono text-white truncate">{req.email ?? req.user_id}</span>
            {currentCredits !== undefined && <CoinChip credits={currentCredits} />}
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(req.created_at).toLocaleString()}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] font-bold border ${statusBadge.bg} ${statusBadge.border} ${statusBadge.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {statusBadge.text}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-sm">
            <Coins className="h-4 w-4" />
            {req.credits_requested}
          </span>
        </div>
      </div>

      {/* Reason callout */}
      {req.reason && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 flex gap-2 items-start">
          <MessageSquare className="h-3.5 w-3.5 text-white/30 mt-0.5 shrink-0" />
          <p className="text-sm text-white/60 italic leading-relaxed">{req.reason}</p>
        </div>
      )}

      {/* Pending actions */}
      {isPending && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-bold">
              Review &amp; Decide
            </span>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div className="grid sm:grid-cols-[100px_1fr] gap-3">
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold block">
                Grant amount
              </label>
              <Input
                type="number"
                min={1}
                max={1000}
                defaultValue={req.credits_requested}
                onChange={(e) => onGrantChange(Math.max(1, Number(e.target.value)))}
                className="bg-background/60 text-center font-mono h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold block">
                Decision note
              </label>
              <Input
                placeholder="Optional note for the member…"
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                className="bg-background/60 h-9"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy === req.id}
              onClick={onDeny}
              variant="outline"
              className="flex-1 border-rose-400/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 text-xs uppercase tracking-[0.2em] font-bold h-9"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Deny
            </Button>
            <Button
              size="sm"
              disabled={busy === req.id}
              onClick={onApprove}
              className="flex-1 bg-emerald-500/90 hover:bg-emerald-500 text-black font-bold text-xs uppercase tracking-[0.2em] h-9"
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
          </div>
        </div>
      )}

      {/* Resolved summary */}
      {resolved && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
          {isApproved && req.credits_granted ? (
            <span className="inline-flex items-center gap-1 text-emerald-300/80">
              <CheckCircle2 className="h-3 w-3" />
              Granted {req.credits_granted} credits
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-300/80">
              <XCircle className="h-3 w-3" />
              Denied
            </span>
          )}
          {req.decision_note && (
            <span className="border-l border-white/10 pl-3 italic text-white/40">
              “{req.decision_note}”
            </span>
          )}
        </div>
      )}
    </div>
  );
}
