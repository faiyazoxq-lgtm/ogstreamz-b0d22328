import { Link } from "@tanstack/react-router";
import {
  Crown, Activity, Bell, Users, BarChart3, ShieldAlert, MessageSquare, ArrowUpRight,
} from "lucide-react";

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
 * without replacing the consumer experience below.
 */
export function BossOpsStrip() {
  return (
    <section
      aria-label="Boss command shortcuts"
      className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-3 sm:px-8"
    >
      <div
        className="flex items-center gap-3 overflow-x-auto rounded-xl border border-[oklch(0.72_0.22_245/0.4)] px-3 py-2.5 shadow-[0_0_30px_-12px_oklch(0.72_0.22_245/0.6)] [scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex flex-shrink-0 items-center gap-2 pr-3 border-r border-white/10">
          <Crown className="h-4 w-4" style={{ color: "var(--gold, #f4c869)" }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/80">
            Boss
          </span>
        </div>
        <ul className="flex flex-1 items-center gap-1.5">
          {SHORTCUTS.map((s) => (
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
      </div>
    </section>
  );
}

export default BossOpsStrip;