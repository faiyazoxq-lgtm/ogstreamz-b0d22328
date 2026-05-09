import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Swords, Skull, Plus, Copy, ExternalLink, Loader2, Share2, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { spawnBattle, type BattleLanguage } from "@/lib/battles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/battle")({
  head: () => ({
    meta: [
      { title: "BattleHUB · Every Choice Is A Loss" },
      { name: "description", content: "BattleHUB — generate sweary, dark-comedy multiple-choice games where every option is a disaster. Share the portal link with your audience." },
    ],
  }),
  component: BattlePage,
});

type Battle = {
  id: string;
  slug: string;
  name: string;
  scenario: string;
  language: string;
  themes: string[];
  accent: string;
  emoji: string;
  tagline: string;
  view_count: number;
  public: boolean;
};

function BattlePage() {
  const { profile, isAdmin } = useAuth();
  const isBoss = profile?.rank === "boss" || isAdmin;
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase
      .from("battles")
      .select("id, slug, name, scenario, language, themes, accent, emoji, tagline, view_count, public")
      .order("created_at", { ascending: false })
      .limit(60);
    setBattles((data as Battle[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--syndicate-glow)" }}>
          <Swords className="inline h-3.5 w-3.5 mr-2 neon-icon" />BattleHUB
        </p>
        <h1 className="mt-3 syndicate-header text-4xl sm:text-6xl text-metallic">Every Choice Is A Loss</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Boss-spawned multiple-choice games. You describe the scenario, the AI builds a savage four-option round where every option ends badly. Share the portal link with your audience.
        </p>
      </header>

      {isBoss && <SpawnPanel onSpawned={refresh} />}

      <section className="mt-10">
        <h2 className="syndicate-header text-sm mb-4" style={{ color: "var(--syndicate-glow)" }}>Live Portals</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-44 rounded-2xl" />
            ))}
          </div>
        ) : battles.length === 0 ? (
          <p className="text-muted-foreground text-sm">No battles spawned yet. {isBoss ? "Spawn one above." : "Come back soon."}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {battles.map((b) => <BattleCard key={b.id} b={b} />)}
          </div>
        )}
      </section>
    </main>
  );
}

function BattleCard({ b }: { b: Battle }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/b/${b.slug}` : `/b/${b.slug}`;
  return (
    <div className="glass-obsidian rounded-2xl p-5 flex flex-col gap-3" style={{ borderColor: `${b.accent}66` }}>
      <div className="flex items-start justify-between">
        <div className="text-3xl">{b.emoji}</div>
        <span className="text-[10px] uppercase tracking-[0.3em] terminal-mono px-2 py-1 rounded" style={{ background: `${b.accent}22`, color: b.accent }}>
          {b.language}
        </span>
      </div>
      <h3 className="syndicate-header text-lg" style={{ color: b.accent }}>{b.name}</h3>
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{b.tagline}</p>
      <p className="text-sm text-muted-foreground line-clamp-2">{b.scenario}</p>
      <div className="flex flex-wrap gap-1">
        {(b.themes ?? []).slice(0, 4).map((t) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/70">#{t}</span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Link
          to="/b/$slug"
          params={{ slug: b.slug }}
          className="btn-magnetic flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs uppercase tracking-[0.2em] font-bold"
          style={{ background: `${b.accent}22`, border: `1px solid ${b.accent}88`, color: b.accent }}
        >
          Play <ExternalLink className="h-3 w-3" />
        </Link>
        <button
          onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}
          className="btn-magnetic px-3 py-2 rounded-lg text-xs glass-obsidian"
          title="Copy share link"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SpawnPanel({ onSpawned }: { onSpawned: () => void }) {
  const spawn = useServerFn(spawnBattle);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [scenario, setScenario] = useState("");
  const [accent, setAccent] = useState("#ff2e55");
  const [emoji, setEmoji] = useState("💀");
  const [lastSlug, setLastSlug] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await spawn({
        data: {
          name,
          scenario,
          language: "chaotic" as BattleLanguage,
          themes: [],
          custom_prompt: "",
          accent,
          emoji,
          tagline: "EVERY CHOICE IS A LOSS",
          public: true,
          use_research: true,
        },
      });
      setLastSlug(res.slug);
      toast.success(`BattleHUB portal "${res.battle.name}" spawned`);
      setName(""); setScenario("");
      onSpawned();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to spawn");
    } finally {
      setBusy(false);
    }
  };

  const PRESETS: { label: string; emoji: string; accent: string; name: string; scenario: string }[] = [
    {
      label: "Monday From Hell",
      emoji: "☠️",
      accent: "#ff2e55",
      name: "Monday From Hell",
      scenario: "You're hungover as fuck on a Monday morning. Your boss is on the warpath, your laptop's dead, the coffee machine's broken, and you've got a standup in 90 seconds. Every option is a fucking disaster waiting to detonate your career.",
    },
    {
      label: "Pub Brawl Roulette",
      emoji: "🍺",
      accent: "#ffb02e",
      name: "Pub Brawl Roulette",
      scenario: "It's 1am in a Wetherspoons. You've spilled a stranger's pint, his girlfriend's eyeing you up, the bouncer hates your face, and your mate's gone to the bog with the only Uber on the app. Pick your poison — every choice ends with blood, vomit, or a barring order.",
    },
    {
      label: "Family Christmas Meltdown",
      emoji: "🎄",
      accent: "#1fdc7d",
      name: "Family Christmas Meltdown",
      scenario: "Christmas Day at your mum's. Nan's pissed on sherry, your brother's brought his new vegan girlfriend, the turkey's burnt, and dad's started on the politics. Every reply makes someone cry, scream, or storm out into the rain.",
    },
    {
      label: "Tinder Date Apocalypse",
      emoji: "💔",
      accent: "#ff5acd",
      name: "Tinder Date Apocalypse",
      scenario: "First date. They look nothing like the photos, they've ordered the most expensive bottle on the menu, your card just declined, and your ex just walked in with your best mate. Every move turns this date into a shit-stained anecdote.",
    },
    {
      label: "Festival Toilet Hell",
      emoji: "🚽",
      accent: "#a371ff",
      name: "Festival Toilet Hell",
      scenario: "Day three at a muddy festival. You're caked in piss, lost your wristband, your phone's at 2%, and you desperately need a shit. The portaloos are warzones. Every option ends in horror, embarrassment, or sectioning.",
    },
    {
      label: "Job Interview Nightmare",
      emoji: "💼",
      accent: "#2ec5ff",
      name: "Job Interview Nightmare",
      scenario: "Final round interview at your dream job. You're sweating through your shirt, you've forgotten the CEO's name, your fly's down, and you just realised you slagged the company off on LinkedIn last week. Every answer digs the grave deeper.",
    },
    {
      label: "Stag Do Catastrophe",
      emoji: "👰",
      accent: "#ff7a1a",
      name: "Stag Do Catastrophe",
      scenario: "Stag do in Prague. The groom's missing, you've lost the passports, somebody ordered a stripper who's now demanding cash, and the bride's ringing nonstop. Every choice ruins the wedding before it starts.",
    },
    {
      label: "School Run Massacre",
      emoji: "🚸",
      accent: "#7dff2e",
      name: "School Run Massacre",
      scenario: "8:47am. The kids haven't got shoes on, the dog's eaten the lunchbox, you're double-parked outside Karen-from-the-PTA's Range Rover, and you're still in your dressing gown. Every move ends with social services, a fight, or both.",
    },
  ];

  const usePreset = (p: typeof PRESETS[number]) => {
    setName(p.name);
    setScenario(p.scenario);
    setEmoji(p.emoji);
    setAccent(p.accent);
  };

  return (
    <form onSubmit={submit} className="glass-obsidian-strong rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 syndicate-header text-sm" style={{ color: "var(--syndicate-glow)" }}>
        <Flame className="h-4 w-4 neon-icon" /> Spawn Brutal Portal · Chaotic Mode Forced
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-2 block">
          Pick a preset · or write your own filth below
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => usePreset(p)}
              className="btn-magnetic text-left rounded-lg p-2.5 glass-obsidian hover:bg-white/5 transition group"
              style={{ borderLeft: `3px solid ${p.accent}` }}
              title={p.scenario}
            >
              <div className="text-xl leading-none mb-1">{p.emoji}</div>
              <div className="text-[11px] uppercase tracking-[0.15em] font-bold" style={{ color: p.accent }}>
                {p.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Portal Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Monday From Hell"
          required
          className="text-base font-bold"
        />
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          The Filth · Describe the unwinnable scenario
        </label>
        <Textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="You're hungover, your boss hates you, the wifi's dead, and every choice you make ends in absolute carnage. Get foul. The AI will get fouler."
          rows={4}
          required
        />
        <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Swearing AI is locked on · Every choice loses · Be as vile as you like
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground block mb-1">Accent</label>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-12 h-10 rounded-md bg-input border border-border cursor-pointer" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground block mb-1">Emoji</label>
          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="w-16 text-center text-lg" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" disabled={busy} className="btn-magnetic font-bold uppercase tracking-[0.2em]">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Skull className="h-4 w-4 mr-2" />}
          Unleash The Filth
        </Button>
        {lastSlug && (
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/b/${lastSlug}`;
              navigator.clipboard.writeText(url);
              toast.success("Share link copied");
            }}
            className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3 w-3" /> Copy /b/{lastSlug}
          </button>
        )}
      </div>
    </form>
  );
}