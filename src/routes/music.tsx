import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wand2, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { spawnMusicPortal } from "@/lib/music-spawn.functions";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "MusicHUB · Build Your Sound — 0G-STREAMZ" },
      { name: "description", content: "Write your brief, tap a few prompts, spawn a custom lyrics studio." },
    ],
  }),
  component: MusicPromptBuilder,
});

type Prompt = { label: string; phrase: string; theme?: string; language?: string };

// Curated, intentionally short list. Tap → appends to brief → vanishes.
const PROMPTS: Prompt[] = [
  { label: "UK Drill",        phrase: "UK drill, sliding 808s, dark menace",          theme: "street-neon" },
  { label: "Trap",            phrase: "modern trap, hard 808s, hi-hat rolls",         theme: "street-neon" },
  { label: "Afrobeat",        phrase: "afrobeat groove, log drums, sun-soaked",       theme: "warm-folk" },
  { label: "Lo-Fi",           phrase: "lo-fi, vinyl crackle, jazzy keys, late-night", theme: "lofi-haze" },
  { label: "Pop Anthem",      phrase: "stadium pop, huge chorus, glossy production" },
  { label: "R&B Slow",        phrase: "smooth R&B, slow burn, rich harmonies" },
  { label: "Nasheed",         phrase: "nasheed, devotional vocals, no instruments",   theme: "spiritual-blue", language: "Arabic" },
  { label: "Sufi",            phrase: "sufi qawwali, tabla, harmonium, call-and-response", theme: "spiritual-blue", language: "Urdu" },
  { label: "Triumphant",      phrase: "triumphant mood, rising strings, victorious" },
  { label: "Melancholic",     phrase: "melancholic, minor keys, rain-on-window feel" },
  { label: "Aggressive",      phrase: "aggressive, distorted bass, in-your-face energy" },
  { label: "Romantic",        phrase: "romantic, warm pads, intimate vocals" },
  { label: "Acoustic",        phrase: "acoustic guitar driven, organic, unplugged" },
  { label: "Synth Heavy",     phrase: "analog synths, retro 80s textures" },
  { label: "Auto-Tuned Hook", phrase: "auto-tuned hook, melodic delivery" },
  { label: "Spoken Word",     phrase: "spoken word verses, poetic cadence" },
];

function MusicPromptBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const spawnFn = useServerFn(spawnMusicPortal);

  const [used, setUsed] = useState<string[]>([]);
  const [language, setLanguage] = useState("English");
  const [theme, setTheme] = useState("street-neon");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const available = useMemo(() => PROMPTS.filter((p) => !used.includes(p.label)), [used]);

  const tap = (p: Prompt) => {
    setDescription((d) => {
      const t = d.trim();
      if (!t) return p.phrase;
      if (t.toLowerCase().includes(p.phrase.toLowerCase())) return d;
      return `${t}, ${p.phrase}`;
    });
    if (p.theme) setTheme(p.theme);
    if (p.language) setLanguage(p.language);
    setUsed((u) => [...u, p.label]);
  };

  const reset = () => {
    setUsed([]);
    setDescription("");
  };

  const onGenerate = async () => {
    if (!user) {
      toast.error("Sign in to spawn a studio");
      navigate({ to: "/auth" });
      return;
    }
    if (!name.trim()) return toast.error("Name your track first");
    if (!description.trim()) return toast.error("Describe your sound");
    setBusy(true);
    try {
      const res = await spawnFn({
        data: {
          name: name.trim(),
          description: description.trim(),
          style_tags: used.join(", "),
          language,
          theme,
        },
      });
      toast.success("🎙️ Studio spawned");
      navigate({ to: "/m/$slug", params: { slug: res.portal.slug } });
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      <header className="mb-6 text-center">
        <p className="text-[10px] sm:text-xs tracking-[0.4em] text-gold uppercase font-semibold">
          MusicHUB · Prompt Studio
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-3xl sm:text-5xl tracking-tight leading-[1.05]">
          Write the <span className="text-gradient-gold">Sound.</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe your track. Tap prompts to stack ideas — they vanish as you use them.
        </p>
      </header>

      {/* The writing area — main focus */}
      <section className="rounded-3xl border border-gold/40 bg-gradient-to-br from-card to-background p-4 sm:p-6 shadow-[0_0_80px_oklch(0.82_0.16_88_/_0.1)] backdrop-blur-xl">
        <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Track Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Midnight Madinah"
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

        {/* Prompts wrapped around the writing area */}
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
                  className="px-3 py-1.5 rounded-full text-xs sm:text-sm border border-border bg-background/40 text-foreground hover:border-gold/60 hover:bg-gold/10 hover:scale-105 active:scale-95 transition-all"
                >
                  + {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold shrink-0" />
          <span className="truncate">0G-BRAIN designs the studio around your prompt</span>
        </div>

        <Button
          onClick={onGenerate}
          disabled={busy}
          size="lg"
          className="mt-3 w-full bg-gold text-primary-foreground hover:bg-gold/90 font-bold tracking-wide"
        >
          {busy ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Spawning…</>
          ) : (
            <><Wand2 className="h-4 w-4 mr-2" /> Spawn Studio</>
          )}
        </Button>
      </section>
    </main>
  );
}
