import { useEffect, useRef, useState } from "react";
import { Terminal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isBossProfile } from "@/lib/roles";
import { useGlobalMood } from "@/hooks/use-global-mood";
import { SkeletonShimmer } from "./SkeletonShimmer";

type LogRow = {
  id: string;
  source: string;
  level: string;
  message: string;
  mood: string | null;
  created_at: string;
};

/**
 * Floating Enforcer Console.
 * - Streams `ai_logs` via Supabase Realtime
 * - Renders each log line with a typewriter effect
 * - Boss-only visibility
 */
export function EnforcerConsole() {
  const { profile, isAdmin, loading } = useAuth();
  const isBoss = isBossProfile(profile, { isAdmin });
  const { mood } = useGlobalMood();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !isBoss) return;
    let alive = true;

    supabase
      .from("ai_logs")
      .select("id, source, level, message, mood, created_at")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (!alive) return;
        setRows(((data as LogRow[]) ?? []).reverse());
        setHydrating(false);
      });

    const channel = supabase
      .channel("ai-logs-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_logs" },
        (payload: any) => {
          const row = payload.new as LogRow;
          setRows((rs) => [...rs.slice(-80), row]);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [isBoss, loading]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [rows.length]);

  if (loading || !isBoss) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="btn-magnetic fixed bottom-24 right-4 z-[70] glass-obsidian-strong rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] flex items-center gap-2"
          style={{ color: "var(--syndicate-glow)" }}
        >
          <Terminal className="h-4 w-4 neon-icon" /> Enforcer
        </button>
      )}
      {open && (
        <div className="fixed bottom-24 right-4 z-[70] w-[min(420px,calc(100vw-2rem))] glass-obsidian-strong rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <div className="flex items-center gap-2 syndicate-header text-[11px]" style={{ color: "var(--syndicate-glow)" }}>
              <Terminal className="h-3.5 w-3.5 neon-icon" />
              Enforcer Console · {mood.toUpperCase()}
            </div>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={scrollRef}
            className="terminal-mono text-[12px] p-3 max-h-[55vh] min-h-[260px] overflow-y-auto space-y-1 bg-black/60"
          >
            {hydrating && (
              <div className="space-y-2">
                <SkeletonShimmer className="h-3 w-3/4" />
                <SkeletonShimmer className="h-3 w-1/2" />
                <SkeletonShimmer className="h-3 w-2/3" />
              </div>
            )}
            {!hydrating && rows.length === 0 && (
              <div className="text-white/40 italic">// awaiting agent transmissions…</div>
            )}
            {rows.map((r) => (
              <TypewriterLine key={r.id} row={r} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function TypewriterLine({ row }: { row: LogRow }) {
  const [shown, setShown] = useState("");
  const full = `[${new Date(row.created_at).toLocaleTimeString()}] ${row.source}/${row.level.toUpperCase()} ▸ ${row.message}`;

  useEffect(() => {
    let i = 0;
    setShown("");
    const speed = Math.max(8, Math.min(22, 600 / full.length));
    const id = window.setInterval(() => {
      i += 1;
      setShown(full.slice(0, i));
      if (i >= full.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [full]);

  const tone =
    row.level === "error"
      ? "text-rose-300"
      : row.level === "warn"
      ? "text-amber-300"
      : "text-white/85";
  return (
    <div className={tone}>
      <span style={{ color: "var(--syndicate-glow)" }}>›</span> {shown}
      <span className="opacity-60 animate-pulse">▌</span>
    </div>
  );
}