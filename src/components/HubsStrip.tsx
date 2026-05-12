import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Music2, Smile, Wrench, ArrowUpRight, TrendingUp, Rocket, Swords,
  Sparkles, Radio, Bot, Brain, Zap, Star, Megaphone, Disc3, Satellite, Radar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ICONS: Record<string, any> = {
  Music2, Smile, Wrench, TrendingUp, Rocket, Sparkles, Radio, Bot, Brain,
  Zap, Star, Megaphone, Disc3, Satellite, Radar,
};

const PORTALS = [
  { to: "/music",   title: "MusicHUB",   Icon: Music2 },
  { to: "/jokes",   title: "JokesHUB",   Icon: Smile },
  { to: "/trade",   title: "TradeHUB",   Icon: TrendingUp },
  { to: "/connect", title: "ConnectHUB", Icon: Rocket },
  { to: "/battle",  title: "BattleHUB",  Icon: Swords },
  { to: "/tools",   title: "ToolHUB",    Icon: Wrench },
] as const;

const BASE = "group inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] font-bold transition-colors";
const INACTIVE = "border-white/10 bg-white/[0.03] text-white/85 hover:border-[oklch(0.72_0.22_245/0.7)] hover:bg-[oklch(0.72_0.22_245/0.12)] hover:text-white";
const ACTIVE = "border-[oklch(0.72_0.22_245/0.9)] bg-[oklch(0.72_0.22_245/0.18)] text-white shadow-[0_0_18px_-4px_oklch(0.72_0.22_245/0.6)]";

export function HubsStrip({ className = "" }: { className?: string }) {
  const [customHubs, setCustomHubs] = useState<Array<{ id: string; title: string; href?: string | null; icon?: string | null }>>([]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const listRef = useRef<HTMLUListElement | null>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const ul = listRef.current;
    if (!ul) return;
    const links = Array.from(ul.querySelectorAll<HTMLAnchorElement>("a[href]"));
    if (links.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    const idx = current ? links.indexOf(current as HTMLAnchorElement) : -1;
    let next = -1;
    switch (e.key) {
      case "ArrowRight":
        next = idx < 0 ? 0 : (idx + 1) % links.length;
        break;
      case "ArrowLeft":
        next = idx < 0 ? links.length - 1 : (idx - 1 + links.length) % links.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = links.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = links[next];
    target.focus();
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { data } = await supabase
        .from("custom_hubs")
        .select("id,title,href,icon,sort_order,published")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (!cancelled) setCustomHubs((data ?? []) as any);
    };
    void refresh();
    const channel = supabase
      .channel("custom_hubs:strip")
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_hubs" }, () => { void refresh(); })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, []);

  return (
    <nav aria-label="All hubs" className={`relative max-w-7xl mx-auto px-5 sm:px-8 ${className}`}>
      <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl px-3 sm:px-4 py-3">
        <div className="flex items-center justify-between gap-3 px-1 pb-2">
          <p className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/70">All hubs</p>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.15)] px-2.5 py-0.5 text-[10px] font-black tabular-nums"
            style={{ color: "var(--neon-blue-bright)" }}
          >
            <Sparkles className="h-3 w-3" />
            {PORTALS.length + customHubs.length} live
          </span>
        </div>
        <ul
          ref={listRef}
          onKeyDown={handleKeyDown}
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-1 px-1 focus-within:outline-none"
        >
          {PORTALS.map(({ to, title, Icon }) => (
            <li key={to} className="snap-start shrink-0">
              <Link
                to={to}
                aria-current={pathname === to ? "page" : undefined}
                className={BASE + " " + INACTIVE}
                activeProps={{ className: BASE + " " + ACTIVE }}
                activeOptions={{ exact: false }}
              >
                <Icon className="h-3.5 w-3.5" />
                {title}
              </Link>
            </li>
          ))}
          {customHubs.map((h) => {
            const CustomIcon = (h.icon && ICONS[h.icon]) || Sparkles;
            const href: string = h.href || `/hub/${h.id}`;
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={h.id} className="snap-start shrink-0">
                <Link
                  to={href as never}
                  aria-current={isActive ? "page" : undefined}
                  className={BASE + " " + (isActive ? ACTIVE : INACTIVE)}
                >
                  <CustomIcon className="h-3.5 w-3.5" />
                  {h.title}
                </Link>
              </li>
            );
          })}
          <li className="snap-start shrink-0">
            <Link
              to="/portals"
              aria-current={pathname === "/portals" ? "page" : undefined}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] font-black text-white hover:bg-white hover:text-black transition-colors"
              activeProps={{ className: "inline-flex items-center gap-2 rounded-xl border border-white bg-white px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] font-black text-black transition-colors" }}
              activeOptions={{ exact: true }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              See all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}