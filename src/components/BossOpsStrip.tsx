import { Link } from "@tanstack/react-router";
import {
  Crown, Activity, Bell, Users, BarChart3, ShieldAlert, MessageSquare, ArrowUpRight,
} from "lucide-react";

const SHORTCUTS = [
  { to: "/boss",            label: "Boss Deck",  Icon: Crown },
  { to: "/boss/alerts",     label: "Alerts",     Icon: Bell },
  { to: "/boss/users",      label: "Users",      Icon: Users },
  { to: "/boss/analytics",  label: "Analytics",  Icon: BarChart3 },
  { to: "/boss/portals",    label: "Portals",    Icon: Activity },
  { to: "/boss/civility",   label: "Civility",   Icon: ShieldAlert },
  { to: "/admin",           label: "Admin",      Icon: MessageSquare },
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
          {SHORTCUTS.map(({ to, label, Icon }) => (
            <li key={to} className="flex-shrink-0">
              <Link
                to={to as never}
                className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/5 hover:text-white"
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{label}</span>
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