import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Sparkles, Shield, ExternalLink, KeyRound, Music, Video, Image as ImageIcon } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { streamOgChat, type StreamEvent } from "@/lib/og-chat.functions";

export const Route = createFileRoute("/og-bot")({
  component: OgBotPage,
  head: () => ({
    meta: [
      { title: "OG Bot · Research & Creative Powerhouse" },
      { name: "description", content: "Chat with OG Bot — Safe Mode for fast clean Gemini chat, OG Mode for Perplexity-grounded research with full chaos personality, image, music and video generation." },
    ],
  }),
});

type Mode = "normal" | "og"; // wire stays "normal" | "og"; UI label is Safe / OG
type Source = { url: string; title?: string; snippet?: string };
type Media = NonNullable<Extract<StreamEvent, { type: "media" }>>;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: Mode;
  sources?: Source[];
  media?: Media[];
  model?: string;
};

function OgBotPage() {
  const { user, loading } = useAuth();
  const stream = useServerFn(streamOgChat);

  const [mode, setMode] = useState<Mode>("og");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [liveSources, setLiveSources] = useState<Source[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, stage, liveSources]);

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold mb-3">Sign in to talk to OG Bot</h1>
        <Link to="/auth"><Button>Sign in</Button></Link>
      </div>
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setLiveSources([]);
    setStage("classifying");

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "", mode, sources: [], media: [] }]);

    try {
      const result = await stream({ data: { mode, history, message: text } });
      let buffer = "";
      const collectedSources: Source[] = [];
      const collectedMedia: Media[] = [];
      let model: string | undefined;

      for await (const ev of result as AsyncIterable<StreamEvent>) {
        if (ev.type === "status") setStage(ev.stage);
        else if (ev.type === "research") {
          collectedSources.push(ev.source);
          setLiveSources([...collectedSources]);
        } else if (ev.type === "media") {
          collectedMedia.push(ev);
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") last.media = [...collectedMedia];
            return next;
          });
        } else if (ev.type === "delta") {
          buffer += ev.text;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              last.content = buffer;
              last.sources = [...collectedSources];
            }
            return next;
          });
        } else if (ev.type === "done") {
          model = ev.model;
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          last.sources = collectedSources;
          last.media = collectedMedia;
          last.model = model;
        }
        return next;
      });
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          last.content = (last.content || "") + `\n\n_⚠️ ${e instanceof Error ? e.message : "Stream failed"}_`;
        }
        return next;
      });
    } finally {
      setBusy(false);
      setStage(null);
      setLiveSources([]);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col px-4 py-6">
      <header className="flex items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-5 w-5 text-primary" /> OG Bot
          </h1>
          <p className="text-xs text-muted-foreground">
            {mode === "og"
              ? "OG Mode · Perplexity Sonar Pro → Gemini 3.1 Pro / GPT-5.5 · chaos personality · image · music · video"
              : "Safe Mode · Gemini 3 Flash · fast, clean, brand-safe assistance"}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} disabled={busy} />
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-lg border bg-card/30 p-4">
        {messages.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Ask anything. In <strong>Safe Mode</strong> you get clean Gemini Flash. In <strong>OG Mode</strong> I research with Perplexity then synthesize with Gemini Pro / GPT-5.5 — full chaos voice on.
            Say "make an image of…", "make a song…", or "make a video…" to trigger media tools (OG Mode only).
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}

        {stage && mode === "og" && (
          <ResearchStatusBar stage={stage} sources={liveSources} />
        )}
        {stage && mode === "normal" && (
          <div className="text-xs text-muted-foreground italic flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> {stage}…
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end gap-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={mode === "og" ? "Ask anything — I'll research, synthesize, and let rip…" : "Quick clean question for Safe Mode…"}
          rows={3}
          className="resize-none text-base sm:text-lg leading-relaxed px-4 py-3 min-h-[88px] rounded-xl"
          disabled={busy}
        />
        <Button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          size="lg"
          className="h-[88px] w-16 sm:w-20 rounded-xl shrink-0"
          aria-label="Send message"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange, disabled }: { mode: Mode; onChange: (m: Mode) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex rounded-full border bg-muted p-1 text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("normal")}
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 transition ${mode === "normal" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        <Shield className="h-3 w-3" /> Safe Mode
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("og")}
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 transition ${mode === "og" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        <Sparkles className="h-3 w-3" /> OG Mode
      </button>
    </div>
  );
}

function ResearchStatusBar({ stage, sources }: { stage: string; sources: Source[] }) {
  const label =
    stage === "researching" ? "OG Mode: Consulting Perplexity Sonar Pro…" :
    stage === "drafting" ? "Gemini 3.1 Pro: Drafting analysis · GPT-5 critique queued…" :
    stage === "thinking" ? "Council: Assembling brief for Claude…" :
    stage === "finalizing" ? "Claude Sonnet 4.5: Synthesizing final answer…" :
    stage === "generating" ? "Creative Engine: Generating media…" :
    stage === "classifying" ? "Router: Detecting intent…" :
    `${stage}…`;

  return (
    <Card className="border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Loader2 className="h-4 w-4 animate-spin" /> {label}
      </div>
      {sources.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {sources.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="font-mono text-primary">[{i + 1}]</span>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground inline-flex items-center gap-1">
                  <span className="line-clamp-1">{s.title ?? s.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="line-clamp-1">{s.title}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] space-y-2 rounded-2xl px-5 py-4 text-base sm:text-lg font-medium leading-[1.7] tracking-[-0.005em] ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {!isUser && msg.mode && (
          <div className="flex items-center gap-2">
            <Badge variant={msg.mode === "og" ? "default" : "secondary"} className="text-[10px]">
              {msg.mode === "og" ? "OG MODE" : "SAFE MODE"}
            </Badge>
            {msg.model && <span className="text-[10px] text-muted-foreground font-mono">{msg.model}</span>}
          </div>
        )}

        {msg.media?.map((m, i) => <MediaCard key={i} media={m} />)}

        {msg.content && (
          <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none break-words font-medium leading-[1.75] prose-p:leading-[1.75] prose-p:my-3 prose-headings:font-bold prose-headings:tracking-tight prose-strong:font-bold prose-li:leading-[1.7] prose-li:my-1">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}

        {!isUser && msg.sources && msg.sources.length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Sources ({msg.sources.length})
            </summary>
            <ol className="mt-2 space-y-1 pl-4">
              {msg.sources.map((s, i) => (
                <li key={i}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      [{i + 1}] {s.title ?? s.url}
                    </a>
                  ) : (
                    <span>[{i + 1}] {s.title}</span>
                  )}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}

function MediaCard({ media }: { media: Media }) {
  if (media.kind === "image" && media.status === "ready" && media.dataUrl) {
    return (
      <Card className="overflow-hidden p-0">
        <img src={media.dataUrl} alt={media.prompt} className="w-full" />
        <div className="border-t p-2 text-[11px] text-muted-foreground flex items-center gap-1">
          <ImageIcon className="h-3 w-3" /> Nano Banana 2 · {media.prompt.slice(0, 80)}
        </div>
      </Card>
    );
  }

  if (media.kind === "music" && media.status === "ready" && media.dataUrl) {
    return (
      <Card className="overflow-hidden p-3 space-y-2">
        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Music className="h-3 w-3" /> Lyria 3 · {media.prompt.slice(0, 80)}
        </div>
        <audio src={media.dataUrl} controls className="w-full" preload="metadata" />
      </Card>
    );
  }

  if (media.kind === "video" && media.status === "ready" && media.dataUrl) {
    return (
      <Card className="overflow-hidden p-0">
        <video src={media.dataUrl} controls playsInline className="w-full" preload="metadata" />
        <div className="border-t p-2 text-[11px] text-muted-foreground flex items-center gap-1">
          <Video className="h-3 w-3" /> Veo · {media.prompt.slice(0, 80)}
        </div>
      </Card>
    );
  }

  if (media.status === "placeholder") {
    const Icon = media.kind === "music" ? Music : media.kind === "video" ? Video : ImageIcon;
    return (
      <Card className="border-dashed border-primary/40 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Icon className="h-8 w-8 shrink-0 text-primary" />
          <div className="flex-1 space-y-2">
            <div className="font-semibold text-sm flex items-center gap-2">
              {media.providerLabel ?? media.kind} · coming soon
              <Badge variant="outline" className="text-[10px]">PLACEHOLDER</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{media.message}</p>
            <div className="rounded border bg-background/50 p-2 font-mono text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3 w-3" /> Required env var: <span className="text-foreground">{media.providerKey}</span>
              </div>
              <div className="mt-1">Prompt: <span className="text-foreground">{media.prompt}</span></div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Add the API key in <strong>Project Settings → Backend → Secrets</strong>, then ping me to wire it into <code>src/lib/og-chat.functions.ts</code>.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (media.status === "error") {
    return (
      <Card className="border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive">
        ⚠️ {media.kind} generation failed: {media.message}
      </Card>
    );
  }

  return null;
}