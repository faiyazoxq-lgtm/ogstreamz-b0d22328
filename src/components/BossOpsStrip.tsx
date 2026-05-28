import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Crown, Activity, Bell, Users, BarChart3, ShieldAlert, MessageSquare, ArrowUpRight, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SHORTCUTS = [
  { to: "/boss/overview",                       label: "Boss Deck", Icon: Crown },
  { to: "/boss/ops",            hash: "alerts", label: "Alerts",    Icon: Bell },
  { to: "/boss/members",        hash: "roster", label: "Members",   Icon: Users },
  { to: "/boss/ops",         hash: "analytics", label: "Analytics", Icon: BarChart3 },
  { to: "/boss/content",       hash: "portals", label: "Portals",   Icon: Activity },
  { to: "/boss/content",      hash: "civility", label: "Civility",  Icon: ShieldAlert },
  { to: "/admin",                               label: "Admin",     Icon: MessageSquare },
] as const;

/**
 * Slim Boss-only ops strip that sits on top of the standard VIP creator
 * dashboard. Gives the boss one-tap shortcuts to the command-deck routes
 * without replacing the consumer experience below. Shortcuts that don't
 * fit on a single line collapse into a "More" dropdown, so the strip
 * always fits the viewport on narrow screens.
 */
export function BossOpsStrip() {
  const listRef = useRef<HTMLUListElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(SHORTCUTS.length);

  const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;
  useIso(() => {
    const list = listRef.current;
    const measure = measureRef.current;
    if (!list || !measure) return;
    const recalc = () => {
      const containerW = list.clientWidth;
      const kids = Array.from(measure.children) as HTMLElement[];
      const GAP = 6;
      const MORE = 84;
      let used = 0;
      let count = 0;
      for (let i = 0; i < kids.length; i++) {
        const w = kids[i].offsetWidth + (i > 0 ? GAP : 0);
        const willOverflow = i < kids.length - 1;
        const limit = containerW - (willOverflow ? MORE + GAP : 0);
        if (used + w <= limit) { used += w; count = i + 1; } else { break; }
      }
      setVisibleCount(Math.max(1, count));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(list);
    return () => ro.disconnect();
  }, []);

  const visible = SHORTCUTS.slice(0, visibleCount);
  const overflow = SHORTCUTS.slice(visibleCount);

  return (
    <section
      aria-label="Boss command shortcuts"
      className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-3 sm:px-8"
    >
      <div
        className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-[oklch(0.72_0.22_245/0.4)] px-3 py-2.5 shadow-[0_0_30px_-12px_oklch(0.72_0.22_245/0.6)]"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex flex-shrink-0 items-center gap-2 pr-3 border-r border-white/10">
          <Crown className="h-4 w-4" style={{ color: "var(--gold, #f4c869)" }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/80">
            Boss
          </span>
        </div>
        {/* Off-screen measurer at natural width to decide how many fit. */}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-1.5"
        >
          {SHORTCUTS.map((s) => (
            <span
              key={`m-${s.to}${"hash" in s ? s.hash : ""}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap"
            >
              <s.Icon className="h-3.5 w-3.5" />
              {s.label}
              <ArrowUpRight className="h-3 w-3" />
            </span>
          ))}
        </div>
        <ul ref={listRef} className="flex flex-1 items-center gap-1.5 overflow-hidden">
          {visible.map((s) => (
            <li key={s.to + ("hash" in s ? "#" + s.hash : "")} className="flex-shrink-0">
              <Link
                to={s.to as never}
                hash={"hash" in s ? s.hash : undefined}
                className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/5 hover:text-white"
              >
                <s.Icon aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{s.label}</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More shortcuts (${overflow.length})`}
                className="flex-shrink-0 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                More
                <span className="rounded-sm bg-white/10 px-1 text-[10px] leading-4 text-white/70">
                  {overflow.length}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[12rem] border-white/10 bg-black/90 backdrop-blur-xl"
            >
              {overflow.map((s) => (
                <DropdownMenuItem
                  key={s.to + ("hash" in s ? "#" + s.hash : "")}
                  asChild
                  className="gap-2 text-white/80 focus:bg-white/10 focus:text-white"
                >
                  <Link to={s.to as never} hash={"hash" in s ? s.hash : undefined}>
                    <s.Icon className="h-3.5 w-3.5" />
                    <span className="flex-1">{s.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </section>
  );
}

export default BossOpsStrip;