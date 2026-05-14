import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Music2, Smile, TrendingUp, Newspaper, Swords, Wrench, ClipboardList, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireMember } from "@/lib/route-guards";

/**
 * VIP portals index — one card per hub category. Each card links to
 * /vip/portals/$hub which lists every portal of that kind. Counts are
 * fetched in a single roll-up query so the grid feels alive.
 */

type HubKey = "music" | "jokes" | "trade" | "news" | "forms" | "battles" | "tools";

const HUBS: Array<{
  slug: HubKey;
  label: string;
  hub: string;
  blurb: string;
  Icon: any;
  accent: string;
  // What `kind` values in the DB map to this category.
  kinds: string[];
  // Where battle / tool rows actually live.
  source: "portals" | "battles" | "tools";
}> = [
  { slug: "music",   label: "Music",   hub: "MusicHUB",   blurb: "Drops, releases & repeat-plays.",      Icon: Music2,        accent: "#3ad6ff", kinds: ["music"],  source: "portals" },
  { slug: "jokes",   label: "Jokes",   hub: "JokesHUB",   blurb: "Fast wit, joke battles, gremlins.",   Icon: Smile,         accent: "#ffd166", kinds: ["joke"],   source: "portals" },
  { slug: "trade",   label: "Trade",   hub: "TradeHUB",   blurb: "Live signals & bias meters.",         Icon: TrendingUp,    accent: "#D4AF37", kinds: ["trade"],  source: "portals" },
  { slug: "news",    label: "News",    hub: "NewsHUB",    blurb: "Hot takes & sharp headlines.",        Icon: Newspaper,     accent: "#a78bfa", kinds: ["news"],   source: "portals" },
  { slug: "forms",   label: "Forms",   hub: "FormHUB",    blurb: "Capture, qualify, follow up.",        Icon: ClipboardList, accent: "#7dd3fc", kinds: ["form"],   source: "portals" },
  { slug: "battles", label: "Battles", hub: "BattleHUB",  blurb: "Every choice is a loss.",             Icon: Swords,        accent: "#ff2e55", kinds: [],         source: "battles" },
  { slug: "tools",   label: "Tools",   hub: "ToolHUB",    blurb: "Calculators & spawn-a-tool.",         Icon: Wrench,        accent: "#5cbdb9", kinds: [],         source: "tools" },
];

export const Route = createFileRoute("/vip/portals")({
  beforeLoad: requireMember,
  head: () => ({
    meta: [
      { title: "VIP Portals — Browse by Hub" },
      { name: "description", content: "Browse every portal grouped by hub: Music, Jokes, Trade, News, Forms, Battles and Tools." },
      { property: "og:title", content: "VIP Portals — Browse by Hub" },
      { property: "og:description", content: "Pick a hub and dive into every portal in that category." },
    ],
  }),
  component: VipPortalsIndex,
});

function VipPortalsIndex() {
  const [counts, setCounts] = useState<Partial<Record<HubKey, number>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = supabase as any;
        const [portalsRes, battlesRes, toolsRes] = await Promise.all([
          sb.from("portals_public").select("kind").limit(2000),
          sb.from("battles").select("id", { count: "exact", head: true }),
          sb.from("calculators").select("id", { count: "exact", head: true }).eq("published", true),
        ]);
        if (cancelled) return;
        const next: Partial<Record<HubKey, number>> = {};
        const rows = (portalsRes.data ?? []) as Array<{ kind: string }>;
        for (const h of HUBS) {
          if (h.source === "portals") {
            next[h.slug] = rows.filter((r) => h.kinds.includes(r.kind)).length;
          }
        }
        next.battles = battlesRes.count ?? 0;
        next.tools = toolsRes.count ?? 0;
        setCounts(next);
      } catch {
        /* counts are decorative; ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-24 md:pb-14">
      <header className="mb-10">
        <p className="text-xs tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--mood-accent, #ffd166)" }}>
          0G · VIP · Portals
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-4xl sm:text-5xl tracking-tight">
          Browse by Hub
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl">
          Every portal, grouped by the hub that spawned it. Pick a category to dive in.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {HUBS.map((h) => {
          const Icon = h.Icon;
          const n = counts[h.slug];
          return (
            <Link
              key={h.slug}
              to="/vip/portals/$hub"
              params={{ hub: h.slug }}
              className="group relative rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-5 transition hover:border-white/30 hover:bg-black/60"
              style={{ boxShadow: `0 0 60px -40px ${h.accent}` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                    style={{ background: `${h.accent}1f`, color: h.accent, boxShadow: `0 0 24px -10px ${h.accent}` }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">{h.hub}</p>
                    <h2 className="text-lg font-bold truncate">{h.label}</h2>
                  </div>
                </div>
                <span
                  className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-white/80"
                  aria-label={`${n ?? 0} portals`}
                >
                  {n ?? "—"}
                </span>
              </div>
              <p className="mt-3 text-sm text-white/60">{h.blurb}</p>
              <p className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider opacity-80 group-hover:opacity-100" style={{ color: h.accent }}>
                Open hub <ArrowRight className="h-3.5 w-3.5" />
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}