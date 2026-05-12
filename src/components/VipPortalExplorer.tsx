import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Music2, Smile, Wrench, TrendingUp, Rocket, Sparkles,
  Search, ArrowUpRight, Crown, Layers, Radio, Bot, Brain, Zap, Star,
  Megaphone, Disc3, Satellite, Radar, ExternalLink, DoorOpen,
} from "lucide-react";

const ICONS: Record<string, any> = {
  Music2, Smile, Wrench, TrendingUp, Rocket, Sparkles, Radio, Bot, Brain,
  Zap, Star, Megaphone, Disc3, Satellite, Radar,
};

type Cat = "All" | "Portals" | "Custom";

type Item = {
  key: string;
  to: string;
  title: string;
  desc: string;
  Icon: any;
  category: Cat;
  external?: boolean;
  accent?: string;
};

const CAT_ORDER: Cat[] = ["All", "Portals", "Custom"];

export function VipPortalExplorer({
  customHubs,
}: {
  customHubs: Array<{
    id: string; title: string; tagline?: string; href: string;
    icon?: string; accent?: string;
  }>;
}) {
  const [cat, setCat] = useState<Cat>("All");
  const [q, setQ] = useState("");
  // Boss-published portals only — VIPs see only what the Boss has toggled on.
  // Backed by the `list_nav_portals` RPC, which already filters to
  // `published = true AND created_by is boss/admin` for non-boss callers.
  const [bossPortals, setBossPortals] = useState<
    Array<{ id: string; slug: string; name: string }>
  >([]);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("list_nav_portals").then(({ data }) => {
      if (!alive) return;
      const rows = (data ?? []) as Array<{ id: string; slug: string; name: string; by_boss?: boolean }>;
      // Defence-in-depth: even though the RPC filters server-side, drop any
      // row where by_boss is explicitly false.
      setBossPortals(rows.filter((r) => r.by_boss !== false));
    });
    return () => { alive = false; };
  }, []);

  const items: Item[] = useMemo(() => {
    const portalItems: Item[] = bossPortals.map((p) => ({
      key: `portal:${p.id}`,
      to: `/p/${p.slug}`,
      title: p.name,
      desc: "Boss-published portal",
      Icon: DoorOpen,
      category: "Portals" as Cat,
    }));
    const customItems: Item[] = customHubs.map((h) => ({
      key: h.id,
      to: h.href,
      title: h.title,
      desc: h.tagline || "Custom portal",
      Icon: ICONS[h.icon ?? ""] ?? Sparkles,
      category: "Custom" as Cat,
      external: /^https?:\/\//i.test(h.href),
      accent: h.accent,
    }));
    return [...portalItems, ...customItems];
  }, [bossPortals, customHubs]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: items.length };
    items.forEach((i) => { map[i.category] = (map[i.category] || 0) + 1; });
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat !== "All" && i.category !== cat) return false;
      if (!needle) return true;
      return (
        i.title.toLowerCase().includes(needle) ||
        i.desc.toLowerCase().includes(needle) ||
        i.category.toLowerCase().includes(needle)
      );
    });
  }, [items, cat, q]);

  return (
    <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-16">
      <div className="rounded-3xl border border-[oklch(0.72_0.22_245/0.35)] bg-card/60 backdrop-blur-xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gold/15 text-gold ring-1 ring-gold/40">
              <Crown className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-gold/90">
                VIP Portal Explorer
              </p>
              <h2 className="font-[Montserrat] font-black text-xl sm:text-2xl tracking-tight text-metallic">
                Every portal, categorised
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            {filtered.length} of {items.length}
          </div>
        </div>

        {/* Search */}
        <label className="relative block mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search portals…"
            className="w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-[oklch(0.72_0.22_245/0.7)] focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.22_245/0.4)]"
          />
        </label>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CAT_ORDER.map((c) => {
            const n = counts[c] ?? 0;
            const disabled = c !== "All" && n === 0;
            const active = cat === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => !disabled && setCat(c)}
                disabled={disabled}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] font-bold transition
                  ${active
                    ? "border-[oklch(0.72_0.22_245/0.7)] bg-[oklch(0.72_0.22_245/0.2)] text-white"
                    : "border-white/10 bg-black/30 text-white/75 hover:border-white/30 hover:text-white"}
                  ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {c}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No portals match “{q}” in {cat}.
          </div>
        ) : (
          <ul className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((i) => {
              const accent = i.accent || "oklch(0.72 0.22 245)";
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}
                    >
                      <i.Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
                      {i.category}
                    </span>
                  </div>
                  <div className="mt-3">
                    <h3 className="font-[Montserrat] font-black text-base sm:text-lg tracking-tight text-metallic">
                      {i.title}
                    </h3>
                    <p className="mt-1 text-[13px] text-foreground/85 line-clamp-2">{i.desc}</p>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.25em] font-bold text-white/80">
                    Enter
                    {i.external
                      ? <ExternalLink className="h-3.5 w-3.5" />
                      : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </div>
                </>
              );
              const cls =
                "group relative block overflow-hidden rounded-2xl border border-white/10 bg-card/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[oklch(0.72_0.22_245/0.6)] hover:shadow-[0_0_40px_-12px_oklch(0.72_0.22_245/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.22_245/0.6)]";
              return (
                <li key={i.key}>
                  {i.external ? (
                    <a href={i.to} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                  ) : (
                    <Link to={i.to as never} className={cls}>{inner}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
