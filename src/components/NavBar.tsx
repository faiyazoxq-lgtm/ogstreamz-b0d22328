import { Link } from "@tanstack/react-router";
import {
  User, LogIn, Coins, Crown, Shield, ChevronDown,
  Music, Laugh, TrendingUp, Rocket, Wrench,
  Store, ShoppingBag, Receipt,
  ShieldCheck, LayoutDashboard, Eye,
  UserCircle, Settings, LogOut,
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

type HubLink = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; desc?: string; bossOnly?: boolean };
const hubLinks: ReadonlyArray<HubLink> = [
  { to: "/music",   label: "MusicHUB",   icon: Music,       desc: "AI lyrics + Suno tracks" },
  { to: "/jokes",   label: "JokesHUB",   icon: Laugh,       desc: "Live comedy generator" },
  { to: "/trade",   label: "TradeHUB",   icon: TrendingUp,  desc: "Quant signals & whale flows" },
  { to: "/connect", label: "ConnectHUB", icon: Rocket,      desc: "Lead-gen outreach engine", bossOnly: true },
  { to: "/tools",   label: "ToolHUB",    icon: Wrench,      desc: "Spawn calculators & utilities" },
];

const storeLinks: ReadonlyArray<HubLink> = [
  { to: "/store",            label: "Credit Store",     icon: ShoppingBag, desc: "Top up credits & VIP" },
  { to: "/checkout/return",  label: "Last Receipt",     icon: Receipt,     desc: "Recent purchase status" },
];

const adminLinks: ReadonlyArray<HubLink> = [
  { to: "/admin",              label: "Admin Console",        icon: ShieldCheck,     desc: "Users · credits · codes" },
  { to: "/syndicate-overlord", label: "Syndicate Overlord",   icon: Eye,             desc: "Live ops surveillance" },
  { to: "/dashboard",          label: "Boss Dashboard",       icon: LayoutDashboard, desc: "Cross-hub metrics" },
];

function NavDropdown({
  label, icon: Icon, items, gold,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ReadonlyArray<{ to: string; label: string; icon: React.ComponentType<{ className?: string }>; desc?: string; bossOnly?: boolean }>;
  gold?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors outline-none ${
          gold
            ? "text-gold hover:bg-gold/10 border border-gold/30"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-card border-border">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((it) => (
          <DropdownMenuItem key={it.to} asChild className="cursor-pointer focus:bg-secondary">
            <Link to={it.to} className="flex items-start gap-3 py-2">
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
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-8 h-16 gap-2">
        <Link to="/" className="flex items-center gap-2 group">
          <TVStaticLogo />
          <span className="font-[Montserrat] font-black text-base sm:text-xl tracking-tight text-metallic">
            0G-PORTAL
          </span>
        </Link>
        <ul className="flex items-center gap-1 sm:gap-1.5">
          <li>
            <NavDropdown label="HUBS" icon={Rocket} items={visibleHubs} gold />
          </li>
          <li>
            <NavDropdown label="Store" icon={Store} items={storeLinks} />
          </li>
          {isBoss && (
            <li>
              <NavDropdown label="Admin" icon={ShieldCheck} items={adminLinks} />
            </li>
          )}
          <li>
            <AccountMenu
              user={user}
              profile={profile}
              isBoss={isBoss}
            />
          </li>
          <li className="hidden lg:block">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.2em] ${statusColor}`}
              title={user ? `Signed in as ${profile?.email ?? user.email}` : "Not signed in"}
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
        className="ml-1 inline-flex items-center gap-2 btn-glass-blue px-3 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white"
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
            <DropdownMenuTrigger className="ml-1 inline-flex items-center gap-1.5 btn-glass-blue px-3 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white outline-none">
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Account</span>
              <ChevronDown className="h-3 w-3 opacity-80" />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-card border border-border text-foreground">
            <div className="space-y-1 min-w-[180px] p-1">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {isBoss ? "Boss Account" : "Member"}
              </div>
              <div className="text-xs font-mono truncate">{profile?.email ?? user.email}</div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                <Coins className="h-3.5 w-3.5 text-gold" />
                <span className="text-sm font-bold text-gold">{profile?.credits ?? 0}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">credits</span>
              </div>
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
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gold">
              <Coins className="h-3 w-3" /> {profile?.credits ?? 0}
            </span>
          </DropdownMenuLabel>
          <div className="px-2 pb-2 text-xs font-mono text-muted-foreground truncate">
            {profile?.email ?? user.email}
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