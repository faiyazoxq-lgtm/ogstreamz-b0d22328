import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Copy, Check, Radio, Sparkles, Lock, Music, Wrench, Mic2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type GalleryItem = {
  id: string;
  slug: string;
  name: string;
  kind: "joke" | "music" | "tool";
  category: "joke" | "music" | "tool";
  description: string | null;
  language: string | null;
  vibe: string | null;
  vip: boolean;
  created_at: string;
  path: string;
  theme_config: any;
};

const FILTERS: Array<{ key: "all" | "joke" | "music" | "tool"; label: string; Icon: any }> = [
  { key: "all", label: "All", Icon: Radio },
  { key: "joke", label: "Jokes", Icon: Mic2 },
  { key: "music", label: "Music", Icon: Music },
  { key: "tool", label: "Tools", Icon: Wrench },
];

export function SyndicateGallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "joke" | "music" | "tool">("all");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("syndicate_gallery" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => setItems((data ?? []) as unknown as GalleryItem[]));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== "all" && it.category !== filter) return false;
      if (!needle) return true;
      const hay = `${it.name} ${it.description ?? ""} ${it.language ?? ""} ${it.vibe ?? ""} ${it.kind}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, filter]);

  const copy = async (item: GalleryItem) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}${item.path}` : item.path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(item.id);
      toast.success("Link copied");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs tracking-[0.4em] uppercase font-semibold inline-flex items-center gap-2"
            style={{ color: "var(--neon-blue-bright)" }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            LIVE TRANSMISSIONS
          </p>
          <h2 className="mt-2 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">Syndicate Gallery</h2>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search niche, language, vibe…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(({ key, label, Icon }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs uppercase tracking-widest font-bold transition-all ${
                active
                  ? "bg-[var(--neon-blue-bright)] text-black shadow-[0_0_24px_-4px_var(--neon-blue-bright)]"
                  : "border border-border text-muted-foreground hover:text-white hover:border-white/40"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-16">
          {items.length === 0 ? "No transmissions yet — spawn one from the Admin Console." : "No match for your search."}
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto pb-3 scrollbar-thin snap-x snap-mandatory">
          <ul className="flex gap-4 px-2 min-w-max">
            {filtered.map((it) => (
              <li key={it.id} className="snap-start">
                <GalleryCard item={it} onCopy={copy} copied={copied === it.id} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function GalleryCard({ item, onCopy, copied }: { item: GalleryItem; onCopy: (i: GalleryItem) => void; copied: boolean }) {
  const accent =
    item.theme_config?.accent ||
    item.theme_config?.theme?.accent ||
    "var(--neon-blue-bright)";
  const bg = item.theme_config?.bg || item.theme_config?.theme?.bg || "#06121f";
  const emoji = item.theme_config?.ornament || item.theme_config?.theme?.emoji || categoryEmoji(item.category);
  const isNew = Date.now() - new Date(item.created_at).getTime() < 60 * 60 * 1000;

  const KindIcon = item.category === "music" ? Music : item.category === "tool" ? Wrench : Mic2;

  return (
    <article
      className="group relative w-72 sm:w-80 rounded-2xl border border-border overflow-hidden bg-card transition-all duration-500 hover:-translate-y-1 hover:border-[color:var(--neon-blue-bright)]"
      style={{ boxShadow: "0 0 0 transparent" }}
    >
      {/* Animated themed preview, revealed on hover */}
      <div className="relative h-36 overflow-hidden">
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{ background: `linear-gradient(135deg, ${bg} 0%, ${accent}33 100%)` }}
        />
        {/* Static effect overlay clears on hover */}
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-screen opacity-90 group-hover:opacity-0 transition-opacity duration-700"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px), radial-gradient(circle at 30% 40%, rgba(255,255,255,0.1) 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "100% 4px, 4px 4px, 6px 6px",
            animation: "tv-static 0.2s steps(2) infinite",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl drop-shadow-[0_0_20px_rgba(58,214,255,0.6)] transition-transform duration-700 group-hover:scale-110">
            {emoji}
          </span>
        </div>
        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[10px] uppercase tracking-widest text-white">
            <KindIcon className="h-3 w-3" />{item.category}
          </span>
          <div className="flex gap-1">
            {isNew && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest text-black animate-pulse"
                style={{ background: "var(--neon-blue-bright)", boxShadow: "0 0 16px var(--neon-blue-bright)" }}>
                <Sparkles className="inline h-2.5 w-2.5 mr-0.5" />NEW
              </span>
            )}
            {item.vip && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest border border-yellow-400/60 text-yellow-300 bg-black/50">
                <Lock className="inline h-2.5 w-2.5 mr-0.5" />VIP
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-[Montserrat] font-black text-lg text-metallic line-clamp-1">{item.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
          {item.description || item.vibe || "Spawned by the 0G-AI Agent."}
        </p>

        <div className="mt-4 flex gap-2">
          <Link
            to={item.path}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold text-black transition-shadow"
            style={{ background: "var(--neon-blue-bright)", boxShadow: "0 0 0 transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 24px var(--neon-blue-bright)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 0 transparent")}
          >
            Launch →
          </Link>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onCopy(item)}
            aria-label="Copy share link"
            className="border-border"
          >
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </article>
  );
}

function categoryEmoji(c: string): string {
  if (c === "music") return "🎙️";
  if (c === "tool") return "🛠️";
  return "🎤";
}