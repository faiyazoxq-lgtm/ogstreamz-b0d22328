import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Link } from "@tanstack/react-router";
import { Send, Skull, Loader2, Compass, Flame } from "lucide-react";
import { siteGuideChat } from "@/lib/site-guide.functions";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "My stream stopped working",
  "Where do I top up credits?",
  "How do I renew my pass?",
  "I forgot my password",
  "I want to make money fast",
  "How do I become VIP?",
  "Show me everything music-related",
  "I'm lost — where do I start?",
];

// Render markdown links to internal routes as TanStack <Link> so navigation
// stays SPA (no full page reload). External / hash / mailto stay as <a>.
function MarkdownLink({ href, children, ...rest }: any) {
  const url = String(href ?? "");
  const isInternal = url.startsWith("/") && !url.startsWith("//");
  if (isInternal) {
    return (
      <Link
        to={url as never}
        className="underline decoration-dotted underline-offset-2 hover:text-white"
        style={{ color: "#ffb3c1" }}
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-white"
      {...rest}
    >
      {children}
    </a>
  );
}

export function SiteGuideSwearChat() {
  const send = useServerFn(siteGuideChat);
  const [draft, setDraft] = useState("");
  const [chaos, setChaos] = useState(false);
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, sending]);

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || sending) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setDraft("");
    setSending(true);
    try {
      const { reply } = await send({ data: { messages: next, chaos } });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `🚨 ${e?.message ?? "shit broke"}` }]);
    } finally {
      setSending(false);
    }
  };

  const accent = "#ff2e55";

  return (
    <section
      className="rounded-2xl border bg-black/50 backdrop-blur overflow-hidden"
      style={{ borderColor: `${accent}55`, boxShadow: `0 0 50px -25px ${accent}` }}
      aria-label="Site guide swear chat"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: `${accent}33` }}>
        <div className="flex items-center gap-2 min-w-0">
          <Skull className="h-4 w-4 shrink-0" style={{ color: accent }} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] font-bold truncate" style={{ color: accent }}>
              Guttermouth Guide
            </p>
            <p className="text-[11px] text-white/50 truncate">Foul-mouthed site map. Ask anything — get directions.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setChaos((c) => !c)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border transition"
          style={{
            borderColor: chaos ? "#ff7a00aa" : "#71717a55",
            background: chaos ? "#ff7a0022" : "#71717a11",
            color: chaos ? "#ff9a3c" : "#a1a1aa",
          }}
          title="Toggle Chaos Mode — louder, ruder, all caps."
        >
          <Flame className="h-3 w-3" /> Chaos {chaos ? "ON" : "OFF"}
        </button>
      </header>

      <div ref={scrollRef} className="max-h-[55vh] overflow-y-auto px-4 py-4 space-y-3 text-sm">
        {msgs.length === 0 && (
          <div className="space-y-3 py-2">
            <p className="text-center text-xs text-white/50">
              Tell the gremlin what you want and it'll cough up a site map. Try one:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-white/40 pt-2">
              Already know where you're going? <Link to="/sitemap" className="underline hover:text-white/70">Open the sitemap</Link>.
            </p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] rounded-xl px-3 py-2 leading-relaxed ${
              m.role === "user" ? "ml-auto bg-white/8 text-white/90 whitespace-pre-wrap" : "mr-auto text-white/95"
            }`}
            style={
              m.role === "assistant"
                ? { background: `${accent}18`, border: `1px solid ${accent}44` }
                : undefined
            }
          >
            {m.role === "assistant" ? (
              <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-code:text-pink-300">
                <ReactMarkdown components={{ a: MarkdownLink }}>{m.content}</ReactMarkdown>
              </div>
            ) : (
              m.content
            )}
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Loader2 className="h-3 w-3 animate-spin" /> guttermouth is plotting a route…
          </div>
        )}
      </div>

      <div className="flex gap-2 px-3 py-3 border-t" style={{ borderColor: `${accent}33` }}>
        <Compass className="h-5 w-5 self-center text-white/40 shrink-0" />
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
          rows={1}
          placeholder="What are you trying to do? I'll point the way (rudely)."
          className="flex-1 resize-none bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ caretColor: accent }}
        />
        <button
          onClick={() => submit(draft)}
          disabled={sending || !draft.trim()}
          className="px-3 rounded-md font-bold text-xs uppercase tracking-wider disabled:opacity-40"
          style={{ background: accent, color: "#0a0a0a" }}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}