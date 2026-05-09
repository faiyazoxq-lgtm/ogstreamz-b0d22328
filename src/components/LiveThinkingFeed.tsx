import { useEffect, useState } from "react";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalMood } from "@/hooks/use-global-mood";

type Msg = {
  id: string;
  role: string;
  content: string;
  source: string;
  persona: string | null;
  created_at: string;
};

export function LiveThinkingFeed() {
  const { profile } = useAuth();
  const { mood } = useGlobalMood();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [open, setOpen] = useState(true);

  const isBoss = profile?.rank === "boss";

  useEffect(() => {
    if (!isBoss) return;
    let alive = true;

    async function load() {
      const { data } = await supabase
        .from("boss_chat_messages")
        .select("id, role, content, source, persona, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (!alive || !data) return;
      setMsgs(data as Msg[]);
    }
    load();

    const channel = supabase
      .channel("live-thinking")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "boss_chat_messages" },
        (payload: any) => {
          setMsgs((prev) => [payload.new as Msg, ...prev].slice(0, 8));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [isBoss]);

  if (!isBoss) return null;

  const accent = mood === "og" ? "#ff2e55" : "#ffd166";

  return (
    <div
      className="fixed bottom-24 right-3 z-30 hidden w-[340px] md:block"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="glass-obsidian overflow-hidden rounded-2xl"
        style={{ boxShadow: `0 18px 60px -32px ${accent}` }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
            />
            <span className="syndicate-header text-[11px]" style={{ color: accent }}>
              Live Thinking · Gemini
            </span>
          </div>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-white/60" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-white/60" />
          )}
        </button>
        {open && (
          <div className="max-h-72 space-y-2 overflow-y-auto px-3 pb-3 pt-1">
            {msgs.length === 0 && (
              <p className="terminal-mono text-[11px] text-white/50">
                {">"} awaiting agent traffic…
              </p>
            )}
            {msgs.map((m) => (
              <div key={m.id} className="rounded-lg border border-white/5 bg-black/40 p-2">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-white/45">
                  <span>
                    {m.source} · {m.role}
                  </span>
                  <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="terminal-mono mt-1 line-clamp-3 text-[11px] leading-snug text-white/80">
                  {m.content}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-white/5 px-3 py-1.5">
          <span className="terminal-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
            Mood
          </span>
          <Brain className="h-3 w-3" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}