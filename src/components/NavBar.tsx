import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  User, LogIn, Coins, Crown, Shield, ChevronDown, History,
  Music, Laugh, TrendingUp, Rocket, Wrench, Swords, Radio,
  Store, ShoppingBag, Receipt,
  ShieldCheck, LayoutDashboard,
  UserCircle, Settings, LogOut, Menu,
  Compass, Sparkles, DoorOpen, Send,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { OgWordmark } from "@/components/OgWordmark";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { SiteSearch } from "@/components/SiteSearch";
import { MasterSwearToggle } from "@/components/MasterSwearToggle";
import { AnimatedCredits } from "@/components/AnimatedCredits";
import { TelegramNavButton } from "@/components/telegram/TelegramNavButton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type HubLink = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; desc?: string; bossOnly?: boolean };
const hubLinks: ReadonlyArray<HubLink> = [
  { to: "/music",   label: "MusicHUB",   icon: Music,       desc: "AI lyrics + Suno tracks" },
  { to: "/jokes",   label: "JokesHUB",   icon: Laugh,       desc: "Live comedy generator" },
  { to: "/trade",   label: "TradeHUB",   icon: TrendingUp,  desc: "Quant signals & whale flows" },
  { to: "/connect", label: "ConnectHUB", icon: Rocket,      desc: "Lead-gen outreach engine", bossOnly: true },
  { to: "/battle",  label: "BattleHUB",  icon: Swords,      desc: "Pick a side, eat the loss" },
  { to: "/syndicate", label: "Syndicate", icon: Radio,      desc: "Live frequency & rooms" },
  { to: "/tools",   label: "ToolHUB",    icon: Wrench,      desc: "Spawn calculators & utilities" },
];

const storeLinks: ReadonlyArray<HubLink> = [
  { to: "/store",            label: "Credit Store",     icon: ShoppingBag, desc: "Top up credits & VIP" },
  { to: "/checkout/return",  label: "Last Receipt",     icon: Receipt,     desc: "Recent purchase status" },
];

// Live portal switcher: only boss-created portals + paid member-created
// portals (price > 0 or coin cost > 0). Sourced via the list_nav_portals
// SQL function which respects RLS and the boss/member rules.
function useNavPortals(): ReadonlyArray<HubLink> {
  const { data } = useQuery({
    queryKey: ["nav-portals"],
    staleTime: 60_000,
    queryFn: async (): Promise<ReadonlyArray<HubLink>> => {
      const { data, error } = await supabase.rpc("list_nav_portals");
      if (error || !data) return [];
      return (data as Array<{ slug: string; name: string; vip: boolean; by_boss: boolean; paid: boolean }>).map((p) => ({
        to: `/p/${p.slug}`,
        label: p.name,
        icon: p.by_boss ? Crown : Sparkles,
        desc: p.by_boss ? "Boss portal" : "Paid member portal",
      }));
    },
  });
  return data ?? [];
}

// Boss / admin pages live under their own /boss layout with a sidebar.

function NavDropdown({
  label, icon: Icon, items, gold, softGold, hideLabelOnMobile, currentPath, pill,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ReadonlyArray<{ to: string; label: string; icon: React.ComponentType<{ className?: string }>; desc?: string; bossOnly?: boolean }>;
  gold?: boolean;
  softGold?: boolean;
  hideLabelOnMobile?: boolean;
  currentPath: string;
  pill?: boolean;
}) {
  // Pick the most specific matching item (longest `to` wins) so that
  // e.g. "/dashboard" beats "/" on /dashboard.
  const matches = items.filter(
    (it) => currentPath === it.to || currentPath.startsWith(it.to + "/"),
  );
  const activeItem =
    matches.sort((a, b) => b.to.length - a.to.length)[0] ?? null;
  const sectionActive = activeItem !== null;
  // For the soft-gold (Portals) trigger: surface the active portal's
  // icon + label directly so the user sees where they are without opening.
  const TriggerIcon = softGold && activeItem ? activeItem.icon : Icon;
  const triggerLabel = softGold && activeItem ? activeItem.label : label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        data-active={sectionActive ? "true" : undefined}
        className={[
          "group inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 text-[11px] md:text-xs font-bold uppercase tracking-[0.18em] transition-all duration-300 outline-none",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.97]",
          pill ? "rounded-full" : "rounded-md",
          gold
            ? "text-gold hover:bg-gold/10 data-[state=open]:bg-gold/15 data-[active=true]:bg-gold/15"
            : softGold
              ? "text-gold/80 hover:text-gold hover:bg-gold/[0.08] data-[state=open]:text-gold data-[state=open]:bg-gold/10 data-[active=true]:bg-gold/10"
              : "text-foreground/70 hover:text-foreground hover:bg-white/5 data-[state=open]:bg-white/5 data-[state=open]:text-foreground data-[active=true]:bg-white/5 data-[active=true]:text-foreground",
        ].join(" ")}
      >
        <TriggerIcon className="h-4 w-4" />
        <span className={hideLabelOnMobile ? "hidden md:inline" : ""}>{triggerLabel}</span>
        <ChevronDown className="h-3 w-3 opacity-60 hidden md:inline transition-transform duration-300 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={[
          "w-64 bg-card border-border",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          "duration-200 ease-out",
          softGold ? "border-gold/30 shadow-[0_10px_40px_-10px_var(--gold)]" : "",
        ].join(" ")}
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((it) => {
          const isActive = activeItem?.to === it.to;
          return (
            <DropdownMenuItem
              key={it.to}
              asChild
              className="cursor-pointer focus:bg-secondary data-[active=true]:bg-gold/10"
            >
              <Link
                to={it.to as string}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive ? "true" : undefined}
                className={[
                  "group/item flex items-start gap-3 px-2 py-3 sm:py-2 min-h-12 sm:min-h-0 rounded-md outline-none touch-manipulation transition-shadow",
                  // Gold focus + tap ring so MusicHUB / JokesHUB / ToolHUB
                  // (and every hub item) light up with the brand's HUBS
                  // accent on keyboard focus AND on touch tap-hold.
                  "hover:bg-secondary focus:outline-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:shadow-[0_0_18px_-4px_var(--gold)]",
                  "active:ring-[3px] active:ring-gold/70 active:ring-offset-2 active:ring-offset-card",
                  isActive
                    ? "bg-gold/15 ring-1 ring-inset ring-gold/60 shadow-[inset_2px_0_0_0_var(--gold)]"
                    : "",
                ].join(" ")}
              >
                <it.icon className={`h-4 w-4 mt-0.5 ${isActive ? "text-gold drop-shadow-[0_0_6px_rgba(255,209,102,0.6)]" : "text-gold/80 group-hover/item:text-gold"}`} />
                <span className="flex-1">
                  <span className={`flex items-center gap-1.5 font-semibold ${isActive ? "text-gold" : "text-foreground"}`}>
                    {it.label}
                    {it.bossOnly && (
                      <Crown className="h-3 w-3 text-gold" />
                    )}
                    {isActive && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.25em] text-gold/90 font-black">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_rgba(255,209,102,0.8)] motion-safe:animate-pulse" />
                        Now
                      </span>
                    )}
                  </span>
                  {it.desc && (
                    <span className="block text-[11px] text-muted-foreground">{it.desc}</span>
                  )}
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavBar() {
  const { user, profile, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Boss / admin links are visibility-gated to admins only. A "boss" rank in
  // the profile is informational; only verified admins (server-checked) see
  // the Boss portal entry, the bossOnly hubs, and the admin drawer section.
  const isBoss = isAdmin;
  const isVip = !isBoss && profile?.status === "vip";
  const statusLabel = !user
    ? "GUEST"
    : isBoss
      ? "BOSS"
      : isVip
        ? "REAL OG"
        : (profile?.rank?.toUpperCase() ?? "MEMBER");
  const statusColor = !user
    ? "border-border text-muted-foreground"
    : isBoss
      ? "border-gold/60 text-gold bg-gold/10"
      : isVip
        ? "border-gold/60 text-gold bg-gold/10 shadow-[0_0_14px_-6px_oklch(0.82_0.16_85/0.8)]"
        : "border-primary/40 text-primary bg-primary/10";

  const visibleHubs = hubLinks.filter((l) => !l.bossOnly || isBoss);
  const navPortals = useNavPortals();

  // Scroll-aware navbar surface: keep it nearly transparent at the very top
  // (so the hero glow shows through) and ramp up the scrim + blur as soon as
  // content starts sliding under it. Guarantees the wordmark stays readable
  // over photos, videos, and bright sections at every scroll position.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // rAF-throttled scroll handler — coalesces a burst of scroll events
    // into a single state update per animation frame so the
    // background/blur class swap stays jank-free during fast scrolling.
    let raf = 0;
    let ticking = false;
    let last = window.scrollY > 8;
    setScrolled(last);
    const read = () => {
      ticking = false;
      const next = window.scrollY > 8;
      if (next !== last) {
        last = next;
        setScrolled(next);
      }
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className={`sticky top-0 z-50 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300 ease-out border-b ${
        scrolled
          ? "bg-background/95 sm:bg-background/85 backdrop-blur-none sm:backdrop-blur-xl border-border shadow-[0_8px_28px_-18px_rgba(0,0,0,0.85)]"
          : "bg-background/80 sm:bg-background/35 backdrop-blur-none sm:backdrop-blur-md border-transparent"
      }`}
    >
      <nav
        className="max-w-7xl mx-auto flex items-center justify-between flex-nowrap min-w-0 px-2 sm:px-8 py-2.5 sm:py-3 gap-2 sm:gap-4"
        style={{ minHeight: "clamp(3.5rem, 2.5vw + 2.75rem, 5.5rem)" }}
      >
        <Link
          to="/"
          aria-label="0G-PORTAL — home"
          onClick={(e) => {
            // If we're already on the homepage, prevent the no-op route
            // navigation and smooth-scroll to the top instead.
            if (typeof window === "undefined") return;
            if (window.location.pathname === "/") {
              e.preventDefault();
              const prefersReducedMotion = window
                .matchMedia?.("(prefers-reduced-motion: reduce)")
                .matches;
              window.scrollTo({
                top: 0,
                behavior: prefersReducedMotion ? "auto" : "smooth",
              });
            }
          }}
          className="brand-glow group min-w-0 flex-1 sm:flex-initial h-full -ml-1 sm:ml-0 pl-1.5 pr-3 sm:pl-2 sm:pr-4 py-1 min-h-12 sm:min-h-0 rounded-2xl outline-none transition-all border border-transparent hover:border-gold/30 bg-transparent hover:bg-transparent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:shadow-[0_0_24px_-4px_var(--gold)] touch-manipulation flex items-center"
          style={{ gap: "clamp(0.4rem, 0.9vw + 0.2rem, 0.9rem)" }}
        >
          <OgWordmark
            suffix="-PORTAL"
            fit
            maxFontSize={72}
            minFontSize={22}
            className="brand-glow__mark inline-flex items-center self-center min-w-0 flex-shrink whitespace-nowrap text-white font-black bg-transparent leading-[0.9] transition-[color,text-shadow,filter,letter-spacing] duration-300 ease-out tracking-[-0.005em] sm:tracking-[-0.018em] md:tracking-[-0.028em] lg:tracking-[-0.034em] xl:tracking-[-0.04em] drop-shadow-[0_0_18px_oklch(0.72_0.22_245/0.55)]"
            style={{
              // Auto-fit handles the font-size; keep typographic refinements.
              wordSpacing: "-0.05em",
              color: "#ffffff",
              textShadow:
                "0 0 1px rgba(255,255,255,0.95), 0 0 18px oklch(0.72 0.22 245 / 0.55), 0 2px 12px rgba(0,0,0,0.55)",
            }}
          />
        </Link>
        <ul className="flex items-center flex-nowrap gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
          <li className="hidden sm:block">
            <div className="flex items-center gap-2">
              {user && <TelegramNavButton />}
              {user && isBoss && (
                <Link
                  to="/admin"
                  hash="roster"
                  aria-label="Add or manage credits"
                  title="Add or manage member credits"
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-gold/60 bg-gradient-to-r from-gold/25 via-gold/15 to-gold/25 hover:from-gold/35 hover:to-gold/35 px-3 py-1.5 font-bold text-gold shadow-[0_0_22px_-4px_var(--gold)] transition-all outline-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold focus-visible:ring-offset-[3px] focus-visible:ring-offset-background"
                >
                  <Coins className="h-4 w-4" aria-hidden />
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] leading-none">Creds</span>
                </Link>
              )}
              {isBoss && (
              <span
                className={`hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.2em] ${statusColor}`}
                title={user ? (isBoss ? "Boss Account" : `Signed in as ${profile?.email ?? user.email}`) : "Not signed in"}
              >
                {isBoss || isVip ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                {statusLabel}
              </span>
              )}
              <AccountMenu
                user={user}
                profile={profile}
                isBoss={isBoss}
              />
            </div>
          </li>
          {isBoss && (
            <li className="block">
              <MasterSwearToggle />
            </li>
          )}
          {user && (
            <li className="sm:hidden">
              <TelegramNavButton />
            </li>
          )}
          <li className="sm:hidden">
            <MobileNavDrawer
              hubs={isBoss ? visibleHubs : []}
              stores={isBoss ? storeLinks.filter((l) => l.to !== "/store") : storeLinks}
              admin={isBoss ? [{ to: "/boss", label: "Boss Portal", icon: Crown, desc: "Admin · Civility · Analytics · Lexicon" }] : []}
              user={user}
              profile={profile}
              isBoss={isBoss}
              portals={navPortals}
            />
          </li>
        </ul>
      </nav>
      {/* Secondary nav row — dropdown menus sit below the logo so the
          brand row stays clean and the menus get full breathing width. */}
      <div className="hidden sm:block border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2.5 sm:py-3 flex items-center justify-center gap-3 sm:gap-4">
          <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-full p-1 shadow-inner shadow-black/20 backdrop-blur-sm">
            {isBoss && (
              <>
                <NavDropdown label="HUBS" icon={Rocket} items={visibleHubs} gold currentPath={pathname} pill />
                <span aria-hidden className="w-px h-4 bg-white/10" />
              </>
            )}
            <NavDropdown label="Portals" icon={DoorOpen} items={navPortals.length ? navPortals : [{ to: "/portals", label: "Browse Portals", icon: Sparkles, desc: "No portals yet — open the directory" }]} softGold currentPath={pathname} pill />
            <span aria-hidden className="w-px h-4 bg-white/10" />
          <NavDropdown
            label={isBoss ? "Manage Store" : "Store"}
            icon={Store}
            items={isBoss ? storeLinks.filter((l) => l.to !== "/store") : storeLinks}
            currentPath={pathname}
            pill
          />
          </div>
          {isBoss && (
            <Link
              to="/boss"
              aria-label="Boss portal"
              data-active={pathname === "/boss" || pathname.startsWith("/boss/") ? "true" : undefined}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] rounded-full border border-gold/40 text-gold hover:bg-gold/10 data-[active=true]:bg-gold/15 data-[active=true]:border-gold/60 transition-colors outline-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Crown className="h-4 w-4" />
              <span>Boss</span>
            </Link>
          )}
        </div>
      </div>
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-8 pb-3">
        <SiteSearch />
      </div>
    </header>
  );
}

function MobileNavDrawer({
  hubs, stores, admin, user, profile, isBoss, portals,
}: {
  hubs: ReadonlyArray<HubLink>;
  stores: ReadonlyArray<HubLink>;
  admin: ReadonlyArray<HubLink>;
  user: ReturnType<typeof useAuth>["user"];
  profile: ReturnType<typeof useAuth>["profile"];
  isBoss: boolean;
  portals: ReadonlyArray<HubLink>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const close = () => setOpen(false);
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  // Wide, thumb-friendly row (≥56px tap target).
  const Row = ({
    to, label, Icon, desc, danger,
  }: {
    to?: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    desc?: string;
    danger?: boolean;
  }) => {
    const active = to ? isActive(to) : false;
    const base =
      "relative flex items-center gap-3 min-h-14 w-full rounded-xl px-3 py-3 text-left transition-colors outline-none active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary";
    const tone = danger
      ? "text-destructive hover:bg-destructive/10 active:bg-destructive/20"
      : active
        ? "bg-gold/10 text-gold ring-1 ring-inset ring-gold/40"
        : "text-foreground hover:bg-secondary active:bg-secondary/80";
    const inner = (
      <>
        {active && (
          <span aria-hidden className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gold shadow-[0_0_10px_rgba(255,209,102,0.6)]" />
        )}
        <span
          className={[
            "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center",
            danger
              ? "bg-destructive/10 text-destructive"
              : active
                ? "bg-gold/15 text-gold ring-1 ring-gold/40"
                : "bg-secondary text-gold/80",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[15px] font-semibold leading-tight ${danger ? "text-destructive" : active ? "text-gold" : "text-foreground"}`}>
            {label}
          </span>
          {desc && (
            <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{desc}</span>
          )}
        </span>
      </>
    );
    if (!to) return <div className={`${base} ${tone}`}>{inner}</div>;
    return (
      <Link to={to} onClick={close} aria-current={active ? "page" : undefined} className={`${base} ${tone}`}>
        {inner}
      </Link>
    );
  };

  const Section = ({
    title, icon: Icon, items, gold,
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: ReadonlyArray<HubLink>;
    gold?: boolean;
  }) => (
    <div className="mb-5">
      <div className={`flex items-center gap-2 px-1.5 mb-2 text-[10px] uppercase tracking-[0.3em] ${gold ? "text-gold" : "text-muted-foreground"}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.to}>
            <Row to={it.to} label={it.label} Icon={it.icon} desc={it.desc} />
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation menu"
        className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-border bg-secondary/40 text-foreground transition-colors hover:bg-secondary hover:border-primary/50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-secondary data-[state=open]:border-primary/60"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[92vw] max-w-sm bg-card p-0 flex flex-col">
        {/* Identity strip — large, glanceable */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-gold/30 to-gold/5 ring-1 ring-gold/40 flex items-center justify-center">
              {isBoss ? <Crown className="h-5 w-5 text-gold" /> : profile?.status === "vip" ? <Crown className="h-5 w-5 text-gold" /> : <UserCircle className="h-5 w-5 text-gold" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-aura-blue font-bold"><OgWordmark suffix="-PORTAL" /></p>
              {user ? (
                <p className="text-sm font-semibold truncate">
                  {isBoss ? "Boss" : profile?.status === "vip" ? "Real OG" : (profile?.email ?? user.email)}
                </p>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">Not signed in</p>
              )}
            </div>
            {user && !isBoss && (
              <Link
                to="/store"
                onClick={close}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-xs font-bold text-amber-200"
              >
                <Coins className="h-3.5 w-3.5" />
                <AnimatedCredits value={profile?.credits ?? 0} />
              </Link>
            )}
          </div>
          <div><SiteSearch /></div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-6">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
            <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Swearing Agent</span>
            <MasterSwearToggle />
          </div>

          {user && portals.length > 0 && <Section title="Portals" icon={DoorOpen} items={portals} />}
          {hubs.length > 0 && <Section title="HUBS" icon={Rocket} items={hubs} gold />}
          <Section title={isBoss ? "Manage Store" : "Store"} icon={Store} items={stores} />
          {admin.length > 0 && <Section title="Boss" icon={ShieldCheck} items={admin} />}

          {user && (
            <div className="mb-2">
              <div className="flex items-center gap-2 px-1.5 mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                <User className="h-3.5 w-3.5" /> Account
              </div>
              <ul className="space-y-1.5">
                <li><Row to="/profile"   label="Vault & Profile" Icon={UserCircle} /></li>
                {!isBoss && <li><Row to="/store" label="Buy Credits" Icon={Coins} /></li>}
                <li><Row to="/history"   label="Portal History"  Icon={History} /></li>
                <li><Row to="/dashboard" label="Dashboard"       Icon={LayoutDashboard} /></li>
                <li><Row to="/noticeboard" label="VIP Noticeboard" Icon={Crown} /></li>
                <li><Row to="/connect-telegram" label="Telegram Inbox" Icon={Send} /></li>
                <li><Row to="/settings"  label="Settings"        Icon={Settings} /></li>
              </ul>
            </div>
          )}
        </div>

        {/* Sticky thumb-zone action bar */}
        <div
          className="border-t border-border bg-card/95 backdrop-blur px-3 py-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          {user ? (
            <button
              type="button"
              onClick={async () => {
                close();
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="w-full inline-flex items-center justify-center gap-2 min-h-12 rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 active:scale-[0.99] text-destructive font-bold uppercase tracking-[0.2em] text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={close}
              className="w-full inline-flex items-center justify-center gap-2 min-h-12 btn-glass-blue rounded-xl px-3 text-xs uppercase tracking-[0.25em] font-bold text-white active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogIn className="h-4 w-4" />
              Join the Syndicate
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AccountMenu({
  user, profile, isBoss,
}: {
  user: ReturnType<typeof useAuth>["user"];
  profile: ReturnType<typeof useAuth>["profile"];
  isBoss: boolean;
}) {
  if (!user) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-1.5 btn-glass-blue px-4 sm:px-5 py-1.5 rounded-full text-[11px] sm:text-xs uppercase tracking-[0.2em] font-bold text-white transition-transform hover:brightness-110 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Sign in"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }
  return (
    <TooltipProvider delayDuration={150}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              aria-label="Account"
              className="inline-flex items-center gap-1.5 btn-glass-blue px-4 sm:px-5 py-1.5 rounded-full text-[11px] sm:text-xs uppercase tracking-[0.2em] font-bold text-white outline-none transition-transform hover:brightness-110 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:brightness-110 data-[state=open]:ring-2 data-[state=open]:ring-primary/60"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Account</span>
              <ChevronDown className="h-3 w-3 opacity-70 hidden sm:inline" />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-card border border-border text-foreground">
            <div className="space-y-1 min-w-[180px] p-1">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {isBoss ? "Boss Account" : "Member"}
              </div>
              {!isBoss && (
                <div className="text-xs font-mono truncate">{profile?.email ?? user.email}</div>
              )}
              {!isBoss && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                  <Coins className="h-3.5 w-3.5 text-gold" />
                  <AnimatedCredits value={profile?.credits ?? 0} className="text-sm font-bold text-gold" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">credits</span>
                </div>
              )}
              {profile?.status === "vip" && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold flex items-center gap-1">
                  <Crown className="h-3 w-3" /> VIP
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-64 bg-card border-border">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {isBoss ? "Boss Account" : "Account"}
            </span>
            {!isBoss && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gold">
                <Coins className="h-3 w-3" /> <AnimatedCredits value={profile?.credits ?? 0} />
              </span>
            )}
          </DropdownMenuLabel>
          <div className="px-2 pb-2 text-xs font-mono text-muted-foreground truncate">
            {isBoss ? "— BOSS —" : (profile?.email ?? user.email)}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary">
            <Link to="/profile" className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-gold" />
              <span>Vault & Profile</span>
            </Link>
          </DropdownMenuItem>
          {!isBoss && (
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary">
              <Link to="/store" className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-gold" />
                <span>Buy Credits</span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary">
            <Link to="/history" className="flex items-center gap-2">
              <History className="h-4 w-4 text-gold" />
              <span>Portal History</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary">
            <Link to="/dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-gold" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary">
            <Link to="/settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-gold" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}