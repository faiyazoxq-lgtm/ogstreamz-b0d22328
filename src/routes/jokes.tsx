import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, Shuffle, Power, Skull, SprayCan, Crown, Drama, Flame, Radio, X, Plus, Dice5 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { VaultLockedDialog } from "@/components/VaultLockedDialog";

export type StylePreset = { id: string; label: string; Icon: typeof Skull };

export const STYLE_PRESETS: StylePreset[] = [
  { id: "street", label: "Street Wit", Icon: SprayCan },
  { id: "dark", label: "Dark Humor", Icon: Skull },
  { id: "sarcastic", label: "Sarcastic", Icon: Drama },
  { id: "legendary", label: "Legendary", Icon: Crown },
  { id: "gritty", label: "Gritty", Icon: Flame },
];

// Joke-only flavor chips. These get folded into the "custom" prompt string
// so the portal can read them without changing STYLE_PRESETS.
const FLAVOR_GROUPS: { name: string; chips: string[] }[] = [
  {
    name: "Tone",
    chips: ["deadpan", "absurd", "wholesome", "self-deprecating", "observational", "roast-mode", "punny", "dry wit"],
  },
  {
    name: "Delivery",
    chips: ["one-liner", "long setup", "rule of three", "callback gag", "mic-drop punchline", "story joke", "knock-knock"],
  },
  {
    name: "Audience",
    chips: ["family-friendly", "late-night club", "office water-cooler", "stand-up crowd", "group chat", "kids party"],
  },
  {
    name: "Setting",
    chips: ["bar joke", "elevator joke", "tech bro meeting", "dad at BBQ", "subway rant", "wedding speech"],
  },
  {
    name: "Pace",
    chips: ["snappy", "slow burn", "rapid fire", "build-and-twist", "shaggy dog"],
  },
  {
    name: "Era",
    chips: ["classic vaudeville", "90s sitcom", "internet meme", "TikTok punchline", "boomer humor", "Gen-Z chaos"],
  },
];

// A pool of joke-style keyword bursts for the "Random" button. All terms
// are kept strictly joke / comedy related.
const RANDOM_JOKE_PROMPTS: string[] = [
  "deadpan one-liner with a callback gag",
  "absurd dad joke at a wedding speech",
  "self-deprecating roast with a mic-drop punchline",
  "observational rant from the subway, rapid fire",
  "rule of three setup, family-friendly twist",
  "shaggy dog story that lands on a pun",
  "sarcastic group chat one-liner",
  "tech bro meeting joke, slow burn punchline",
  "wholesome knock-knock with a Gen-Z twist",
  "late-night club roast, snappy delivery",
  "punny elevator joke with a build-and-twist",
  "boomer humor reimagined as a TikTok punchline",
];

export const Route = createFileRoute("/jokes")({
  head: () => ({
    meta: [
      { title: "JokesHUB — Style Mixer · 0G-STREAMZ" },
      { name: "description", content: "Pick your joke styles, mix and launch a personalized punchline portal." },
    ],
  }),
  component: JokesSetup,
});

function JokesSetup() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [selected, setSelected] = useState<string[]>(["street"]);
  const [flavors, setFlavors] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [brief, setBrief] = useState("");
  const [briefDirty, setBriefDirty] = useState(false);
  const [locked, setLocked] = useState(false);
  const [liveRoast, setLiveRoast] = useState(false);
  const isVip = profile?.status === "vip" || isAdmin;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleFlavor = (chip: string) =>
    setFlavors((f) => (f.includes(chip) ? f.filter((x) => x !== chip) : [...f, chip]));

  const addKeyword = (raw: string) => {
    const v = raw.trim().replace(/,+$/, "").trim();
    if (!v) return;
    setKeywords((k) => (k.includes(v) ? k : [...k, v]));
    setDraft("");
  };

  const removeKeyword = (k: string) =>
    setKeywords((arr) => arr.filter((x) => x !== k));

  const onDraftKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(draft);
    }
  };

  const compiledCustom = useMemo(
    () => [...flavors, ...keywords].join(", "),
    [flavors, keywords],
  );

  const effectiveBrief = briefDirty ? brief : compiledCustom;

  const surprise = () => {
    const ids = STYLE_PRESETS.map((s) => s.id);
    const count = 1 + Math.floor(Math.random() * 3);
    const shuffled = [...ids].sort(() => Math.random() - 0.5).slice(0, count);
    setSelected(shuffled);
    // Drop in a random joke-style burst as keywords too.
    const burst = RANDOM_JOKE_PROMPTS[Math.floor(Math.random() * RANDOM_JOKE_PROMPTS.length)];
    const tokens = burst.split(/,\s*|\s+with\s+/g).map((t) => t.trim()).filter(Boolean);
    setKeywords((k) => Array.from(new Set([...k, ...tokens])));
    setBriefDirty(false);
  };

  const randomKeyword = () => {
    const all = FLAVOR_GROUPS.flatMap((g) => g.chips);
    const pick = all[Math.floor(Math.random() * all.length)];
    addKeyword(pick);
  };

  const canLaunch =
    selected.length > 0 || flavors.length > 0 || keywords.length > 0 || effectiveBrief.trim().length > 0;

  const launch = () => {
    if (!canLaunch) return;
    if (!user) {
      setLocked(true);
      return;
    }
    if (liveRoast && !isVip) {
      setLocked(true);
      return;
    }
    navigate({
      to: "/jokes/portal",
      search: { styles: selected.join(","), custom: effectiveBrief.trim(), live: liveRoast ? 1 : 0 },
    });
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
      <header className="text-center mb-12">
        <p className="text-xs tracking-[0.4em] uppercase font-semibold mb-3" style={{ color: "var(--neon-blue-bright)" }}>
          JokesHUB · Style Mixer
        </p>
        <h1 className="font-[Montserrat] font-black text-4xl sm:text-6xl tracking-tight text-metallic">
          Build Your Mix
        </h1>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Tap chips to throw joke styles into the mix. Write your own or roll the dice. Nothing fires until you press Activate.
        </p>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] gap-6 lg:gap-8 items-start">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-8 min-w-0">
        {/* Core style tags */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Core Styles
            </h2>
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {STYLE_PRESETS.map(({ id, label, Icon }) => {
              const active = selected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={
                    "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wider border transition-all " +
                    (active
                      ? "btn-glass-blue text-white border-transparent"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-[oklch(0.72_0.22_245/0.5)]")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Flavor groups */}
        {FLAVOR_GROUPS.map((group) => (
          <div key={group.name}>
            <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold mb-3">
              {group.name}
            </h2>
            <div className="flex flex-wrap gap-2">
              {group.chips.map((chip) => {
                const active = flavors.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleFlavor(chip)}
                    className={
                      "px-2.5 py-1 rounded-full text-xs sm:text-sm border transition-all " +
                      (active
                        ? "btn-glass-blue text-white border-transparent"
                        : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground hover:border-[oklch(0.72_0.22_245/0.5)]")
                    }
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom keywords */}
        <div>
          <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold mb-4">
            Your Own Keywords
          </h2>
          <div className="relative">
            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onDraftKey}
              onBlur={() => addKeyword(draft)}
              placeholder="Type a joke flavor and hit Enter..."
              className="pl-11 pr-24 h-12 bg-background border-border text-base"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={randomKeyword} className="h-8 px-2">
                <Dice5 className="h-4 w-4 mr-1" /> Random
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => addKeyword(draft)} className="h-8 px-2">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[oklch(0.72_0.22_245/0.15)] text-foreground border border-[oklch(0.72_0.22_245/0.4)]"
                >
                  {k}
                  <button type="button" onClick={() => removeKeyword(k)} className="opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Press Enter or comma to lock a chip in. Hit Random to roll a joke flavor.
          </p>
        </div>

        {/* Randomizer — joke-style only */}
        <div>
          <Button
            type="button"
            onClick={surprise}
            variant="outline"
            className="w-full h-12 border-[oklch(0.72_0.22_245/0.4)] text-foreground hover:bg-[oklch(0.72_0.22_245/0.1)] uppercase tracking-wider font-bold"
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Surprise Me — Roll a Joke Prompt
          </Button>
        </div>

        {/* Live Roast VIP toggle */}
        <div>
          <button
            type="button"
            onClick={() => setLiveRoast((v) => !v)}
            className={
              "w-full flex items-center justify-between gap-3 px-5 py-4 rounded-xl border transition-all " +
              (liveRoast
                ? "border-[oklch(0.72_0.22_245/0.7)] bg-[oklch(0.72_0.22_245/0.12)] shadow-[0_0_30px_-5px_oklch(0.72_0.22_245/0.6)]"
                : "border-border bg-secondary/40 hover:border-[oklch(0.72_0.22_245/0.5)]")
            }
          >
            <div className="flex items-center gap-3 text-left">
              <span
                className={
                  "relative h-3 w-3 rounded-full " +
                  (liveRoast ? "bg-[var(--neon-blue-bright)] animate-pulse" : "bg-muted-foreground/40")
                }
              >
                {liveRoast && (
                  <span className="absolute inset-0 rounded-full bg-[var(--neon-blue-bright)] blur-[6px] opacity-80" />
                )}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />
                  <span className="text-sm font-bold uppercase tracking-[0.25em] text-white">Live Roast</span>
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] px-2 py-0.5 rounded-full border border-[oklch(0.72_0.22_245/0.5)] text-[var(--neon-blue-bright)]">
                    VIP
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pull today's most viral news. Sarcastic 0G-style burn, served fresh.
                </p>
              </div>
            </div>
            <span
              className={
                "text-[10px] font-bold uppercase tracking-[0.3em] " +
                (liveRoast ? "text-[var(--neon-blue-bright)]" : "text-muted-foreground")
              }
            >
              {liveRoast ? "ON" : "OFF"}
            </span>
          </button>
        </div>
        </section>

        {/* Live brief panel */}
        <aside className="rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-4 lg:self-start space-y-4">
          <div>
            <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Joke Brief
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Auto-built from your chips. Edit freely — nothing generates until you press Activate.
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{selected.length}</span> core ·{" "}
            <span className="text-foreground font-semibold">{flavors.length}</span> flavors ·{" "}
            <span className="text-foreground font-semibold">{keywords.length}</span> keywords
          </div>

          <Textarea
            value={effectiveBrief}
            onChange={(e) => {
              setBrief(e.target.value);
              setBriefDirty(true);
            }}
            placeholder="Your compiled joke prompt will appear here..."
            className="min-h-32 max-h-60 resize-y bg-background border-border text-sm"
          />

          {briefDirty && (
            <button
              type="button"
              onClick={() => {
                setBriefDirty(false);
                setBrief("");
              }}
              className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
            >
              Reset to auto-built
            </button>
          )}

          <button
            type="button"
            onClick={launch}
            disabled={!canLaunch}
            className="relative w-full btn-glass-blue rounded-xl py-4 text-white font-black text-sm tracking-[0.3em] uppercase disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-3 shadow-[0_0_40px_-5px_oklch(0.72_0.22_245/0.7)] hover:shadow-[0_0_70px_-5px_oklch(0.72_0.22_245/0.95)] transition-shadow"
          >
            <Power className="h-5 w-5" />
            Generate Portal
          </button>
          <p className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
            {canLaunch ? "Ready · Frequency locked" : "Pick at least one chip"}
          </p>
        </aside>
      </div>

      {/* Big activate — secondary, mirrors brief CTA */}
      <div className="relative mt-10 flex flex-col items-center">
        <div
          aria-hidden
          className={
            "pointer-events-none absolute inset-0 flex items-center justify-center " +
            (canLaunch ? "opacity-100" : "opacity-0")
          }
        >
          <div className="h-40 w-[28rem] max-w-full rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.72_0.22_245_/_0.7),transparent)] animate-pulse-gold" />
        </div>
        <button
          type="button"
          onClick={launch}
          disabled={!canLaunch}
          className="relative btn-glass-blue rounded-2xl px-14 sm:px-24 py-7 sm:py-8 text-white font-black text-base sm:text-2xl tracking-[0.35em] uppercase disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-4 shadow-[0_0_60px_-5px_oklch(0.72_0.22_245/0.85),0_0_120px_-10px_oklch(0.72_0.22_245/0.6),inset_0_1px_0_oklch(1_0_0/0.15)] hover:shadow-[0_0_90px_-5px_oklch(0.72_0.22_245/1),0_0_180px_-10px_oklch(0.72_0.22_245/0.8),inset_0_1px_0_oklch(1_0_0/0.2)] transition-shadow"
        >
          <Power className="h-7 w-7" />
          Activate Portal
        </button>
        <p className="mt-4 text-xs text-muted-foreground uppercase tracking-[0.3em]">
          {canLaunch ? "Ready · Frequency locked" : "Pick at least one chip"}
        </p>
      </div>
      <VaultLockedDialog
        open={locked}
        onOpenChange={setLocked}
        itemName={liveRoast ? "Live Roast (VIP)" : "Portal Activation"}
        isAuthenticated={!!user}
      />
    </main>
  );
}