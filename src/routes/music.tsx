import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wand2, Loader2, Sparkles, X, Plus } from "lucide-react";
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
      { name: "description", content: "Stack style chips, describe your vision, then spawn a custom lyrics studio tuned to your sound." },
    ],
  }),
  component: MusicPromptBuilder,
});

type Group = {
  id: string;
  label: string;
  hint: string;
  theme?: string;
  options: string[];
};

const GROUPS: Group[] = [
  {
    id: "language",
    label: "Language",
    hint: "Pick the tongue your lyrics will speak",
    options: ["English", "Urdu", "Arabic", "Hindi", "Spanish", "French", "Punjabi", "Bengali", "Turkish", "Swahili", "Mandarin", "Japanese"],
  },
  {
    id: "religion",
    label: "Spiritual / Cultural",
    hint: "Optional — colors the lyrical voice",
    theme: "spiritual-blue",
    options: ["Nasheed", "Sufi", "Gospel", "Devotional", "Bhajan", "Qawwali", "Hymn", "Secular"],
  },
  {
    id: "rap",
    label: "Rap / Hip-Hop Style",
    hint: "Choose your flow",
    theme: "street-neon",
    options: ["UK Drill", "Trap", "Boom Bap", "Grime", "Afrobeat Rap", "Latin Trap", "Conscious", "Mumble", "Lyrical Miracle", "Old School"],
  },
  {
    id: "genre",
    label: "Genre",
    hint: "Big-picture sound",
    options: ["Pop", "R&B", "Lo-Fi", "Rock", "EDM", "House", "Reggae", "Country", "Jazz", "Soul", "Indie", "Punk", "Metal"],
  },
  {
    id: "pace",
    label: "Pace / BPM",
    hint: "How fast does it hit",
    options: ["Slow Burn (60-80)", "Mid-Tempo (90-110)", "Driving (120-130)", "Fast (140+)", "Half-Time", "Double-Time"],
  },
  {
    id: "mood",
    label: "Mood",
    hint: "The emotional weather",
    theme: "lofi-haze",
    options: ["Triumphant", "Melancholic", "Romantic", "Aggressive", "Hopeful", "Nostalgic", "Eerie", "Euphoric", "Reflective", "Defiant"],
  },
  {
    id: "instruments",
    label: "Instruments / Texture",
    hint: "What carries the melody",
    theme: "warm-folk",
    options: ["808s", "Acoustic Guitar", "Piano", "Strings", "Analog Synth", "Choir", "Tabla", "Oud", "Brass", "Vinyl Crackle", "Sub Bass", "Live Drums"],
  },
  {
    id: "vocals",
    label: "Vocal Texture",
    hint: "How the voice should feel",
    options: ["Smooth", "Raspy", "Auto-Tuned", "Whispered", "Powerhouse", "Falsetto", "Spoken Word", "Layered Harmonies"],
  },
];

function MusicPromptBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const spawnFn = useServerFn(spawnMusicPortal);

  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [language, setLanguage] = useState("English");
  const [theme, setTheme] = useState("street-neon");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const allChips = useMemo(() => {
    const list: string[] = [];
    Object.values(selected).forEach((set) => set.forEach((v) => list.push(v)));
    return list;
  }, [selected]);

  const toggle = (group: Group, value: string) => {
    setSelected((prev) => {
      const cur = new Set(prev[group.id] ?? []);
      const wasOn = cur.has(value);
      if (wasOn) {
        cur.delete(value);
      } else {
        cur.add(value);
        if (group.id === "language") setLanguage(value);
        if (group.theme) setTheme(group.theme);
        // auto-paste keyword into the writing box
        setDescription((d) => {
          const trimmed = d.trim();
          if (!trimmed) return value;
          if (trimmed.toLowerCase().includes(value.toLowerCase())) return d;
          return `${trimmed}, ${value}`;
        });
      }
      return { ...prev, [group.id]: cur };
    });
  };

  const removeChip = (value: string) => {
    setSelected((prev) => {
      const next: Record<string, Set<string>> = {};
      for (const [k, set] of Object.entries(prev)) {
        const copy = new Set(set);
        copy.delete(value);
        next[k] = copy;
      }
      return next;
    });
    setDescription((d) =>
      d
        .split(/,\s*/)
        .filter((p) => p.trim().toLowerCase() !== value.toLowerCase())
        .join(", ")
    );
  };

  const onGenerate = async () => {
    if (!user) {
      toast.error("Sign in to spawn a studio");
      navigate({ to: "/auth" });
      return;
    }
    if (!name.trim()) return toast.error("Name your track first");
    if (!description.trim()) return toast.error("Describe your sound — pick chips or type");
    setBusy(true);
    try {
      const res = await spawnFn({
        data: {
          name: name.trim(),
          description: description.trim(),
          style_tags: allChips.join(", "),
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
    <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fade-in">
      <header className="mb-6 sm:mb-8">
        <p className="text-[10px] sm:text-xs tracking-[0.4em] text-gold uppercase font-semibold">MusicHUB · Prompt Studio</p>
        <h1 className="mt-2 font-[Montserrat] font-black text-3xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
          Stack the <span className="text-gradient-gold">Sound.</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
          Tap keywords — they auto-paste into your brief. Hit <span className="text-gold font-semibold">Spawn Studio</span> to launch a custom lyrics studio.
        </p>
      </header>

      <div className="grid gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        {/* Chip groups */}
        <div className="grid gap-3 sm:gap-4 min-w-0">
          {GROUPS.map((g) => (
            <section
              key={g.id}
              className="rounded-xl border border-border bg-card/60 backdrop-blur p-3 sm:p-4 hover:border-gold/40 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
                <h2 className="font-semibold tracking-tight text-sm sm:text-base">{g.label}</h2>
                <span className="text-[10px] sm:text-xs text-muted-foreground">{g.hint}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.options.map((opt) => {
                  const on = selected[g.id]?.has(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggle(g, opt)}
                      className={
                        "px-2.5 py-1 rounded-full text-xs sm:text-sm border transition-all hover-scale " +
                        (on
                          ? "bg-gold text-primary-foreground border-gold shadow-[0_0_16px_oklch(0.82_0.16_88_/_0.4)]"
                          : "bg-background/40 border-border text-foreground hover:border-gold/60")
                      }
                    >
                      {on && <Plus className="inline h-3 w-3 mr-0.5 rotate-45" />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Brief panel — sticky on desktop, inline on mobile */}
        <aside className="lg:sticky lg:top-4 lg:self-start min-w-0">
          <section className="rounded-2xl border border-gold/40 bg-gradient-to-br from-card to-background p-4 sm:p-5 shadow-[0_0_60px_oklch(0.82_0.16_88_/_0.08)] backdrop-blur-xl">
            <div className="grid gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Track Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Midnight Madinah"
                  className="mt-1 bg-background/60"
                  maxLength={80}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your Brief</label>
                  {allChips.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">{allChips.length} stacked</span>
                  )}
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tap chips or type freely…"
                  className="mt-1 min-h-28 max-h-60 bg-background/60 font-mono text-xs sm:text-sm leading-relaxed resize-y"
                  maxLength={1000}
                />
                {allChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 animate-fade-in max-h-28 overflow-y-auto">
                    {allChips.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-gold/10 border border-gold/40 text-gold"
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() => removeChip(c)}
                          className="hover:text-foreground"
                          aria-label={`Remove ${c}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-gold shrink-0" />
                <span className="truncate">0G-BRAIN designs the studio around your prompt</span>
              </div>

              <Button
                onClick={onGenerate}
                disabled={busy}
                size="lg"
                className="w-full bg-gold text-primary-foreground hover:bg-gold/90 font-bold tracking-wide"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Spawning…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" /> Spawn Studio
                  </>
                )}
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}