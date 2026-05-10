import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Radio, LineChart, Sparkles, Crown, Cpu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/console", label: "Console", icon: Cpu },
  { to: "/trade", label: "Trade", icon: LineChart },
  { to: "/syndicate", label: "Syndicate", icon: Radio },
  { to: "/store", label: "Store", icon: Sparkles },
] as const;

export function BottomDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile } = useAuth();
  const isBoss = profile?.rank === "boss";

  // Hide on admin/auth screens to keep them clean
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return null;

  const items = isBoss
    ? [...ITEMS, { to: "/boss", label: "Boss", icon: Crown } as const]
    : ITEMS;

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-2 mb-2 rounded-2xl border border-white/10 bg-black/70 px-1 py-1 backdrop-blur-xl shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.9)]">
        <ul className={isBoss ? "grid grid-cols-6" : "grid grid-cols-5"}>
          {items.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
            return (
              <li key={to}>
                <Link
                  to={to as any}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className="group relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[10px] uppercase tracking-[0.18em] transition-all duration-200 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.22_245)]"
                  style={{
                    color: active ? "var(--mood-accent, #ffd166)" : "rgba(255,255,255,0.6)",
                    background: active ? "rgba(255,255,255,0.05)" : "transparent",
                  }}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full motion-safe:animate-in motion-safe:fade-in"
                      style={{ background: "var(--mood-accent, #ffd166)" }}
                    />
                  )}
                  <Icon className="h-[18px] w-[18px] transition-transform duration-200 group-active:scale-110" strokeWidth={2.25} />
                  <span className="font-semibold leading-none">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}