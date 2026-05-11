import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, Send, Skull, Crown, Flame, ShieldCheck, VolumeX, Volume2, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { bossChat } from "@/lib/boss-chat.functions";
import { effectiveSwearing } from "@/lib/swearing";

type Msg = { role: "user" | "assistant"; content: string };

type Tone = "clean" | "brutal" | "auto";

export function BossChatPanel({ tone }: { tone?: Tone } = {}) {
  const { user, profile } = useAuth();
  const ask = useServerFn(bossChat);
  // Loose access — this panel may render under routes that don't define `tone`.
  const search = useSearch({ strict: false }) as { tone?: Tone };
  const navigate = useNavigate();
  const effectiveTone: Tone = tone ?? search.tone ?? "auto";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Per-conversation Safe Mode override. Resets on page reload — does NOT
  // touch the user's profile-level Swearing Agent preference.
  // Seed from the URL `?tone=` so a shared link opens in the right mode.
  const [convoSafe, setConvoSafe] = useState<boolean>(effectiveTone === "clean");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const profileSwearing = effectiveSwearing(profile);
  const swearing = profileSwearing && !convoSafe;

  // If the URL tone changes after mount (back/forward, external link), sync.
  useEffect(() => {
    if (effectiveTone === "clean") setConvoSafe(true);
    else if (effectiveTone === "brutal") setConvoSafe(false);
    // "auto" leaves whatever the user picked alone
  }, [effectiveTone]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const writeToneToUrl = (next: Tone) => {
    try {
      navigate({
        to: ".",
        replace: true,
        search: (prev: Record<string, unknown>) => ({ ...prev, tone: next }),
      } as any);
    } catch {
      /* route may not declare `tone` in its schema — non-fatal */
    }
  };

  const toggleSafe = () => {
    setConvoSafe((v) => {
      const next = !v;
      writeToneToUrl(next ? "clean" : "brutal");
      return next;
    });
  };

  const copyShareLink = async () => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tone", convoSafe ? "clean" : "brutal");
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      toast.success(`Share link copied · opens in ${convoSafe ? "Clean" : "OG Brutal"} mode`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!user) {
      toast.error("Sign in to use Boss Chat");
      return;
    }
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await ask({ data: { messages: next, safeMode: convoSafe } });
      setMessages((m) => [...m, { role: "assistant", content: r.text }]);
    } catch (e: any) {
      const msg = e?.message ?? "Boss Chat failed";
      toast.error(msg);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={`relative rounded-2xl border-2 p-5 sm:p-6 backdrop-blur shadow-2xl transition-colors ${
        swearing
          ? "border-rose-600/60 bg-gradient-to-br from-black/80 via-rose-950/30 to-black/80"
          : "border-gold/40 bg-gradient-to-br from-black/70 via-zinc-950/60 to-black/70"
      }`}
    >
      <header className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`shrink-0 w-12 h-12 rounded-xl grid place-items-center text-black shadow-lg ring-4 ${
              swearing
                ? "bg-gradient-to-br from-rose-500 to-orange-400 ring-rose-500/30"
                : "bg-gradient-to-br from-gold to-amber-300 ring-gold/30"
            }`}
          >
            {swearing ? <Skull className="h-6 w-6 stroke-[2.5]" /> : <Crown className="h-6 w-6 stroke-[2.5]" />}
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] uppercase tracking-[0.4em] font-black ${swearing ? "text-rose-300" : "text-gold"}`}>
              Boss Chat · TradeHUB
            </p>
            <h2 className="font-[Montserrat] font-black text-2xl sm:text-3xl tracking-tight">
              {swearing ? "Reality Check (Unfiltered)" : "Reality Check"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {swearing
                ? "Swearing Agent online. Expect savage motivation with the analysis."
                : "Calm, professional copilot. Flip the switch if you need a slap of motivation."}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div
            role="status"
            aria-live="polite"
            aria-label={`Tone: ${swearing ? "OG brutal — profanity on" : "Clean — profanity off"}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 ${
              swearing ? "border-rose-600/60 bg-rose-950/30 text-rose-200" : "border-emerald-700/40 bg-black/40 text-emerald-300"
            }`}
          >
            {swearing ? <Flame className="h-3.5 w-3.5 text-rose-300" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
            <span className="text-[11px] uppercase tracking-[0.25em] font-black">
              Tone · {swearing ? "OG Brutal" : "Clean"}
            </span>
          </div>
          {profileSwearing && (
            <button
              type="button"
              onClick={toggleSafe}
              aria-pressed={convoSafe}
              className={`text-[10px] uppercase tracking-[0.25em] font-bold underline-offset-4 hover:underline inline-flex items-center gap-1 ${
                convoSafe ? "text-emerald-300" : "text-rose-300/80 hover:text-rose-200"
              }`}
              title={convoSafe ? "Re-enable profanity for this chat" : "Mute profanity for this chat only"}
            >
              {convoSafe ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              {convoSafe ? "Unmute for this chat" : "Mute profanity (this chat)"}
            </button>
          )}
          <button
            type="button"
            onClick={copyShareLink}
            className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            title={`Copy a shareable link that opens this chat in ${convoSafe ? "Clean" : "OG Brutal"} mode`}
          >
            {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
            {copied ? "Link copied" : `Share ${convoSafe ? "Clean" : "Brutal"} link`}
          </button>
        </div>
      </header>

      {swearing && (
        <div className="-mt-1 mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-fuchsia-500/70 bg-fuchsia-500/15 text-fuchsia-200">
          <Flame className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-black">
            OG Brutal · all-or-nothing
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className="h-72 sm:h-80 overflow-y-auto rounded-xl border border-border/60 bg-black/50 p-4 space-y-3 text-sm"
      >
        {messages.length === 0 && (
          <p className="text-muted-foreground text-xs italic">
            Ask anything — “Should I hold this gold long?”, “Roast my conviction on EURUSD”, “Quick reality check on BTC.”
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap leading-relaxed rounded-lg px-3 py-2 ${
              m.role === "user"
                ? "bg-emerald-900/30 border border-emerald-700/40 text-emerald-100"
                : swearing
                  ? "bg-rose-900/20 border border-rose-700/40 text-rose-100"
                  : "bg-amber-900/15 border border-gold/30 text-amber-100"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-[0.25em] font-black opacity-70 mb-1">
              {m.role === "user" ? "You" : swearing ? "Swearing Agent" : "Boss Chat"}
            </span>
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {swearing ? "Cooking up some abuse…" : "Thinking…"}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={swearing ? "Talk to me, paper hands…" : "Ask the Boss Chat…"}
          disabled={busy}
          className="h-11 bg-black/70 border-2 border-border focus-visible:border-gold text-base"
        />
        <Button
          onClick={send}
          disabled={busy || !input.trim()}
          className={`h-11 px-5 font-black uppercase tracking-wider ${
            swearing ? "bg-rose-500 hover:bg-rose-400 text-black" : "bg-gold hover:bg-amber-400 text-black"
          }`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" />Send</>}
        </Button>
      </div>
    </section>
  );
}
