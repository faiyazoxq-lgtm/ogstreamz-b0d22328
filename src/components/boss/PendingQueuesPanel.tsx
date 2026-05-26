import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Inbox, Tv, Music, Coins, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CollapsiblePanel } from "@/components/boss/CollapsiblePanel";

type QueueCounts = {
  topups: number;
  streams: number;
  tracks: number;
  grants: number;
};

type ActionItem = {
  key: keyof QueueCounts;
  label: string;
  to: string;
  hash?: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
  hint: string;
};

/**
 * Canonical pending-action queue summary. Replaces the duplicated "Action
 * Queue" + "Portal Actions" sections that previously lived on /boss/overview
 * and /boss/power.
 */
export function PendingQueuesPanel() {
  const [counts, setCounts] = useState<QueueCounts>({
    topups: 0, streams: 0, tracks: 0, grants: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const head = (q: any) =>
      q.then((r: any) => (r.error ? 0 : Math.max(0, r.count ?? 0)));
    const load = async () => {
      const [topups, streams, tracks, grants] = await Promise.all([
        head(supabase.from("topup_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
        head(supabase.from("stream_verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
        head(supabase.from("custom_track_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
        head(supabase.from("pending_credit_grants").select("*", { count: "exact", head: true })),
      ]);
      if (!cancelled) setCounts({ topups, streams, tracks, grants });
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const items: ActionItem[] = useMemo(() => ([
    { key: "topups",  label: "Top-up requests",       to: "/boss/members", hash: "topups", Icon: Inbox, tint: "#ff5577", hint: "Approve or deny credit top-ups" },
    { key: "streams", label: "Stream verifications",  to: "/boss/stream-queue",            Icon: Tv,    tint: "#3ad6ff", hint: "Confirm 0G STREAMZ portal access" },
    { key: "tracks",  label: "Custom track requests", to: "/admin",        hash: "tracks", Icon: Music, tint: "#a78bfa", hint: "Review user-submitted track briefs" },
    { key: "grants",  label: "Pending credit grants", to: "/boss/members", hash: "roster", Icon: Coins, tint: "#ffd166", hint: "Pre-allocated credits awaiting attach" },
  ]), []);

  const totalQueue = counts.topups + counts.streams + counts.tracks + counts.grants;

  return (
    <CollapsiblePanel
      id="queue"
      title="Action Queue"
      Icon={Inbox}
      tint="#ff5577"
      subtitle="Outstanding requests waiting on a Boss decision"
      badge={
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.2em] tabular-nums"
          style={{
            background: totalQueue > 0 ? "rgba(255,85,119,0.18)" : "rgba(0,224,138,0.12)",
            color: totalQueue > 0 ? "#ff8aa3" : "#7be3b6",
            border: `1px solid ${totalQueue > 0 ? "#ff557766" : "#00e08a55"}`,
          }}
        >
          {totalQueue} open
        </span>
      }
    >
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((a) => {
          const count = counts[a.key];
          const urgent = count > 0;
          return (
            <li key={a.key}>
              <Link
                to={a.to}
                hash={a.hash}
                className="flex items-center gap-3 p-3 group rounded-xl border transition active:scale-[0.99]"
                style={{
                  borderColor: urgent ? `${a.tint}55` : "rgba(255,255,255,0.06)",
                  background: urgent ? `${a.tint}10` : "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${a.tint}1f`, border: `1px solid ${a.tint}55` }}
                >
                  <a.Icon className="h-4 w-4" style={{ color: a.tint }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white/95 truncate tracking-tight">{a.label}</div>
                  <div className="text-[11px] text-white/50 truncate">{a.hint}</div>
                </div>
                <span
                  className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full text-xs font-extrabold tabular-nums"
                  style={{
                    background: urgent ? `${a.tint}25` : "rgba(255,255,255,0.04)",
                    color: urgent ? a.tint : "rgba(255,255,255,0.45)",
                    border: `1px solid ${urgent ? a.tint + "66" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: urgent ? `0 0 12px -3px ${a.tint}66` : "none",
                  }}
                >
                  {count}
                </span>
                <ArrowUpRight className="h-4 w-4 text-white/30 group-hover:text-white/70 transition" />
              </Link>
            </li>
          );
        })}
      </ul>
    </CollapsiblePanel>
  );
}