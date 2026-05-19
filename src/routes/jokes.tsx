import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Power, Sparkles, RotateCcw, Radio, Skull, SprayCan, Crown, Drama, Flame, Sparkle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { VaultLockedDialog } from "@/components/VaultLockedDialog";
import { SpawnPortalCard } from "@/components/SpawnPortalCard";
import { CreditWallet } from "@/components/CreditWallet";
import { NonVipFormGate } from "@/components/NonVipFormGate";
import { PortalHeader, PortalStyleLine, mergeStyle } from "@/components/PortalHeader";
import { OGBotDraftPanel } from "@/components/og-bot/OGBotDraftPanel";

const JOKES_STYLE = "Razor-sharp punch-up roast, club-room timing, no slurs.";

import { requireBossHub } from "@/lib/route-guards";
export type StylePreset = { id: string; label: string; Icon: typeof Skull };

export const STYLE_PRESETS: StylePreset[] = [
  { id: "street", label: "Street Wit", Icon: SprayCan },
  { id: "dark", label: "Dark Humor", Icon: Skull },
  { id: "sarcastic", label: "Sarcastic", Icon: Drama },
  { id: "legendary", label: "Legendary", Icon: Crown },
  { id: "gritty", label: "Gritty", Icon: Flame },
  { id: "indian", label: "Desi / Indian", Icon: Sparkle },
];

type Prompt = { label: string; phrase: string; styleId?: string };

const PROMPTS: Prompt[] = [
  { label: "Street Wit",     phrase: "street wit, sharp slang, corner-store swagger", styleId: "street" },
  { label: "Dark Humor",     phrase: "dark humor, bleak punchlines, gallows wit",      styleId: "dark" },
  { label: "Sarcastic",      phrase: "sarcastic, dry, eye-roll delivery",              styleId: "sarcastic" },
  { label: "Legendary",      phrase: "legendary stand-up energy, mic-drop punchlines", styleId: "legendary" },
  { label: "Gritty",         phrase: "gritty, raw, no-filter street comedy",           styleId: "gritty" },
  { label: "Desi / Indian",  phrase: "desi Indian household humor, aunty energy, arranged-marriage roast, engineer parents, cricket, jugaad, raw uncensored one-liners", styleId: "indian" },
  { label: "Deadpan",        phrase: "deadpan delivery, zero emotion" },
  { label: "Absurd",         phrase: "absurd, surreal, makes-no-sense logic" },
  { label: "Self-Deprecating", phrase: "self-deprecating, roast-yourself-first" },
  { label: "Observational",  phrase: "observational, everyday-life angles" },
  { label: "Roast Mode",     phrase: "roast mode, brutal one-liners" },
  { label: "Punny",          phrase: "punny, wordplay-heavy" },
  { label: "One-Liner",      phrase: "one-liner format, short and lethal" },
  { label: "Long Setup",     phrase: "long setup, surprise twist payoff" },
  { label: "Rule of Three",  phrase: "rule-of-three structure, third beat lands" },
  { label: "Callback Gag",   phrase: "callback gags, recurring punchline" },
  { label: "Family-Friendly", phrase: "family-friendly, clean, no swearing" },
  { label: "Late-Night Club", phrase: "late-night club, edgy adult crowd" },
  { label: "Bar Joke",       phrase: "classic bar-joke setup" },
  { label: "Wedding Speech", phrase: "wedding-speech awkward humor" },
  { label: "Tech Bro",       phrase: "tech bro meeting cringe" },
  { label: "Snappy",         phrase: "snappy pace, quick hits" },
  { label: "Slow Burn",      phrase: "slow burn, build-and-twist" },
  { label: "TikTok Punchline", phrase: "TikTok-era punchline, Gen-Z chaos" },
  { label: "90s Sitcom",     phrase: "90s sitcom rhythm, classic timing" },
];

export const Route = createFileRoute("/jokes")({
  beforeLoad: requireBossHub,
  head: () => ({
    meta: [
      { title: "JokesHUB · Build Your Mix — 0G-STREAMZ" },
      { name: "description", content: "Write your brief, tap a few prompts, spawn a personalized joke portal." },
    ],
  }),
  component: JokesPromptBuilder,
});

function JokesPromptBuilder() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const isVip = profile?.status === "vip" || isAdmin;

  const [used, setUsed] = useState<string[]>([]);
  const [stylesPicked, setStylesPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [liveRoast, setLiveRoast] = useState(false);
  const [locked, setLocked] = useState(false);

  const available = useMemo(() => PROMPTS.filter((p) => !used.includes(p.label)), [used]);

  const tap = (p: Prompt) => {
    setDescription((d) => {
      const t = d.trim();
      if (!t) return p.phrase;
      if (t.toLowerCase().includes(p.phrase.toLowerCase())) return d;
      return `${t}, ${p.phrase}`;
    });
    if (p.styleId) {
      setStylesPicked((s) => (s.includes(p.styleId!) ? s : [...s, p.styleId!]));
    }
    setUsed((u) => [...u, p.label]);
  };

  const reset = () => {
    setUsed([]);
    setStylesPicked([]);
    setDescription("");
  };

  const canLaunch = description.trim().length > 0;

  const launch = () => {
    if (!canLaunch) return;
    if (!user) return setLocked(true);
    if (liveRoast && !isVip) return setLocked(true);

    const briefLines: string[] = ["# JOKES PORTAL · STYLE BRIEF", ""];
    if (name.trim()) briefLines.push(`Portal name: ${name.trim()}`);
    briefLines.push(`Brief: ${mergeStyle(JOKES_STYLE, description)}`);
    briefLines.push("");
    briefLines.push(
      "Generate a punchy interactive joke portal page styled around the above traits. " +
        "Every joke, headline, button label, and microcopy must match this exact mix. No safe filler."
    );

    navigate({
      to: "/jokes/portal",
      search: {
        styles: stylesPicked.join(","),
        custom: briefLines.join("\n"),
        live: liveRoast ? 1 : 0,
      },
    });
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      <PortalHeader
        portalKey="jokes"
        name="JokesHUB"
        tagline="Prompt Studio"
        seed="late-night club, neon spotlight, microphone, electric crowd, punchline payoff"
        accent="blue"
      />

      <NonVipFormGate label="Activate Portal">
      <section className="rounded-3xl border border-transparent bg-transparent p-4 sm:p-6">
        <div className="mb-5">
          <OGBotDraftPanel
            surface="jokes-portal"
            kind="jokes"
            contextHint="User is on /jokes spawning a comedy portal."
            placeholder="Tell me the angle — region, audience, attitude."
            fieldHints={[
              { key: "name", description: "Portal name, max 80 chars", max: 80 },
              { key: "description", description: "Comedy brief paragraph", max: 1000 },
            ]}
            onApply={(f) => {
              if (f.name) setName(f.name);
              if (f.description) setDescription(f.description);
            }}
          />
        </div>
        <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Friday Night Roast"
          className="mt-1 mb-4 bg-background/60 text-base font-bold"
          maxLength={80}
        />

        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your Brief</label>
          {used.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tap a prompt below or type freely. Be vivid — the AI follows your lead."
          className="min-h-44 sm:min-h-56 bg-background/60 font-mono text-sm leading-relaxed resize-y"
          maxLength={1000}
        />

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
            Tap to add · {available.length} left
          </div>
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">All prompts stacked. Reset to start over.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => tap(p)}
                  className="px-3 py-1.5 rounded-full text-xs sm:text-sm border border-border bg-background/40 text-foreground hover:border-[oklch(0.72_0.22_245/0.6)] hover:bg-[oklch(0.72_0.22_245/0.1)] hover:scale-105 active:scale-95 transition-all"
                >
                  + {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setLiveRoast((v) => !v)}
          className={
            "mt-5 w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all " +
            (liveRoast
              ? "border-[oklch(0.72_0.22_245/0.7)] bg-[oklch(0.72_0.22_245/0.12)] shadow-[0_0_30px_-5px_oklch(0.72_0.22_245/0.6)]"
              : "border-border bg-secondary/40 hover:border-[oklch(0.72_0.22_245/0.5)]")
          }
        >
          <div className="flex items-center gap-3 text-left">
            <Radio className="h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-[0.25em] text-white">Live Roast</span>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] px-2 py-0.5 rounded-full border border-[oklch(0.72_0.22_245/0.5)] text-[var(--neon-blue-bright)]">VIP</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Pull today's viral news. 0G-style burn, fresh.</p>
            </div>
          </div>
          <span className={"text-[10px] font-bold uppercase tracking-[0.3em] " + (liveRoast ? "text-[var(--neon-blue-bright)]" : "text-muted-foreground")}>
            {liveRoast ? "ON" : "OFF"}
          </span>
        </button>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--neon-blue-bright)" }} />
          <span className="truncate">0G-BRAIN designs the portal around your prompt</span>
        </div>

        <PortalStyleLine sentence={JOKES_STYLE} />

        <Button
            onClick={launch}
            disabled={!canLaunch || !isVip}
            size="lg"
            className="mt-3 w-full btn-glass-blue text-white font-black tracking-[0.3em] uppercase"
          >
            <Power className="h-4 w-4 mr-2" />
            Activate Portal
          </Button>
      </section>
      </NonVipFormGate>

      <VaultLockedDialog
        open={locked}
        onOpenChange={setLocked}
        itemName={liveRoast ? "Live Roast (VIP)" : "Portal Activation"}
        isAuthenticated={!!user}
      />
      <CreditWallet className="mt-10" />
      <SpawnPortalCard kind="jokes" />
    </main>
  );
}
