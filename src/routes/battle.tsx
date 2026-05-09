import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Swords, Skull, Sparkles, Plus, Copy, ExternalLink, Loader2, Share2 } from "lucide-react";
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
  const [language, setLanguage] = useState<BattleLanguage>("medium");
  const [themes, setThemes] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [accent, setAccent] = useState("#ff2e55");
  const [emoji, setEmoji] = useState("💀");
  const [tagline, setTagline] = useState("EVERY CHOICE IS A LOSS");
  const [useResearch, setUseResearch] = useState(true);
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
          language,
          themes: themes.split(",").map((t) => t.trim()).filter(Boolean),
          custom_prompt: customPrompt,
          accent,
          emoji,
          tagline,
          public: true,
          use_research: useResearch,
        },
      });
      setLastSlug(res.slug);
      toast.success(`BattleHUB portal "${res.battle.name}" spawned`);
      setName(""); setScenario(""); setThemes(""); setCustomPrompt("");
      onSpawned();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to spawn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-obsidian-strong rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 syndicate-header text-sm" style={{ color: "var(--syndicate-glow)" }}>
        <Plus className="h-4 w-4 neon-icon" /> Spawn New Battle Portal
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office Survival Hell" required />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Tagline</label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="EVERY CHOICE IS A LOSS" />
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Scenario / Description</label>
        <Textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="You're a junior analyst on your first day. The Monday standup is in 3 minutes. Your boss is in a foul mood. Your laptop is dead. Every option ends badly."
          rows={4}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as BattleLanguage)}
            className="w-full mt-1 rounded-md bg-input border border-border px-3 py-2 text-sm"
          >
            <option value="clean">Clean (PG)</option>
            <option value="mild">Mild (PG-13)</option>
            <option value="medium">Medium (Adult)</option>
            <option value="chaotic">Chaotic (Unhinged)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Themes (comma-separated)</label>
          <Input value={themes} onChange={(e) => setThemes(e.target.value)} placeholder="office, hangover, monday, awkward" />
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Custom Game-Master Prompt (optional)</label>
        <Textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Lean Cockney slang. Reference 90s TV. Always end consequences with a one-liner."
          rows={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 items-end">
        <div>
          <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Accent</label>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-full h-10 rounded-md bg-input border border-border" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Emoji</label>
          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useResearch} onChange={(e) => setUseResearch(e.target.checked)} />
          Pull live research (Perplexity)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" disabled={busy} className="btn-magnetic">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Skull className="h-4 w-4 mr-2" />}
          Spawn Portal
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