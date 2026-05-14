import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music2, Smile, TrendingUp, Newspaper, Swords, Wrench, ClipboardList, ArrowLeft, Search, ExternalLink, Eye, Crown } from "lucide-react";
import { requireMember } from "@/lib/route-guards";

type HubKey = "music" | "jokes" | "trade" | "news" | "forms" | "battles" | "tools";

type HubMeta = {
  slug: HubKey;
  label: string;
  hub: string;
  blurb: string;
  Icon: any;
  accent: string;
  // DB kinds that belong to this hub (for `portals` table)
  kinds: string[];
  // Where rows live + how to deep-link
  source: "portals" | "battles" | "tools";
  to: "/m/$slug" | "/p/$slug" | "/td/$slug" | "/f/$slug" | "/b/$slug" | "/t/$slug";
};

const HUBS: Record<HubKey, HubMeta> = {
  music:   { slug: "music",   label: "Music",   hub: "MusicHUB",  blurb: "Drops, releases & repeat-plays.",  Icon: Music2,        accent: "#3ad6ff", kinds: ["music"], source: "portals", to: "/m/$slug" },
  jokes:   { slug: "jokes",   label: "Jokes",   hub: "JokesHUB",  blurb: "Fast wit, joke battles, gremlins.", Icon: Smile,        accent: "#ffd166", kinds: ["joke"],  source: "portals", to: "/p/$slug" },
  trade:   { slug: "trade",   label: "Trade",   hub: "TradeHUB",  blurb: "Live signals & bias meters.",      Icon: TrendingUp,    accent: "#D4AF37", kinds: ["trade"], source: "portals", to: "/td/$slug" },
  news:    { slug: "news",    label: "News",    hub: "NewsHUB",   blurb: "Hot takes & sharp headlines.",     Icon: Newspaper,     accent: "#a78bfa", kinds: ["news"],  source: "portals", to: "/p/$slug" },
  forms:   { slug: "forms",   label: "Forms",   hub: "FormHUB",   blurb: "Capture, qualify, follow up.",     Icon: ClipboardList, accent: "#7dd3fc", kinds: ["form"],  source: "portals", to: "/f/$slug" },
  battles: { slug: "battles", label: "Battles", hub: "BattleHUB", blurb: "Every choice is a loss.",          Icon: Swords,        accent: "#ff2e55", kinds: [],        source: "battles", to: "/b/$slug" },
  tools:   { slug: "tools",   label: "Tools",   hub: "ToolHUB",   blurb: "Calculators & spawn-a-tool.",      Icon: Wrench,        accent: "#5cbdb9", kinds: [],        source: "tools",   to: "/t/$slug" },
};

type Item = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  vip: boolean;
  views: number;
  created_at: string;
};

export const Route = createFileRoute("/vip/portals/$hub")({
  beforeLoad: ({ params }) => {
    if (!(params.hub in HUBS)) throw notFound();
    return requireMember({ location: { pathname: `/vip/portals/${params.hub}` } } as any);
  },
  head: ({ params }) => {
    const meta = HUBS[params.hub as HubKey];
    const title = meta ? `${meta.hub} Portals — VIP` : "VIP Portals";
    const desc = meta ? `Browse every portal in ${meta.hub}. ${meta.blurb}` : "Browse VIP portals.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: VipPortalsByHub,
  notFoundComponent: () => (
    <main className="max-w-3xl mx-auto px-5 py-20 text-center">
      <h1 className="text-3xl font-black mb-2">Hub not found</h1>
      <p className="text-muted-foreground mb-6">That category doesn't exist.</p>
      <Link to="/vip/portals" className="underline">Back to all hubs</Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="max-w-3xl mx-auto px-5 py-20 text-center">
      <h1 className="text-3xl font-black mb-2">Something broke</h1>
      <p className="text-muted-foreground mb-6">{error.message}</p>
      <Link to="/vip/portals" className="underline">Back to all hubs</Link>
    </main>
  ),
});

function VipPortalsByHub() {
  const { hub } = Route.useParams();
  const meta = HUBS[hub as HubKey];
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = supabase as any;
        let rows: Item[] = [];
        if (meta.source === "portals") {
          const { data, error } = await sb
            .from("portals_public")
            .select("id, slug, name, niche, kind, vip, view_count, created_at")
            .in("kind", meta.kinds)
            .order("created_at", { ascending: false })
            .limit(500);
          if (error) throw error;
          rows = (data ?? []).map((p: any) => ({
            id: p.id, slug: p.slug, name: p.name,
            subtitle: p.niche || "",
            vip: !!p.vip, views: p.view_count || 0, created_at: p.created_at,
          }));
        } else if (meta.source === "battles") {
          const { data, error } = await sb
            .from("battles")
            .select("id, slug, name, tagline, view_count, created_at, public")
            .order("created_at", { ascending: false })
            .limit(500);
          if (error) throw error;
          rows = (data ?? [])
            .filter((b: any) => b.public !== false)
            .map((b: any) => ({
              id: b.id, slug: b.slug, name: b.name,
              subtitle: b.tagline || "Battle scenario",
              vip: false, views: b.view_count || 0, created_at: b.created_at,
            }));
        } else {
          const { data, error } = await sb
            .from("calculators")
            .select("id, slug, name, description, vip, created_at, published")
            .eq("published", true)
            .order("created_at", { ascending: false })
            .limit(500);
          if (error) throw error;
          rows = (data ?? []).map((t: any) => ({
            id: t.id, slug: t.slug, name: t.name,
            subtitle: t.description || "Spawned tool",
            vip: !!t.vip, views: 0, created_at: t.created_at,
          }));
        }
        if (!cancelled) setItems(rows);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      }
    })();
    return () => { cancelled = true; };
  }, [hub]);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!q.trim()) return items;
    const needle = q.toLowerCase();
    return items.filter((i) => `${i.name} ${i.subtitle} ${i.slug}`.toLowerCase().includes(needle));
  }, [items, q]);

  const Icon = meta.Icon;

  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-12 pb-24 md:pb-14">
      <nav className="mb-6 text-xs flex items-center gap-2 text-white/50">
        <Link to="/vip" className="hover:text-white/80">VIP</Link>
        <span>/</span>
        <Link to="/vip/portals" className="hover:text-white/80">Portals</Link>
        <span>/</span>
        <span className="text-white/80">{meta.label}</span>
      </nav>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <span
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: `${meta.accent}1f`, color: meta.accent, boxShadow: `0 0 30px -10px ${meta.accent}` }}
          >
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.4em] uppercase font-semibold" style={{ color: meta.accent }}>
              {meta.hub}
            </p>
            <h1 className="mt-1 font-[Montserrat] font-black text-3xl sm:text-4xl tracking-tight">
              {meta.label} portals
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">{meta.blurb}</p>
          </div>
        </div>
        <Link
          to="/vip/portals"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3 py-2 rounded-md border border-white/10 hover:border-white/30 hover:bg-white/5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All hubs
        </Link>
      </header>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${meta.label.toLowerCase()} portals…`}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-white/30"
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {!items && !error && (
        <p className="text-sm text-white/50">Loading…</p>
      )}

      {items && filtered.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
          <p className="text-white/70">
            No {meta.label.toLowerCase()} portals yet{q ? " matching that search" : ""}.
          </p>
          <Link to="/portals" className="mt-3 inline-block text-sm underline" style={{ color: meta.accent }}>
            Browse the full Share Hub →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((i) => (
          <Link
            key={i.id}
            to={meta.to}
            params={{ slug: i.slug }}
            className="group rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-5 transition hover:border-white/30 hover:bg-black/60"
            style={{ boxShadow: `0 0 50px -40px ${meta.accent}` }}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-base leading-snug truncate" title={i.name}>{i.name}</h3>
              {i.vip && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-300/40 text-amber-300 bg-amber-300/10">
                  <Crown className="h-3 w-3" /> VIP
                </span>
              )}
            </div>
            {i.subtitle && (
              <p className="mt-1 text-xs text-white/60 line-clamp-2">{i.subtitle}</p>
            )}
            <div className="mt-4 flex items-center justify-between text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> {i.views.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider opacity-80 group-hover:opacity-100" style={{ color: meta.accent }}>
                Open <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}