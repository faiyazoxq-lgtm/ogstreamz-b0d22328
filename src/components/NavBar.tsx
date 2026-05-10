import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  User, LogIn, Coins, Crown, Shield, ChevronDown,
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
  label, icon: Icon, items, gold, hideLabelOnMobile,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ReadonlyArray<{ to: string; label: string; icon: React.ComponentType<{ className?: string }>; desc?: string; bossOnly?: boolean }>;
  gold?: boolean;
  hideLabelOnMobile?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-md transition-colors outline-none ${
          gold
            ? "text-gold hover:bg-gold/10 border border-gold/30"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className={hideLabelOnMobile ? "hidden sm:inline" : ""}>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70 hidden sm:inline" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-card border-border">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((it) => (
          <DropdownMenuItem key={it.to} asChild className="cursor-pointer focus:bg-secondary">
            <Link to={it.to as string} className="flex items-start gap-3 py-2">
              <it.icon className="h-4 w-4 mt-0.5 text-gold" />
              <span className="flex-1">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
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
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavBar() {
  const { user, profile, isAdmin } = useAuth();
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
            <NavDropdown label="HUBS" icon={Rocket} items={visibleHubs} gold hideLabelOnMobile />
          </li>
          <li className="hidden sm:block">
            <NavDropdown label="Store" icon={Store} items={storeLinks} hideLabelOnMobile />
          </li>
          {isBoss && (
            <li className="hidden sm:block">
              <NavDropdown label="Admin" icon={ShieldCheck} items={adminLinks} hideLabelOnMobile />
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
  const close = () => setOpen(false);

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
        {items.map((it) => (
          <li key={it.to}>
            <Link
              to={it.to as string}
              onClick={close}
              className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-secondary"
            >
              <it.icon className="h-4 w-4 mt-0.5 text-gold shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {it.label}
                  {it.bossOnly && <Crown className="h-3 w-3 text-gold" />}
                </span>
                {it.desc && (
                  <span className="block text-[11px] text-muted-foreground truncate">{it.desc}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation menu"
        className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-border bg-secondary/40 text-foreground hover:bg-secondary"
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
                <li>
                  <Link to="/profile" onClick={close} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-secondary">
                    <UserCircle className="h-4 w-4 text-gold" />
                    <span className="text-sm font-semibold">Vault & Profile</span>
                  </Link>
                </li>
                <li>
                  <Link to="/store" onClick={close} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-secondary">
                    <Coins className="h-4 w-4 text-gold" />
                    <span className="text-sm font-semibold">Buy Credits</span>
                  </Link>
                </li>
                <li>
                  <Link to="/settings" onClick={close} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-secondary">
                    <Settings className="h-4 w-4 text-gold" />
                    <span className="text-sm font-semibold">Settings</span>
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      close();
                      await supabase.auth.signOut();
                      window.location.href = "/";
                    }}
                    className="w-full flex items-center gap-3 rounded-md px-2 py-2.5 text-destructive hover:bg-destructive/10"
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
                className="flex items-center justify-center gap-2 btn-glass-blue rounded-md px-3 py-2.5 text-xs uppercase tracking-[0.25em] font-bold text-white"
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
        className="ml-0.5 sm:ml-1 inline-flex items-center gap-2 btn-glass-blue px-2.5 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white"
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
              className="ml-0.5 sm:ml-1 inline-flex items-center gap-1.5 btn-glass-blue px-2.5 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white outline-none"
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