import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music2, Smile, TrendingUp, Newspaper, Swords, Wrench, ClipboardList, ArrowLeft, Search, ExternalLink, Eye, Crown, Loader2, Sparkles, AlertTriangle, RotateCw } from "lucide-react";
import { requireMember } from "@/lib/route-guards";

type HubKey = "music" | "jokes" | "trade" | "news" | "forms" | "battles" | "tools";
type SortKey = "newest" | "views" | "vip";
const SORT_KEYS: SortKey[] = ["newest", "views", "vip"];

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
  beforeLoad: async (ctx) => {
    if (!(ctx.params.hub in HUBS)) throw notFound();
    await requireMember(ctx as any);
  },
  validateSearch: (search: Record<string, unknown>) => {
    const rawSort = typeof search.sort === "string" ? search.sort : "newest";
    const sort: SortKey = (SORT_KEYS as string[]).includes(rawSort) ? (rawSort as SortKey) : "newest";
    const q = typeof search.q === "string" ? search.q.slice(0, 200) : "";
    return { sort, q };
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
  const { sort, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/vip/portals/$hub" });
  const meta = HUBS[hub as HubKey];
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setQ = (next: string) =>
    navigate({
      search: (prev: { sort: SortKey; q: string }) => ({ ...prev, q: next }),
      replace: true,
    });
  const setSort = (next: SortKey) =>
    navigate({
      search: (prev: { sort: SortKey; q: string }) => ({ ...prev, sort: next }),
      replace: true,
    });

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
            .from("calculators_public")
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
    const needle = q.trim().toLowerCase();
    const base = needle
      ? items.filter((i) => `${i.name} ${i.subtitle} ${i.slug}`.toLowerCase().includes(needle))
      : items.slice();
    if (sort === "views") {
      base.sort((a, b) => b.views - a.views || +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sort === "vip") {
      base.sort((a, b) => Number(b.vip) - Number(a.vip) || +new Date(b.created_at) - +new Date(a.created_at));
    } else {
      base.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return base;
  }, [items, q, sort]);

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

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${meta.label.toLowerCase()} portals…`}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-white/30"
          />
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-1 text-xs font-semibold">
          {([
            { key: "newest", label: "Newest" },
            { key: "views",  label: "Most viewed" },
            { key: "vip",    label: "VIP first" },
          ] as const).map((opt) => {
            const active = sort === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSort(opt.key)}
                className={`px-3 py-1.5 rounded-md transition ${active ? "bg-white/10 text-white" : "text-white/60 hover:text-white/90"}`}
                style={active ? { color: meta.accent } : undefined}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          className="relative overflow-hidden rounded-2xl border border-[#7fb6ff]/30 bg-gradient-to-br from-[#0b1628]/90 via-black/70 to-[#1a2238]/80 p-6 mb-6 animate-fade-in"
          style={{ boxShadow: "0 0 60px -20px rgba(127,182,255,0.35), inset 0 0 40px -20px rgba(192,200,220,0.25)" }}
        >
          <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#7fb6ff]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-[#c8d0e0]/15 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#7fb6ff]/40 bg-[#7fb6ff]/10 text-[#a8c8ff]">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] tracking-[0.4em] uppercase font-semibold text-[#a8c8ff]">Signal lost</p>
              <h3 className="mt-1 font-[Montserrat] font-black text-lg bg-gradient-to-r from-[#e6ecf5] via-[#c8d0e0] to-[#7fb6ff] bg-clip-text text-transparent">
                Couldn't reach the {meta.label.toLowerCase()} hub
              </h3>
              <p className="mt-1 text-sm text-white/70 break-words">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3 py-2 rounded-md border border-[#7fb6ff]/40 text-[#a8c8ff] hover:bg-[#7fb6ff]/10 transition"
              >
                <RotateCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {!items && !error && (
        <div className="animate-fade-in">
          <div
            className="flex items-center gap-3 rounded-2xl border border-[#7fb6ff]/25 bg-gradient-to-r from-[#0b1628]/80 via-black/60 to-[#1a2238]/70 px-5 py-3 mb-5"
            style={{ boxShadow: "0 0 50px -25px rgba(127,182,255,0.4)" }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-[#a8c8ff]" />
            <p className="text-sm font-medium bg-gradient-to-r from-[#e6ecf5] to-[#7fb6ff] bg-clip-text text-transparent">
              Tuning into {meta.hub}…
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="relative overflow-hidden rounded-2xl border border-white/5 bg-black/40 p-5 h-[140px]"
                style={{ boxShadow: "0 0 50px -40px rgba(127,182,255,0.5)" }}
              >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-[#c8d0e0]/10 to-transparent" />
                <div className="space-y-3">
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                  <div className="h-3 w-full rounded bg-white/5" />
                  <div className="h-3 w-4/5 rounded bg-white/5" />
                  <div className="h-3 w-1/3 rounded bg-white/5 mt-6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items && filtered.length === 0 && (
        <div
          className="relative overflow-hidden rounded-2xl border border-[#c8d0e0]/25 bg-gradient-to-br from-[#0b1628]/90 via-black/70 to-[#1a2238]/80 p-10 text-center animate-fade-in"
          style={{ boxShadow: "0 0 80px -30px rgba(127,182,255,0.4), inset 0 0 60px -30px rgba(200,208,224,0.2)" }}
        >
          <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-[#7fb6ff]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-[#c8d0e0]/10 blur-3xl" />
          <div className="relative">
            <span
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#7fb6ff]/40 bg-[#7fb6ff]/10 text-[#a8c8ff] mb-4"
              style={{ boxShadow: "0 0 40px -10px rgba(127,182,255,0.5)" }}
            >
              <Sparkles className="h-6 w-6" />
            </span>
            <h3 className="font-[Montserrat] font-black text-2xl bg-gradient-to-r from-[#e6ecf5] via-[#c8d0e0] to-[#7fb6ff] bg-clip-text text-transparent">
              {q ? "No portals match that search" : `${meta.hub} is quiet… for now`}
            </h3>
            <p className="mt-2 text-sm text-white/60 max-w-md mx-auto">
              {q
                ? `Try a different keyword, or clear the filter to see every ${meta.label.toLowerCase()} portal.`
                : `Nothing's been dropped here yet. Check back soon, or jump into the full Share Hub.`}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-md border border-[#7fb6ff]/40 text-[#a8c8ff] hover:bg-[#7fb6ff]/10 transition"
                >
                  Clear search
                </button>
              )}
              <Link
                to="/portals"
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-md bg-gradient-to-r from-[#7fb6ff]/20 to-[#c8d0e0]/20 border border-[#c8d0e0]/30 text-white hover:from-[#7fb6ff]/30 hover:to-[#c8d0e0]/30 transition"
              >
                Browse the full Share Hub <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
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