import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { swearChat, setSwearChat } from "@/lib/swear-chat.functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Send, Power, Skull, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export function SwearChatPanel({
  enabled,
  table,
  id,
  slug,
  accent = "#ff2e55",
}: {
  enabled: boolean;
  table: "portals" | "battles" | "custom_hubs";
  id: string;
  slug?: string;
  accent?: string;
}) {
  const { profile } = useAuth();
  const isBoss = profile?.rank === "boss";
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const sendFn = useServerFn(swearChat);
  const toggleFn = useServerFn(setSwearChat);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOn(enabled), [enabled]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, sending]);

  const toggle = async () => {
    setBusy(true);
    try {
      await toggleFn({ data: { table, id, enabled: !on } });
      setOn(!on);
      toast.success(!on ? "Swear chat ARMED" : "Swear chat muzzled");
    } catch (e: any) {
      toast.error(e?.message ?? "Toggle failed");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setDraft("");
    setSending(true);
    try {
      const { reply } = await sendFn({ data: { messages: next, portal_slug: slug } });
      setMsgs((m) => [...m, { role: "assistant", content: reply || "(silence — even I'm speechless, fuck me)" }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Chat failed");
      setMsgs((m) => [...m, { role: "assistant", content: `🚨 ${e?.message ?? "shit broke"}` }]);
    } finally {
      setSending(false);
    }
  };

  if (!on && !isBoss) return null;

  return (
    <section
      className="mt-10 rounded-2xl border bg-black/40 backdrop-blur overflow-hidden"
      style={{ borderColor: `${accent}55`, boxShadow: `0 0 40px -20px ${accent}` }}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: `${accent}33` }}>
        <div className="flex items-center gap-2 min-w-0">
          <Skull className="h-4 w-4" style={{ color: accent }} />
          <p className="text-xs uppercase tracking-[0.3em] font-bold truncate" style={{ color: accent }}>
            Guttermouth · Swear Chat
          </p>
        </div>
        {isBoss && (
          <button
            onClick={toggle}
            disabled={busy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border transition"
            style={{
              borderColor: on ? "#22c55e88" : "#71717a55",
              background: on ? "#22c55e22" : "#71717a11",
              color: on ? "#22c55e" : "#a1a1aa",
            }}
          >
            <Power className="h-3 w-3" />
            {busy ? "…" : on ? "ON" : "OFF"}
          </button>
        )}
      </header>

      {on ? (
        <>
          <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto px-4 py-4 space-y-3 text-sm">
            {msgs.length === 0 && (
              <p className="text-center text-xs text-white/40 py-8">
                Type something and Guttermouth will rip you a new one. No filter, no mercy.
              </p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`max-w-[88%] rounded-xl px-3 py-2 whitespace-pre-wrap leading-relaxed ${
                  m.role === "user" ? "ml-auto bg-white/8 text-white/90" : "mr-auto text-white/95"
                }`}
                style={
                  m.role === "assistant"
                    ? { background: `${accent}18`, border: `1px solid ${accent}44` }
                    : undefined
                }
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Loader2 className="h-3 w-3 animate-spin" /> guttermouth is sharpening teeth…
              </div>
            )}
          </div>
          <div className="flex gap-2 px-3 py-3 border-t" style={{ borderColor: `${accent}33` }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Talk shit. Get shit talked back."
              className="flex-1 resize-none bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ caretColor: accent }}
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="px-3 rounded-md font-bold text-xs uppercase tracking-wider disabled:opacity-40"
              style={{ background: accent, color: "#0a0a0a" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-6 text-center text-xs text-white/50">
          Swear chat is OFF for this portal. Boss can flip it on with the switch above.
        </div>
      )}
    </section>
  );
}
