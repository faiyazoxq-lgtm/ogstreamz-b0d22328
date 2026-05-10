import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Skull, Crown, Flame, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { setFeatureFlags } from "@/lib/overlord.functions";
import { bossChat } from "@/lib/boss-chat.functions";

type Msg = { role: "user" | "assistant"; content: string };

export function BossChatPanel() {
  const { user, profile, isAdmin, refresh } = useAuth();
  const ask = useServerFn(bossChat);
  const setF = useServerFn(setFeatureFlags);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [togglingFlag, setTogglingFlag] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const swearing = effectiveSwearing(profile);
  // BRUTAL MODE default — chaotic unless the user has explicitly chosen otherwise.
  const intensityRaw = String((profile?.feature_flags as any)?.swearing_intensity ?? "chaotic").toLowerCase();
  const intensity: "mild" | "medium" | "chaotic" =
    intensityRaw === "mild" || intensityRaw === "medium" ? intensityRaw : "chaotic";
  const canToggleSelf = !!user;
  // Boss can also toggle in bulk via the Boss Control Center; this is the per-user switch.
  const isBoss = profile?.rank === "boss" || isAdmin;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const setIntensity = async (next: "mild" | "medium" | "chaotic") => {
    if (!user || !profile || next === intensity) return;
    setTogglingFlag(true);
    try {
      const merged = { ...(profile.feature_flags ?? {}), swearing_intensity: next };
      if (isBoss) {
        await setF({ data: { userId: user.id, flags: merged } });
      } else {
        const { error } = await supabase.from("profiles").update({ feature_flags: merged }).eq("id", user.id);
        if (error) throw new Error(error.message);
      }
      await refresh();
      toast.success(`Intensity: ${next.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to set intensity");
    } finally {
      setTogglingFlag(false);
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
      const r = await ask({ data: { messages: next } });
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

        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 ${
            swearing ? "border-rose-600/60 bg-rose-950/30 text-rose-200" : "border-emerald-700/40 bg-black/40 text-emerald-300"
          }`}
          title="Toggle the Swearing Agent from the master switch in the header."
        >
          {swearing ? <Flame className="h-3.5 w-3.5 text-rose-300" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
          <span className="text-[11px] uppercase tracking-[0.25em] font-black">
            Swearing Agent · {swearing ? "ON" : "OFF"}
          </span>
        </div>
      </header>

      {swearing && (
        <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-rose-300/80">
            Intensity
          </span>
          {(["mild", "medium", "chaotic"] as const).map((opt) => {
            const active = intensity === opt;
            const tint =
              opt === "mild"
                ? "border-amber-500/60 text-amber-200 bg-amber-500/10"
                : opt === "medium"
                  ? "border-rose-500/60 text-rose-200 bg-rose-500/10"
                  : "border-fuchsia-500/70 text-fuchsia-200 bg-fuchsia-500/15";
            return (
              <button
                key={opt}
                type="button"
                disabled={togglingFlag || !canToggleSelf}
                onClick={() => setIntensity(opt)}
                className={`px-3 py-1.5 rounded-full border-2 text-[10px] font-black uppercase tracking-[0.25em] transition-all ${
                  active
                    ? `${tint} ring-2 ring-offset-2 ring-offset-black ring-rose-500/40 shadow-[0_0_18px_-2px_rgba(244,63,94,0.6)]`
                    : "border-white/15 text-white/55 hover:border-white/35 hover:text-white/80 bg-black/30"
                }`}
              >
                {opt}
              </button>
            );
          })}
          <span className="text-[10px] text-rose-300/60 italic ml-1">
            {intensity === "mild" && "Sass only · PG-13"}
            {intensity === "medium" && "Standard sweary roast"}
            {intensity === "chaotic" && "Full unhinged Enforcer"}
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
