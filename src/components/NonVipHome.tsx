import { Link } from "@tanstack/react-router";
import { Music2, Smile, Wrench, TrendingUp, Crown, ArrowRight } from "lucide-react";
import { SiteGuideSwearChat } from "@/components/SiteGuideSwearChat";
import { ConnectionsStatusBanner } from "@/components/ConnectionsStatusBanner";

/**
 * Logged-in, non-VIP home.
 *
 * OG-Bot chat is the hero — non-VIPs can't spawn portals, so the bot is the
 * primary action. Below it: plain category names (Music / Jokes / Tools /
 * Trade) per the "hub-titles-as-categories" rule for non-boss users. A
 * sticky "Become VIP" upsell pinned to the bottom keeps the conversion path
 * always visible without breaking the chat flow.
 */
const CATEGORIES = [
  { to: "/music",  label: "Music",  desc: "Stream & listen",   Icon: Music2 },
  { to: "/jokes",  label: "Jokes",  desc: "Quick wit",          Icon: Smile },
  { to: "/tools",  label: "Tools",  desc: "Sharp utilities",    Icon: Wrench },
  { to: "/trade",  label: "Trade",  desc: "Live signals",       Icon: TrendingUp },
] as const;

export function NonVipHome({ displayName }: { displayName?: string | null }) {
  return (
    <section
      aria-label="Member home"
      className="relative z-10 mx-auto w-full max-w-[640px] px-4 pt-6 pb-32 sm:px-6"
    >
      {/* Greeting */}
      <header className="mb-4 flex items-baseline justify-between">
        <h1
          className="text-xl font-bold tracking-tight text-white sm:text-2xl"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}
        >
          Welcome back{displayName ? `, ${displayName}` : ""}
        </h1>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
        >
          Member
        </span>
      </header>

      {/* Connections — Telegram + OG Streamz link status & expiry */}
      <ConnectionsStatusBanner />

      {/* OG-Bot chat hero */}
      <div
        className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_60px_-20px_oklch(0.72_0.22_245/0.5)]"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
      >
        <div className="border-b border-white/10 px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
            Ask OG-Bot
          </p>
        </div>
        <div className="max-h-[60vh] min-h-[420px]">
          <SiteGuideSwearChat />
        </div>
      </div>

      {/* Categories — plain names per non-boss rule */}
      <h2
        className="mt-8 mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60"
        style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
      >
        Browse
      </h2>
      <ul className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(({ to, label, desc, Icon }) => (
          <li key={to}>
            <Link
              to={to as never}
              className="group flex h-full flex-col justify-between rounded-xl border border-white/10 p-4 transition hover:border-[oklch(0.72_0.22_245/0.6)] hover:shadow-[0_0_30px_-10px_oklch(0.72_0.22_245/0.7)]"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <Icon
                  aria-hidden="true"
                  className="h-5 w-5"
                  style={{ color: "oklch(0.72 0.22 245)" }}
                />
                <ArrowRight className="h-3.5 w-3.5 text-white/30 transition group-hover:text-white/70" />
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight text-white">{label}</p>
                <p className="text-[11px] text-white/55">{desc}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Sticky VIP upsell */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[oklch(0.72_0.22_245/0.4)] px-4 py-3 sm:py-4"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.92))",
          backdropFilter: "blur(14px)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[640px] items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "oklch(0.72 0.22 245 / 0.2)" }}>
            <Crown className="h-5 w-5" style={{ color: "var(--gold, #f4c869)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold uppercase tracking-wider text-white">
              Spawn your own portal
            </p>
            <p className="truncate text-[10px] text-white/60">
              VIP unlocks MusicHUB, JokesHUB &amp; ToolHUB spawning.
            </p>
          </div>
          <Link
            to="/vip"
            className="flex-shrink-0 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider text-black transition active:scale-95"
            style={{
              backgroundColor: "oklch(0.72 0.22 245)",
              boxShadow: "0 0 30px -8px oklch(0.72 0.22 245 / 0.7)",
            }}
          >
            Become VIP
          </Link>
        </div>
      </div>
    </section>
  );
}

export default NonVipHome;