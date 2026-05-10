import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  User, LogIn, Coins, Crown, Shield, ChevronDown, History,
  Music, Laugh, TrendingUp, Rocket, Wrench, Swords, Radio,
  Store, ShoppingBag, Receipt,
  ShieldCheck, LayoutDashboard,
  UserCircle, Settings, LogOut, Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { TVStaticLogo } from "@/components/TVStaticLogo";
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

const adminLinks: ReadonlyArray<HubLink> = [
  { to: "/admin",              label: "Admin Console",         icon: ShieldCheck,     desc: "Users · credits · codes" },
  { to: "/syndicate-overlord", label: "Boss Control Center",   icon: LayoutDashboard, desc: "Ultimate command deck" },
];

function NavDropdown({
  label, icon: Icon, items, gold, hideLabelOnMobile, currentPath,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ReadonlyArray<{ to: string; label: string; icon: React.ComponentType<{ className?: string }>; desc?: string; bossOnly?: boolean }>;
  gold?: boolean;
  hideLabelOnMobile?: boolean;
  currentPath: string;
}) {
  const sectionActive = items.some(
    (it) => currentPath === it.to || currentPath.startsWith(it.to + "/"),
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        data-active={sectionActive ? "true" : undefined}
        className={[
          "inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-md transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.97]",
          gold
            ? "text-gold hover:bg-gold/10 border border-gold/30 data-[state=open]:bg-gold/15 data-[active=true]:bg-gold/15 data-[active=true]:border-gold/60"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary data-[state=open]:bg-secondary data-[state=open]:text-foreground data-[active=true]:bg-secondary data-[active=true]:text-foreground",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
        <span className={hideLabelOnMobile ? "hidden sm:inline" : ""}>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70 hidden sm:inline transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-card border-border">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((it) => {
          const isActive = currentPath === it.to || currentPath.startsWith(it.to + "/");
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
                  "group/item flex items-start gap-3 py-2 rounded-sm outline-none",
                  "hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary",
                  isActive ? "bg-gold/10 ring-1 ring-inset ring-gold/40" : "",
                ].join(" ")}
              >
                <it.icon className={`h-4 w-4 mt-0.5 ${isActive ? "text-gold drop-shadow-[0_0_6px_rgba(255,209,102,0.6)]" : "text-gold/80 group-hover/item:text-gold"}`} />
                <span className="flex-1">
                  <span className={`flex items-center gap-1.5 font-semibold ${isActive ? "text-gold" : "text-foreground"}`}>
                    {it.label}
                    {it.bossOnly && (
                      <Crown className="h-3 w-3 text-gold" />
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
  const isBoss = isAdmin || profile?.rank === "boss";
  const statusLabel = !user ? "GUEST" : isBoss ? "BOSS" : (profile?.rank?.toUpperCase() ?? "MEMBER");
  const statusColor = !user
    ? "border-border text-muted-foreground"
    : isBoss
      ? "border-gold/60 text-gold bg-gold/10"
      : "border-primary/40 text-primary bg-primary/10";

  const visibleHubs = hubLinks.filter((l) => !l.bossOnly || isBoss);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
      <nav className="max-w-7xl mx-auto flex items-center justify-between flex-nowrap px-2 sm:px-8 h-16 sm:h-20 gap-1 sm:gap-2">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 group min-w-0 flex-1 sm:flex-initial overflow-hidden">
          <TVStaticLogo className="logo-xl shrink-0" />
          <span className="hidden [@media(min-width:360px)]:inline font-[Montserrat] font-black text-base sm:text-3xl tracking-tight text-aura-blue truncate">
            0G-PORTAL
          </span>
        </Link>
        <ul className="flex items-center flex-nowrap gap-0.5 sm:gap-1.5 shrink-0 ml-auto">
          <li className="hidden sm:block">
            <NavDropdown label="HUBS" icon={Rocket} items={visibleHubs} gold hideLabelOnMobile currentPath={pathname} />
          </li>
          <li className="hidden sm:block">
            <NavDropdown label="Store" icon={Store} items={storeLinks} hideLabelOnMobile currentPath={pathname} />
          </li>
          {isBoss && (
            <li className="hidden sm:block">
              <NavDropdown label="Admin" icon={ShieldCheck} items={adminLinks} hideLabelOnMobile currentPath={pathname} />
            </li>
          )}
          <li className="hidden sm:block">
            <AccountMenu
              user={user}
              profile={profile}
              isBoss={isBoss}
            />
          </li>
          <li className="sm:hidden">
            <MobileNavDrawer
              hubs={visibleHubs}
              stores={storeLinks}
              admin={isBoss ? adminLinks : []}
              user={user}
              profile={profile}
              isBoss={isBoss}
            />
          </li>
          <li className="hidden lg:block">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.2em] ${statusColor}`}
              title={user ? (isBoss ? "Boss Account" : `Signed in as ${profile?.email ?? user.email}`) : "Not signed in"}
            >
              {isBoss ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {statusLabel}
            </span>
          </li>
        </ul>
      </nav>
    </header>
  );
}

function MobileNavDrawer({
  hubs, stores, admin, user, profile, isBoss,
}: {
  hubs: ReadonlyArray<HubLink>;
  stores: ReadonlyArray<HubLink>;
  admin: ReadonlyArray<HubLink>;
  user: ReturnType<typeof useAuth>["user"];
  profile: ReturnType<typeof useAuth>["profile"];
  isBoss: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const close = () => setOpen(false);
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const Section = ({
    title, icon: Icon, items, gold,
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: ReadonlyArray<HubLink>;
    gold?: boolean;
  }) => (
    <div className="mb-4">
      <div className={`flex items-center gap-2 px-1 mb-2 text-[10px] uppercase tracking-[0.3em] ${gold ? "text-gold" : "text-muted-foreground"}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((it) => {
          const active = isActive(it.to);
          return (
            <li key={it.to}>
              <Link
                to={it.to as string}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors outline-none",
                  "hover:bg-secondary active:bg-secondary/80 active:scale-[0.99]",
                  "focus-visible:ring-2 focus-visible:ring-primary",
                  active ? "bg-gold/10 ring-1 ring-inset ring-gold/40" : "",
                ].join(" ")}
              >
                <it.icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? "text-gold drop-shadow-[0_0_6px_rgba(255,209,102,0.6)]" : "text-gold/80"}`} />
                <span className="flex-1 min-w-0">
                  <span className={`flex items-center gap-1.5 text-sm font-semibold ${active ? "text-gold" : "text-foreground"}`}>
                    {it.label}
                    {it.bossOnly && <Crown className="h-3 w-3 text-gold" />}
                  </span>
                  {it.desc && (
                    <span className="block text-[11px] text-muted-foreground truncate">{it.desc}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation menu"
        className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-border bg-secondary/40 text-foreground transition-colors hover:bg-secondary hover:border-primary/50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-secondary data-[state=open]:border-primary/60"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] max-w-sm bg-card p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <SheetTitle className="text-left text-sm uppercase tracking-[0.3em] text-aura-blue">
            0G-PORTAL · Menu
          </SheetTitle>
          {user ? (
            <div className="flex items-center gap-2 text-xs">
              {isBoss ? (
                <span className="inline-flex items-center gap-1 text-gold font-bold">
                  <Crown className="h-3.5 w-3.5" /> BOSS
                </span>
              ) : (
                <span className="font-mono text-muted-foreground truncate">
                  {profile?.email ?? user.email}
                </span>
              )}
              {!isBoss && (
                <span className="inline-flex items-center gap-1 ml-auto text-gold font-bold">
                  <Coins className="h-3.5 w-3.5" /> {profile?.credits ?? 0}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Not signed in</p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Section title="HUBS" icon={Rocket} items={hubs} gold />
          <Section title="Store" icon={Store} items={stores} />
          {admin.length > 0 && <Section title="Admin" icon={ShieldCheck} items={admin} />}

          <div className="mt-2">
            <div className="flex items-center gap-2 px-1 mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              Account
            </div>
            {user ? (
              <ul className="space-y-1">
                {[
                  { to: "/profile", label: "Vault & Profile", icon: UserCircle },
                  { to: "/store", label: "Buy Credits", icon: Coins },
                  { to: "/history", label: "Portal History", icon: History },
                  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                  { to: "/settings", label: "Settings", icon: Settings },
                ].map(({ to, label, icon: Icon }) => {
                  const active = isActive(to);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors outline-none",
                          "hover:bg-secondary active:scale-[0.99]",
                          "focus-visible:ring-2 focus-visible:ring-primary",
                          active ? "bg-gold/10 ring-1 ring-inset ring-gold/40 text-gold" : "",
                        ].join(" ")}
                      >
                        <Icon className={`h-4 w-4 ${active ? "text-gold drop-shadow-[0_0_6px_rgba(255,209,102,0.6)]" : "text-gold"}`} />
                        <span className="text-sm font-semibold">{label}</span>
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      close();
                      await supabase.auth.signOut();
                      window.location.href = "/";
                    }}
                    className="w-full flex items-center gap-3 rounded-md px-2 py-2.5 text-destructive transition-colors outline-none hover:bg-destructive/10 active:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm font-semibold">Sign Out</span>
                  </button>
                </li>
              </ul>
            ) : (
              <Link
                to="/auth"
                onClick={close}
                className="flex items-center justify-center gap-2 btn-glass-blue rounded-md px-3 py-2.5 text-xs uppercase tracking-[0.25em] font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <LogIn className="h-4 w-4" />
                Join the Syndicate
              </Link>
            )}
          </div>
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
        className="ml-0.5 sm:ml-1 inline-flex items-center gap-2 btn-glass-blue px-2.5 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white transition-transform hover:brightness-110 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Join"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Join</span>
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
              className="ml-0.5 sm:ml-1 inline-flex items-center gap-1.5 btn-glass-blue px-2.5 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white outline-none transition-transform hover:brightness-110 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:brightness-110 data-[state=open]:ring-2 data-[state=open]:ring-primary/60"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Account</span>
              <ChevronDown className="h-3 w-3 opacity-80 hidden sm:inline" />
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
                  <span className="text-sm font-bold text-gold">{profile?.credits ?? 0}</span>
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
                <Coins className="h-3 w-3" /> {profile?.credits ?? 0}
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
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary">
            <Link to="/store" className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-gold" />
              <span>Buy Credits</span>
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