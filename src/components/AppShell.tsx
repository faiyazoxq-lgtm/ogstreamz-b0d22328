import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Home, Compass, Rocket, DoorOpen, Store, Crown, ShieldCheck,
  UserCircle, Settings, LogOut, LogIn, Menu, ChevronLeft, ChevronRight,
  Music, Laugh, TrendingUp, Swords, Radio, Wrench, ShoppingBag,
  Receipt, Coins, History, LayoutDashboard, Send, Sparkles,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { OgWordmark } from "@/components/OgWordmark";
import { AnimatedCredits } from "@/components/AnimatedCredits";
import { MasterSwearToggle } from "@/components/MasterSwearToggle";
import { SiteSearch } from "@/components/SiteSearch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

type Item = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  desc?: string;
  bossOnly?: boolean;
  vip?: boolean;
};

const HUBS: ReadonlyArray<Item> = [
  { to: "/music", label: "MusicHUB", icon: Music, desc: "AI lyrics + Suno tracks" },
  { to: "/jokes", label: "JokesHUB", icon: Laugh, desc: "Live comedy" },
  { to: "/trade", label: "TradeHUB", icon: TrendingUp, desc: "Quant signals" },
  { to: "/battle", label: "BattleHUB", icon: Swords, desc: "Pick a side" },
  { to: "/syndicate", label: "Syndicate", icon: Radio, desc: "Live frequency" },
  { to: "/tools", label: "ToolHUB", icon: Wrench, desc: "Calculators & utilities" },
  { to: "/connect", label: "ConnectHUB", icon: Rocket, desc: "Lead-gen", bossOnly: true },
];

const STORE: ReadonlyArray<Item> = [
  { to: "/store", label: "Credit Store", icon: ShoppingBag, desc: "Top up credits & VIP" },
  { to: "/checkout/return", label: "Last Receipt", icon: Receipt, desc: "Recent purchase" },
];

const ACCOUNT: ReadonlyArray<Item> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profile", label: "Vault & Profile", icon: UserCircle },
  { to: "/account/passes", label: "My Passes", icon: Crown, vip: true },
  { to: "/history", label: "Portal History", icon: History },
  { to: "/connect-telegram", label: "Telegram Inbox", icon: Send },
  { to: "/settings", label: "Settings", icon: Settings },
];

function useNavPortals(): ReadonlyArray<Item> {
  const { data } = useQuery({
    queryKey: ["nav-portals"],
    staleTime: 60_000,
    queryFn: async (): Promise<ReadonlyArray<Item>> => {
      const { data, error } = await supabase.rpc("list_nav_portals");
      if (error || !data) return [];
      return (data as Array<{ slug: string; name: string; vip: boolean; by_boss: boolean; paid: boolean }>).map((p) => ({
        to: `/p/${p.slug}`,
        label: p.name,
        icon: p.by_boss ? Crown : Sparkles,
        desc: p.by_boss ? "Boss portal" : "Paid portal",
      }));
    },
  });
  return data ?? [];
}

function isPathActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(to + "/");
}

/**
 * Returns true when the current pathname matches the tab's primary route
 * OR any of its companion prefixes. Lets one bottom-tab "Hubs" stay lit
 * while you navigate /portals → /p/foo → /music, etc.
 */
function isAnyPathActive(pathname: string, prefixes: ReadonlyArray<string>) {
  return prefixes.some((p) => isPathActive(pathname, p));
}

/* ======================================================================
 * Desktop sidebar
 * ====================================================================== */
function SidebarSection({
  title,
  icon: Icon,
  items,
  collapsed,
  pathname,
  defaultOpen = true,
  gold,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: ReadonlyArray<Item>;
  collapsed: boolean;
  pathname: string;
  defaultOpen?: boolean;
  gold?: boolean;
}) {
  const hasActive = items.some((i) => isPathActive(pathname, i.to));
  const [open, setOpen] = useState(defaultOpen || hasActive);
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      {!collapsed && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`sidebar-section-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className={[
            "group/sec w-full flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] font-bold transition-colors rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gold/70",
            gold ? "text-gold/80 hover:text-gold" : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Icon aria-hidden className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">{title}</span>
          <ChevronDown aria-hidden className={`h-3 w-3 motion-safe:transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} />
        </button>
      )}
      {(open || collapsed) && (
        <ul id={`sidebar-section-${title.replace(/\s+/g, "-").toLowerCase()}`} className="mt-1 space-y-0.5">
          {items.map((it) => {
            const active = isPathActive(pathname, it.to);
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  aria-current={active ? "page" : undefined}
                  aria-label={`${it.label}${active ? ", current page" : ""}`}
                  title={collapsed ? it.label : undefined}
                  className={[
                    "group/item relative flex items-center gap-3 rounded-lg outline-none motion-safe:transition-all duration-200 min-h-10",
                    collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    active
                      ? "bg-gold/12 text-gold ring-1 ring-inset ring-gold/40 shadow-[inset_2px_0_0_0_var(--gold)]"
                      : "text-foreground/85 hover:bg-white/5 hover:text-foreground",
                  ].join(" ")}
                >
                  <it.icon aria-hidden className={`h-4 w-4 shrink-0 motion-safe:transition-all duration-200 ${active ? "text-gold drop-shadow-[0_0_6px_rgba(255,209,102,0.6)] scale-110" : "text-gold/70 group-hover/item:text-gold"}`} />
                  {!collapsed && (
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight">
                        <span className="truncate">{it.label}</span>
                        {it.vip && <Crown className="h-3 w-3 text-gold shrink-0" />}
                        {active && (
                          <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_rgba(255,209,102,0.8)] motion-safe:animate-pulse" />
                        )}
                      </span>
                      {it.desc && (
                        <span className="block text-[10.5px] text-muted-foreground truncate">{it.desc}</span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DesktopSidebar({
  isBoss, isVip, collapsed, setCollapsed, portals, hubs,
}: {
  isBoss: boolean;
  isVip: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  portals: ReadonlyArray<Item>;
  hubs: ReadonlyArray<Item>;
}) {
  const { user, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={[
        "hidden md:flex flex-col sticky top-0 h-screen shrink-0 border-r border-border/80 bg-background/95 backdrop-blur transition-[width] duration-200 ease-out z-30",
        collapsed ? "w-[68px]" : "w-[260px]",
      ].join(" ")}
    >
      {/* Header / Brand */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 px-3 py-3 border-b border-border/60`}>
        {!collapsed ? (
          <Link to="/" aria-label="Home" className="brand-glow inline-flex items-center min-w-0 flex-1 px-1 rounded-lg hover:bg-white/[0.04] transition-colors">
            <OgWordmark
              suffix="-PORTAL"
              fit
              maxFontSize={28}
              minFontSize={16}
              className="text-white font-black tracking-[-0.02em] drop-shadow-[0_0_14px_oklch(0.72_0.22_245/0.5)]"
            />
          </Link>
        ) : (
          <Link
            to="/"
            aria-label="Home"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 ring-1 ring-cyan-300/30 text-cyan-100 font-black"
          >
            0G
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:inline-flex shrink-0 h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Status / credits */}
      {user && (
        <div className={`px-3 py-3 border-b border-border/60 ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
          {!collapsed ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ring-1 ${isBoss || isVip ? "bg-gradient-to-br from-gold/30 to-gold/5 ring-gold/40 text-gold" : "bg-secondary ring-border text-foreground/70"}`}>
                {isBoss || isVip ? <Crown className="h-4 w-4" /> : <UserCircle className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold leading-none">
                  {isBoss ? "Boss" : isVip ? "Real OG · VIP" : (profile?.rank?.toUpperCase() ?? "Member")}
                </p>
                <p className="mt-1 text-[12px] font-semibold truncate text-foreground">
                  {profile?.email ?? user.email}
                </p>
              </div>
            </div>
          ) : (
            <div
              title={isBoss ? "Boss" : isVip ? "VIP" : "Member"}
              className={`h-9 w-9 rounded-lg flex items-center justify-center ring-1 ${isBoss || isVip ? "bg-gradient-to-br from-gold/30 to-gold/5 ring-gold/40 text-gold" : "bg-secondary ring-border text-foreground/70"}`}
            >
              {isBoss || isVip ? <Crown className="h-4 w-4" /> : <UserCircle className="h-4 w-4" />}
            </div>
          )}

          {!isBoss && (
            <Link
              to="/store"
              title="Coin balance — tap to top up"
              className={[
                "mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-amber-500/25 hover:from-amber-500/35 hover:to-amber-500/35 font-bold text-amber-100 shadow-[0_0_18px_-4px_oklch(0.82_0.18_85/0.7)] transition-all",
                collapsed ? "h-9 w-9 justify-center" : "w-full justify-center px-3 py-1.5",
              ].join(" ")}
            >
              <span className="text-base leading-none" aria-hidden>🪙</span>
              {!collapsed && (
                <AnimatedCredits
                  value={profile?.credits ?? 0}
                  className="text-amber-50 text-sm font-[Montserrat] font-black tabular-nums leading-none"
                />
              )}
            </Link>
          )}

          {!isVip && !isBoss && !collapsed && (
            <Link
              to="/vip"
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-400 hover:to-blue-500 text-white font-bold uppercase tracking-[0.2em] text-[10px] px-3 py-1.5 shadow-[0_0_24px_-6px_rgba(56,189,248,0.7)]"
            >
              <Crown className="h-3 w-3" /> Go VIP
            </Link>
          )}
        </div>
      )}

      {/* Sections */}
      <nav aria-label="Primary sidebar navigation" className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 scrollbar-thin">
        <SidebarSection
          title="Explore"
          icon={Compass}
          items={[
            { to: "/", label: "Home", icon: Home },
            { to: "/portals", label: "Browse Portals", icon: DoorOpen },
            { to: "/vip", label: "VIP Pass", icon: Crown, vip: true },
          ]}
          collapsed={collapsed}
          pathname={pathname}
          gold={false}
        />
        <SidebarSection title="Hubs" icon={Rocket} items={hubs} collapsed={collapsed} pathname={pathname} gold />
        {portals.length > 0 && (
          <SidebarSection title="Your Portals" icon={DoorOpen} items={portals} collapsed={collapsed} pathname={pathname} />
        )}
        <SidebarSection title={isBoss ? "Manage Store" : "Store"} icon={Store} items={STORE} collapsed={collapsed} pathname={pathname} defaultOpen={false} />
        <SidebarSection title="Account" icon={UserCircle} items={ACCOUNT} collapsed={collapsed} pathname={pathname} defaultOpen={false} />
        {isBoss && (
          <SidebarSection
            title="Boss"
            icon={ShieldCheck}
            items={[{ to: "/boss", label: "Boss Portal", icon: Crown, desc: "Admin cockpit" }]}
            collapsed={collapsed}
            pathname={pathname}
          />
        )}
      </nav>

      {/* Footer / actions */}
      <div className={`border-t border-border/60 ${collapsed ? "p-2" : "p-3"} space-y-2`}>
        {!collapsed && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Swearing</span>
            <MasterSwearToggle />
          </div>
        )}
        {user ? (
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            title="Sign out"
            className={[
              "inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold uppercase tracking-[0.2em] text-[10px] transition-colors",
              collapsed ? "h-9 w-9" : "w-full px-3 py-2",
            ].join(" ")}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && "Sign Out"}
          </button>
        ) : (
          <Link
            to="/auth"
            title="Sign in"
            className={[
              "btn-glass-blue inline-flex items-center justify-center gap-2 rounded-lg text-white font-bold uppercase tracking-[0.2em] text-[10px]",
              collapsed ? "h-9 w-9" : "w-full px-3 py-2",
            ].join(" ")}
          >
            <LogIn className="h-3.5 w-3.5" />
            {!collapsed && "Sign In"}
          </Link>
        )}
      </div>
    </aside>
  );
}

/* ======================================================================
 * Mobile slim header
 * ====================================================================== */
function MobileHeader({
  isBoss, isVip, hubs, portals,
}: {
  isBoss: boolean;
  isVip: boolean;
  hubs: ReadonlyArray<Item>;
  portals: ReadonlyArray<Item>;
}) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const close = () => setOpen(false);

  const Row = ({ to, label, Icon, desc, vip }: { to: string; label: string; Icon: ComponentType<{ className?: string }>; desc?: string; vip?: boolean }) => {
    const active = isPathActive(pathname, to);
    return (
      <Link
        to={to}
        onClick={close}
        aria-current={active ? "page" : undefined}
        aria-label={`${label}${active ? ", current page" : ""}`}
        className={[
          "relative flex items-center gap-3 min-h-12 w-full rounded-xl px-3 py-2.5 motion-safe:transition-all duration-200",
          "outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          active ? "bg-gold/10 text-gold ring-1 ring-inset ring-gold/40" : "text-foreground hover:bg-secondary",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "absolute left-0 top-2 bottom-2 w-1 rounded-r-full motion-safe:transition-all duration-200",
            active
              ? "bg-gold shadow-[0_0_10px_rgba(255,209,102,0.6)] opacity-100"
              : "bg-transparent opacity-0",
          ].join(" ")}
        />
        <span className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${active ? "bg-gold/15 text-gold ring-1 ring-gold/40" : "bg-secondary text-gold/80"}`}>
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`flex items-center gap-1.5 text-[14px] font-semibold leading-tight ${active ? "text-gold" : "text-foreground"}`}>
            <span className="truncate">{label}</span>
            {vip && <Crown aria-label="VIP" className="h-3 w-3 text-gold" />}
          </span>
          {desc && <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{desc}</span>}
        </span>
      </Link>
    );
  };

  return (
    <header className="md:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur px-3 py-2 flex items-center gap-2 min-h-14">
      <Link to="/" aria-label="Home" className="brand-glow inline-flex items-center min-w-0 flex-1 px-1 rounded-lg">
        <OgWordmark suffix="-PORTAL" fit maxFontSize={26} minFontSize={16} className="text-white font-black tracking-[-0.02em]" />
      </Link>
      {user && !isBoss && (
        <Link
          to="/store"
          aria-label={`Coins: ${profile?.credits ?? 0}`}
          className="inline-flex items-center gap-1 rounded-full border-2 border-amber-400/60 bg-amber-500/20 px-2.5 py-1 text-amber-100"
        >
          <span aria-hidden>🪙</span>
          <AnimatedCredits value={profile?.credits ?? 0} className="text-[12px] font-black tabular-nums" />
        </Link>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/40 text-foreground hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-gold/70 motion-safe:transition-colors"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </SheetTrigger>
        <SheetContent
          id="mobile-nav-drawer"
          side="right"
          aria-label="Navigation drawer"
          className="w-[92vw] max-w-sm bg-card p-0 flex flex-col"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border space-y-3">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-gold/30 to-gold/5 ring-1 ring-gold/40 flex items-center justify-center">
                {isBoss || isVip ? <Crown className="h-5 w-5 text-gold" /> : <UserCircle className="h-5 w-5 text-gold" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.3em] text-aura-blue font-bold">Menu</p>
                <p className="text-sm font-semibold truncate">
                  {user ? (isBoss ? "Boss" : isVip ? "Real OG" : (profile?.email ?? user.email)) : "Not signed in"}
                </p>
              </div>
            </div>
            <SiteSearch />
          </SheetHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-6 space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
              <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Swearing</span>
              <MasterSwearToggle />
            </div>

            <section>
              <p className="px-1.5 mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Explore</p>
              <ul className="space-y-1.5">
                <li><Row to="/" label="Home" Icon={Home} /></li>
                <li><Row to="/portals" label="Browse Portals" Icon={DoorOpen} /></li>
                <li><Row to="/vip" label="VIP Pass" Icon={Crown} vip desc="Real 0G status" /></li>
              </ul>
            </section>

            <section>
              <p className="px-1.5 mb-2 text-[10px] uppercase tracking-[0.3em] text-gold">Hubs</p>
              <ul className="space-y-1.5">
                {hubs.map((h) => <li key={h.to}><Row to={h.to} label={h.label} Icon={h.icon} desc={h.desc} /></li>)}
              </ul>
            </section>

            {portals.length > 0 && (
              <section>
                <p className="px-1.5 mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your Portals</p>
                <ul className="space-y-1.5">
                  {portals.map((p) => <li key={p.to}><Row to={p.to} label={p.label} Icon={p.icon} desc={p.desc} /></li>)}
                </ul>
              </section>
            )}

            <section>
              <p className="px-1.5 mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{isBoss ? "Manage Store" : "Store"}</p>
              <ul className="space-y-1.5">
                {STORE.map((s) => <li key={s.to}><Row to={s.to} label={s.label} Icon={s.icon} desc={s.desc} /></li>)}
              </ul>
            </section>

            {user && (
              <section>
                <p className="px-1.5 mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Account</p>
                <ul className="space-y-1.5">
                  {ACCOUNT.map((a) => <li key={a.to}><Row to={a.to} label={a.label} Icon={a.icon} vip={a.vip} /></li>)}
                </ul>
              </section>
            )}

            {isBoss && (
              <section>
                <p className="px-1.5 mb-2 text-[10px] uppercase tracking-[0.3em] text-gold">Boss</p>
                <ul className="space-y-1.5">
                  <li><Row to="/boss" label="Boss Portal" Icon={Crown} desc="Admin cockpit" /></li>
                </ul>
              </section>
            )}
          </div>
          <div className="border-t border-border bg-card/95 backdrop-blur px-3 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
            {user ? (
              <button
                type="button"
                onClick={async () => {
                  close();
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="w-full inline-flex items-center justify-center gap-2 min-h-12 rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold uppercase tracking-[0.2em] text-xs"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            ) : (
              <Link
                to="/auth"
                onClick={close}
                className="w-full inline-flex items-center justify-center gap-2 min-h-12 btn-glass-blue rounded-xl px-3 text-xs uppercase tracking-[0.25em] font-bold text-white"
              >
                <LogIn className="h-4 w-4" /> Join the Syndicate
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

/* ======================================================================
 * Mobile bottom tab bar — thumb-zone, persistent
 * ====================================================================== */
function MobileTabBar({ isVip, isBoss }: { isVip: boolean; isBoss: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  type Tab = {
    to: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    gold?: boolean;
    /** Extra prefixes that should also keep this tab active. */
    matches?: ReadonlyArray<string>;
  };
  const tabs: ReadonlyArray<Tab> = [
    { to: "/", label: "Home", icon: Home, matches: ["/"] },
    {
      to: "/portals",
      label: "Hubs",
      icon: Rocket,
      matches: ["/portals", "/p", "/hub", "/music", "/jokes", "/tools", "/trade", "/connect", "/battle", "/syndicate", "/letterhub", "/appealhub"],
    },
    {
      to: "/store",
      label: "Store",
      icon: ShoppingBag,
      matches: ["/store", "/checkout", "/wallet"],
    },
    {
      to: "/vip",
      label: isVip ? "VIP" : "Go VIP",
      icon: Crown,
      gold: true,
      matches: ["/vip", "/account/passes", "/vault-login"],
    },
    {
      to: isBoss ? "/boss" : "/dashboard",
      label: isBoss ? "Boss" : "Account",
      icon: isBoss ? ShieldCheck : UserCircle,
      matches: isBoss
        ? ["/boss"]
        : ["/dashboard", "/profile", "/settings", "/history", "/account", "/connect-telegram"],
    },
  ];
  return (
    <nav
      aria-label="Primary mobile navigation"
      role="navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul role="list" className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = isAnyPathActive(pathname, t.matches ?? [t.to]);
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                aria-current={active ? "page" : undefined}
                aria-label={`${t.label}${active ? ", current page" : ""}`}
                data-active={active ? "true" : undefined}
                className={[
                  "group/tab relative flex flex-col items-center justify-center gap-0.5 min-h-14 px-1 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/70",
                  "motion-safe:transition-colors duration-200",
                  active
                    ? t.gold
                      ? "text-gold [text-shadow:_0_0_10px_rgba(255,209,102,0.6)]"
                      : "text-primary"
                    : t.gold
                      ? "text-gold/70 hover:text-gold"
                      : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <t.icon
                  aria-hidden
                  className={[
                    "h-5 w-5 motion-safe:transition-transform duration-200",
                    active ? "scale-110" : "scale-100 group-hover/tab:scale-105",
                    active && t.gold ? "drop-shadow-[0_0_8px_rgba(255,209,102,0.7)]" : "",
                  ].join(" ")}
                />
                <span className="leading-none">{t.label}</span>
                <span
                  aria-hidden
                  className={[
                    "h-0.5 rounded-full motion-safe:transition-all duration-200",
                    active
                      ? t.gold
                        ? "w-7 bg-gold shadow-[0_0_8px_rgba(255,209,102,0.8)]"
                        : "w-7 bg-primary"
                      : "w-0 bg-transparent",
                  ].join(" ")}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ======================================================================
 * Shell
 * ====================================================================== */
const COLLAPSE_KEY = "ogp:sidebar:collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, loading } = useAuth();
  const isBoss = isAdmin;
  const isVip = !isBoss && profile?.status === "vip";
  const portals = useNavPortals();
  const visibleHubs = HUBS.filter((h) => !h.bossOnly || isBoss);

  const [collapsed, setCollapsed] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  // While auth is resolving, render plain children to avoid layout flash.
  if (loading) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full">
      <DesktopSidebar
        isBoss={isBoss}
        isVip={!!isVip}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        portals={portals}
        hubs={visibleHubs}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileHeader isBoss={isBoss} isVip={!!isVip} hubs={visibleHubs} portals={portals} />
        <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
      </div>
      <MobileTabBar isVip={!!isVip || isBoss} isBoss={isBoss} />
    </div>
  );
}

export default AppShell;