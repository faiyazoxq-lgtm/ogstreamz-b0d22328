import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Coins, Heart, UserPlus, Trash2, RefreshCw } from "lucide-react";
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
      // Find profile by email
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-400" />
          <h3 className="font-[Montserrat] font-black text-lg text-white">
            Friends &amp; Family · Free Top-Ups
          </h3>
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

      {/* Friends & Family roster */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
          Friends &amp; Family roster ({friends.length})
        </div>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="member@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="bg-background/40"
          />
          <Button
            onClick={addFriend}
            disabled={busy === "add-friend"}
            className="btn-glass-blue text-xs uppercase tracking-[0.2em] font-bold text-white"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
        <div className="space-y-1.5">
          {friends.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No Friends &amp; Family members yet.</p>
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
                  className="text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(["pending", "approved", "denied", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.2em] transition-colors " +
              (filter === s
                ? "bg-[var(--syndicate-glow,#00F2FF)] text-black"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground")
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* Requests */}
      <div className="space-y-3">
        {requests.length === 0 && (
          <p className="text-sm text-muted-foreground italic px-2 py-4 text-center">
            No {filter} requests.
          </p>
        )}
        {requests.map((req) => (
          <div
            key={req.id}
            className="rounded-xl border border-white/10 bg-background/40 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-mono text-white truncate">{req.email ?? req.user_id}</span>
                  <CoinChip credits={reqCredits[req.user_id]} />
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
                  {new Date(req.created_at).toLocaleString()} · status:{" "}
                  <span
                    className={
                      req.status === "pending"
                        ? "text-amber-400"
                        : req.status === "approved"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {req.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Coins className="h-4 w-4" />
                <span>{req.credits_requested}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                  requested
                </span>
              </div>
            </div>
            {req.reason && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-rose-400/40 pl-3">
                "{req.reason}"
              </p>
            )}
            {req.status === "pending" && (
              <div className="grid sm:grid-cols-[120px_1fr_auto_auto] gap-2 items-center">
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  defaultValue={req.credits_requested}
                  onChange={(e) =>
                    setGrants((g) => ({ ...g, [req.id]: Math.max(1, Number(e.target.value)) }))
                  }
                  className="bg-background/60 text-center font-mono"
                />
                <Input
                  placeholder="Note (optional)"
                  value={notes[req.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                  className="bg-background/60"
                />
                <Button
                  size="sm"
                  disabled={busy === req.id}
                  onClick={() => onApprove(req)}
                  className="bg-emerald-500/90 hover:bg-emerald-500 text-black font-bold text-xs uppercase tracking-[0.2em]"
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === req.id}
                  onClick={() => onDeny(req)}
                  className="border-rose-400/40 text-rose-300 hover:bg-rose-500/10 text-xs uppercase tracking-[0.2em]"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Deny
                </Button>
              </div>
            )}
            {req.status !== "pending" && (
              <div className="text-xs text-muted-foreground">
                {req.credits_granted ? `Granted ${req.credits_granted} credits` : "Denied"}
                {req.decision_note ? ` · "${req.decision_note}"` : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}