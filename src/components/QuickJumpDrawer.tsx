import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Music2, Smile, Wrench, TrendingUp, Rocket, Swords, ArrowUpRight,
  LayoutDashboard, Store, Crown, Users, Gift, Compass, X,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type QuickItem = {
  to: string;
  title: string;
  desc: string;
  Icon: typeof Music2;
  tint: string;
  badge?: string;
};

const PORTAL_ITEMS: QuickItem[] = [
  { to: "/music",   title: "MusicHUB",   desc: "Stream & spawn",  Icon: Music2,     tint: "oklch(0.72 0.22 245)" },
  { to: "/jokes",   title: "JokesHUB",   desc: "Fast wit",        Icon: Smile,      tint: "oklch(0.78 0.18 85)" },
  { to: "/trade",   title: "TradeHUB",   desc: "Live signals",    Icon: TrendingUp, tint: "oklch(0.70 0.20 145)" },
  { to: "/connect", title: "ConnectHUB", desc: "Scout & reach",   Icon: Rocket,     tint: "oklch(0.65 0.22 295)" },
  { to: "/battle",  title: "BattleHUB",  desc: "Pick a side",     Icon: Swords,     tint: "oklch(0.65 0.24 25)" },
  { to: "/tools",   title: "ToolHUB",    desc: "Sharp utilities", Icon: Wrench,     tint: "oklch(0.70 0.18 180)" },
];

const MEMBER_ITEMS: QuickItem[] = [
  { to: "/dashboard", title: "Dashboard", desc: "Your control deck", Icon: LayoutDashboard, tint: "oklch(0.72 0.22 245)" },
  { to: "/store",     title: "Top up",    desc: "Add credits",       Icon: Store,           tint: "oklch(0.78 0.18 85)", badge: "Buy" },
  { to: "/vip",       title: "VIP",       desc: "Unlock perks",      Icon: Crown,           tint: "oklch(0.78 0.18 85)" },
  { to: "/syndicate", title: "Syndicate", desc: "Live frequency",    Icon: Users,           tint: "oklch(0.70 0.18 180)" },
];

/**
 * Mobile-first bottom sheet for fast navigation between portals & member areas.
 * Renders a floating trigger pinned above the BottomDock on small screens.
 */
export function QuickJumpDrawer({ user }: { user: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"portals" | "member">("portals");
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const items = tab === "portals" || !user ? PORTAL_ITEMS : MEMBER_ITEMS;

  const isNavigating = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  });
  useEffect(() => {
    if (!isNavigating && pendingTo) setPendingTo(null);
  }, [isNavigating, pendingTo]);
  const isPending = pendingTo !== null;

  function handleJump(to: string) {
    if (isPending) return;
    setPendingTo(to);
    setTimeout(() => setOpen(false), 180);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      closeThreshold={0.15}
      scrollLockTimeout={150}
    >
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label="Open quick jump menu"
          className="md:hidden fixed right-3 z-40 inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 text-[11px] uppercase tracking-[0.25em] font-bold text-white backdrop-blur-xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.9)] transition-all active:scale-[0.97] hover:border-[oklch(0.72_0.22_245/0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.22_245)]"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
        >
          <Compass className="h-4 w-4" style={{ color: "var(--mood-accent, #ffd166)" }} />
          Jump
        </button>
      </DrawerTrigger>
      <DrawerContent className="border-white/10 bg-black/95 px-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-xl will-change-transform [transition:transform_280ms_cubic-bezier(0.22,1,0.36,1)] data-[vaul-dragging=true]:transition-none motion-safe:data-[vaul-dragging=true]:[transform:translate3d(0,var(--drawer-translate,0),0)_scale(0.995)] motion-reduce:[transition:none]">
        <DrawerHeader className="px-2 pt-2 pb-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DrawerTitle className="font-[Montserrat] font-black text-xl tracking-tight text-metallic">
                Quick jump
              </DrawerTitle>
              <DrawerDescription className="text-xs text-white/60">
                Tap any tile to teleport. Swipe down to close.
              </DrawerDescription>
            </div>
            <DrawerClose
              aria-label="Close menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.22_245)]"
            >
              <X className="h-4 w-4" />
            </DrawerClose>
          </div>

          {user && (
            <div role="tablist" aria-label="Quick jump category" className="mt-3 inline-flex self-start rounded-full border border-white/10 bg-black/40 p-0.5 text-[10px] font-bold uppercase tracking-[0.2em]">
              {(["portals", "member"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${tab === t ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}
                >
                  {t === "portals" ? "Portals" : "Members"}
                </button>
              ))}
            </div>
          )}
        </DrawerHeader>

        <ul role="list" className="grid grid-cols-2 gap-2.5 px-2 pb-3 list-none m-0">
          {items.map(({ to, title, desc, Icon, tint, badge }) => {
            const thisPending = pendingTo === to;
            const dimmed = isPending && !thisPending;
            return (
            <li key={to} className="contents">
              <Link
                to={to as never}
                onClick={() => handleJump(to)}
                aria-label={`${title} — ${desc}`}
                aria-disabled={isPending || undefined}
                aria-busy={thisPending || undefined}
                tabIndex={isPending ? -1 : 0}
                className={`group relative flex min-h-[88px] flex-col justify-between rounded-2xl border border-white/15 bg-black/50 p-3.5 text-left transition-all active:scale-[0.97] hover:border-[var(--ql-tint)] hover:shadow-[0_0_30px_-8px_var(--ql-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ql-tint)] ${dimmed ? "pointer-events-none opacity-40" : ""} ${thisPending ? "pointer-events-none border-[var(--ql-tint)] shadow-[0_0_30px_-8px_var(--ql-tint)]" : ""}`}
                style={{ ["--ql-tint" as any]: tint }}
                activeProps={{
                  "aria-current": "page",
                  "data-active": "true",
                  className:
                    "group relative flex min-h-[88px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ql-tint)] border-[var(--ql-tint)] bg-[color-mix(in_oklab,var(--ql-tint)_18%,transparent)] shadow-[0_0_24px_-6px_var(--ql-tint)] ring-1 ring-inset ring-[var(--ql-tint)]",
                }}
              >
                {thisPending ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span
                        className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center animate-pulse"
                        style={{ background: `color-mix(in oklab, ${tint} 22%, transparent)`, color: tint }}
                      >
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <span
                        className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded animate-pulse"
                        style={{ background: `color-mix(in oklab, ${tint} 25%, transparent)`, color: tint }}
                      >
                        Loading
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5" aria-hidden="true">
                      <span className="block h-3 w-3/4 rounded bg-white/15 animate-pulse" />
                      <span className="block h-2.5 w-1/2 rounded bg-white/10 animate-pulse" />
                    </div>
                    <span className="sr-only">Loading {title}…</span>
                  </>
                ) : (
                <>
                <div className="flex items-center justify-between">
                  <span
                    className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in oklab, ${tint} 22%, transparent)`, color: tint }}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  {badge ? (
                    <span
                      className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{ background: `color-mix(in oklab, ${tint} 25%, transparent)`, color: tint }}
                    >
                      {badge}
                    </span>
                  ) : (
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-white/40 group-hover:text-white transition-colors" />
                  )}
                </div>
                <div className="mt-3">
                  <span className="block text-[12px] font-black uppercase tracking-[0.15em] text-white truncate">
                    {title}
                  </span>
                  <span className="block text-[11px] font-semibold text-white/60 truncate">
                    {desc}
                  </span>
                </div>
                </>
                )}
              </Link>
            </li>
            );
          })}
          {!user && (
            <li className="contents">
              <Link
                to="/auth"
                search={{ mode: "signup" } as never}
                onClick={() => handleJump("/auth")}
                aria-label="Create a free account — 5 credits on signup"
                aria-disabled={isPending || undefined}
                aria-busy={pendingTo === "/auth" || undefined}
                tabIndex={isPending ? -1 : 0}
                className={`group relative flex min-h-[88px] flex-col justify-between rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3.5 text-left transition-all active:scale-[0.97] hover:bg-amber-300/20 hover:shadow-[0_0_30px_-8px_oklch(0.78_0.18_85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 col-span-2 ${isPending && pendingTo !== "/auth" ? "pointer-events-none opacity-40" : ""} ${pendingTo === "/auth" ? "pointer-events-none animate-pulse" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-amber-300/20 text-amber-200">
                    <Gift aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-amber-200" />
                </div>
                <div className="mt-3">
                  <span className="block text-[12px] font-black uppercase tracking-[0.15em] text-amber-100 truncate">
                    {pendingTo === "/auth" ? "Loading…" : "Free signup"}
                  </span>
                  <span className="block text-[11px] font-semibold text-amber-200/80 truncate">
                    +5 credits, no card
                  </span>
                </div>
              </Link>
            </li>
          )}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}