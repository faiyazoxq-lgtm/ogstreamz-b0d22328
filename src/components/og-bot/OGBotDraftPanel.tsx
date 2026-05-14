import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Send, Sparkles, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ogBotDraft } from "@/lib/og-bot-draft.functions";

export type OGBotDraftFields = {
  name?: string;
  niche?: string;
  vibe?: string;
  language?: string;
};

type Msg = { role: "user" | "assistant"; content: string };

/**
 * OG Bot draft panel — drop-in chat UI that lets the bot draft the
 * fields for the host form. The bot reads per-user memory + the user's
 * own portals (RLS-scoped), asks 0-2 clarifying questions, then emits
 * a structured draft. The host applies it to its inputs via onApply.
 */
export function OGBotDraftPanel(props: {
  surface: "portal-create";
  kind?: "jokes" | "music" | "trade" | "connect" | "tools";
  /** Host hands the bot's draft fields back into its own form state. */
  onApply: (fields: OGBotDraftFields) => void;
  /** Optional intro shown above the chat */
  intro?: string;
}) {
  const draftFn = useServerFn(ogBotDraft);
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [memoryNote, setMemoryNote] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history.length, sending]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || sending) return;
    setInput("");
    const next: Msg[] = [...history, { role: "user", content: msg }];
    setHistory(next);
    setSending(true);
    try {
      const r = await draftFn({
        data: {
          surface: props.surface,
          kind: props.kind,
          message: msg,
          history: next.slice(0, -1).slice(-10),
        },
      });
      setHistory((h) => [...h, { role: "assistant", content: r.reply }]);
      if (r.memoryAdded.length) setMemoryNote(r.memoryAdded);
      if (r.draft) {
        props.onApply({
          name: r.draft.name,
          niche: r.draft.niche,
          vibe: r.draft.vibe,
          language: r.draft.language,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bot tripped over its own laces.";
      setHistory((h) => [...h, { role: "assistant", content: msg }]);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <div className="rounded-xl border border-[oklch(0.72_0.22_245/0.45)] bg-gradient-to-br from-[oklch(0.72_0.22_245/0.10)] via-background/60 to-background/30 p-3 sm:p-4 shadow-[0_20px_60px_-30px_oklch(0.72_0.22_245/0.6)]">
      <header className="mb-2 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg border border-[oklch(0.72_0.22_245/0.55)] bg-[oklch(0.72_0.22_245/0.18)] inline-flex items-center justify-center">
          <Bot className="h-4 w-4" style={{ color: "var(--neon-blue-bright, #6cb6ff)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-foreground/80">
            OG Bot · drafting for you
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {props.intro ?? "Tell me roughly what you want — I'll fill the form."}
          </p>
        </div>
        {memoryNote.length > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300 border border-emerald-300/40 bg-emerald-300/10 rounded-full px-2 py-0.5"
            title={`Remembered: ${memoryNote.join(" · ")}`}
          >
            <Brain className="h-3 w-3" /> +{memoryNote.length}
          </span>
        )}
      </header>

      <div
        ref={scrollRef}
        className="max-h-56 min-h-[80px] overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2 space-y-2 text-sm"
        aria-live="polite"
      >
        {history.length === 0 && !sending && (
          <p className="text-xs text-muted-foreground italic px-1">
            Try: <span className="text-foreground/80">"Northern grime jokes for the bus"</span>{" "}
            or just <span className="text-foreground/80">"surprise me"</span>.
          </p>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 text-right text-foreground/90"
                : "mr-6 text-foreground/90"
            }
          >
            <span
              className={
                "inline-block rounded-lg px-2.5 py-1.5 leading-snug " +
                (m.role === "user"
                  ? "bg-white/10 border border-white/15"
                  : "bg-[oklch(0.72_0.22_245/0.15)] border border-[oklch(0.72_0.22_245/0.4)]")
              }
            >
              {m.content}
            </span>
          </div>
        ))}
        {sending && (
          <div className="mr-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> OG Bot is thinking…
          </div>
        )}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          maxLength={1000}
          disabled={sending}
          placeholder="Talk to OG Bot…"
          className="flex-1 resize-none rounded-lg border border-white/15 bg-background/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.72_0.22_245/0.6)]"
        />
        <Button
          type="button"
          onClick={() => void send(input)}
          disabled={sending || !input.trim()}
          className="bg-[oklch(0.72_0.22_245)] hover:bg-[oklch(0.78_0.22_245)] text-white"
          size="sm"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 inline-flex items-center gap-1">
        <Sparkles className="h-3 w-3" /> Memory is yours alone · bot only sees your own portals
      </p>
    </div>
  );
}