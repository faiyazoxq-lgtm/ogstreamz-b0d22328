import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, Music2, Smile, TrendingUp, Newspaper, Swords, Wrench, Search, Crown } from "lucide-react";
import { toast } from "sonner";

type PortalRow = {
  id: string;
  slug: string;
  name: string;
  niche: string | null;
  kind: string;
  vip: boolean;
  view_count: number;
  created_at: string;
};

type BattleRow = {
  id: string; slug: string; name: string; tagline: string | null; view_count: number; created_at: string; public: boolean;
};

type ToolRow = {
  id: string; slug: string; name: string; description: string | null; vip: boolean; created_at: string; published: boolean;
};

type Item = {
  id: string; slug: string; name: string; subtitle: string;
  kind: "music" | "joke" | "trade" | "news" | "battle" | "tool";
  to: "/m/$slug" | "/p/$slug" | "/td/$slug" | "/b/$slug" | "/t/$slug";
  vip: boolean; views: number; created_at: string;
};

const KIND_META: Record<Item["kind"], { label: string; Icon: any; accent: string }> = {
  music:  { label: "Music",  Icon: Music2,     accent: "#3ad6ff" },
  joke:   { label: "Jokes",  Icon: Smile,      accent: "#ffd166" },
  trade:  { label: "Trade",  Icon: TrendingUp, accent: "#D4AF37" },
  news:   { label: "News",   Icon: Newspaper,  accent: "#a78bfa" },
  battle: { label: "Battle", Icon: Swords,     accent: "#ff2e55" },
  tool:   { label: "Tool",   Icon: Wrench,     accent: "#5cbdb9" },
};

const PORTAL_TO: Record<string, Item["to"]> = {
  music: "/m/$slug",
  joke: "/p/$slug",
  trade: "/td/$slug",
  news: "/p/$slug",
};

export const Route = createFileRoute("/portals")({
  head: () => ({
    meta: [
      { title: "All Portals — 0G Share Hub" },
      { name: "description", content: "Every portal you've spawned across MusicHUB, JokesHUB, TradeHUB, BattleHUB and ToolHUB — ready to share." },
    ],
  }),
  component: PortalsHub,
});

function PortalsHub() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Item["kind"]>("all");
  const [q, setQ] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    (async () => {
      try {
        const [{ data: portals, error: pErr }, { data: battles, error: bErr }, { data: tools, error: tErr }] =
          await Promise.all([
            supabase.from("portals")
              .select("id, slug, name, niche, kind, vip, view_count, created_at")
              .order("created_at", { ascending: false }),
            supabase.from("battles")
              .select("id, slug, name, tagline, view_count, created_at, public")
              .order("created_at", { ascending: false }),
            supabase.from("calculators")
              .select("id, slug, name, description, vip, created_at, published")
              .order("created_at", { ascending: false }),
          ]);
        if (pErr) throw pErr;
        if (bErr) throw bErr;
        if (tErr) throw tErr;

        const out: Item[] = [];
        for (const p of (portals as PortalRow[] | null) ?? []) {
          const to = PORTAL_TO[p.kind] ?? "/p/$slug";
          const kind = (["music","joke","trade","news"].includes(p.kind) ? p.kind : "joke") as Item["kind"];
          out.push({
            id: p.id, slug: p.slug, name: p.name, subtitle: p.niche || "",
            kind, to, vip: !!p.vip, views: p.view_count || 0, created_at: p.created_at,
          });
        }
        for (const b of (battles as BattleRow[] | null) ?? []) {
          out.push({
            id: b.id, slug: b.slug, name: b.name, subtitle: b.tagline || "Battle scenario",
            kind: "battle", to: "/b/$slug", vip: false, views: b.view_count || 0, created_at: b.created_at,
          });
        }
        for (const t of (tools as ToolRow[] | null) ?? []) {
          if (!t.published) continue;
          out.push({
            id: t.id, slug: t.slug, name: t.name, subtitle: t.description || "Spawned tool",
            kind: "tool", to: "/t/$slug", vip: !!t.vip, views: 0, created_at: t.created_at,
          });
        }
        out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        setItems(out);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load portals");
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (filter !== "all" && i.kind !== filter) return false;
      if (q && !(`${i.name} ${i.subtitle} ${i.slug}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [items, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0 };
    for (const i of items ?? []) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [items]);

  const buildHref = (i: Item) => i.to.replace("$slug", i.slug);

  const copyLink = async (i: Item) => {
    try {
      await navigator.clipboard.writeText(`${origin}${buildHref(i)}`);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const shareAll = async () => {
    const lines = filtered.map((i) => `${i.name} — ${origin}${buildHref(i)}`).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      toast.success(`Copied ${filtered.length} link${filtered.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-24 md:pb-14">
      <header className="mb-8">
        <p className="text-xs tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--mood-accent, #ffd166)" }}>
          0G · Share Hub
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-4xl sm:text-5xl tracking-tight">
          All Portals
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl">
          Every portal you've spawned — Music, Jokes, Trade, News, Battles and Tools — in one share-ready feed. Tap a card to open it, or copy a clean link to drop anywhere.
        </p>
      </header>

      {/* Controls */}
      <div className="mb-6 grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(["all","music","joke","trade","news","battle","tool"] as const).map((k) => {
            const active = filter === k;
            const meta = k === "all" ? null : KIND_META[k];
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold border transition"
                style={{
                  borderColor: active ? (meta?.accent ?? "var(--mood-accent,#ffd166)") : "rgba(255,255,255,0.12)",
                  background: active ? "rgba(255,255,255,0.06)" : "transparent",
                  color: active ? (meta?.accent ?? "var(--mood-accent,#ffd166)") : "rgba(255,255,255,0.7)",
                }}
              >
                {meta && <meta.Icon className="h-3.5 w-3.5" />}
                {k === "all" ? "All" : meta!.label}
                <span className="opacity-60">{counts[k] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search portals…"
              className="pl-8 pr-3 py-1.5 rounded-md bg-card border border-border text-xs w-44 focus:outline-none focus:border-[oklch(0.72_0.22_245/0.7)]"
            />
          </div>
          <button
            onClick={shareAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] font-bold hover:border-[oklch(0.72_0.22_245/0.7)]"
          >
            <Copy className="h-3.5 w-3.5" /> Copy all
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!items ? (
        <div className="text-sm text-muted-foreground">Loading portals…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No portals match this filter yet. Spawn one from a hub.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => {
            const meta = KIND_META[i.kind];
            const href = buildHref(i);
            return (
              <div
                key={`${i.kind}-${i.id}`}
                className="group relative rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl transition hover:-translate-y-0.5"
                style={{ boxShadow: `0 0 32px -24px ${meta.accent}` }}
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em]" style={{ color: meta.accent }}>
                    <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
                  </div>
                  {i.vip && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-gold/15 border border-gold/50 text-gold">
                      <Crown className="h-3 w-3" /> VIP
                    </div>
                  )}
                </div>
                <Link
                  to={i.to as any}
                  params={{ slug: i.slug }}
                  className="mt-3 block"
                >
                  <h3 className="font-[Montserrat] font-black text-xl tracking-tight truncate">{i.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{i.subtitle || "—"}</p>
                </Link>
                <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground/70 truncate">
                  {origin.replace(/^https?:\/\//, "")}{href}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => copyLink(i)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[11px] uppercase tracking-[0.2em] font-bold hover:border-[oklch(0.72_0.22_245/0.7)]"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </button>
                  <Link
                    to={i.to as any}
                    params={{ slug: i.slug }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.2em] font-bold text-black"
                    style={{ background: meta.accent }}
                  >
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {i.views > 0 && (
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    {i.views.toLocaleString()} views
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}