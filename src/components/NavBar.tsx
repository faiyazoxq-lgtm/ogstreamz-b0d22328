import { Link } from "@tanstack/react-router";
import { User, LogIn, Coins, Crown, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { TVStaticLogo } from "@/components/TVStaticLogo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const links = [
  { to: "/music", label: "MusicHUB" },
  { to: "/jokes", label: "JokesHUB" },
  { to: "/trade", label: "TradeHUB" },
  { to: "/connect", label: "ConnectHUB" },
  { to: "/tools", label: "ToolHUB" },
  { to: "/store", label: "Store" },
] as const;

export function NavBar() {
  const { user, profile, isAdmin } = useAuth();
  const isBoss = isAdmin || profile?.rank === "boss";
  const statusLabel = !user ? "GUEST" : isBoss ? "BOSS" : (profile?.rank?.toUpperCase() ?? "MEMBER");
  const statusColor = !user
    ? "border-border text-muted-foreground"
    : isBoss
      ? "border-gold/60 text-gold bg-gold/10"
      : "border-primary/40 text-primary bg-primary/10";
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 h-16">
        <Link to="/" className="flex items-center gap-2 group">
          <TVStaticLogo />
          <span className="font-[Montserrat] font-black text-lg sm:text-xl tracking-tight text-metallic">
            0G-PORTAL
          </span>
        </Link>
        <ul className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-gold transition-colors rounded-md"
                activeProps={{ className: "px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gold rounded-md bg-secondary" }}
              >
                {l.to === "/store" && <Coins className="inline h-3.5 w-3.5 mr-1" />}
                {l.label}
              </Link>
            </li>
          ))}
          <li className="hidden sm:block">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.2em] ${statusColor}`}
              title={user ? `Signed in as ${profile?.email ?? user.email}` : "Not signed in"}
            >
              {isBoss ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {statusLabel}
            </span>
          </li>
          <li>
            {user ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/profile"
                      className="ml-1 inline-flex items-center gap-2 btn-glass-blue px-3 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Vault</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-card border border-border text-foreground">
                    <div className="space-y-1 min-w-[180px] p-1">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        {isBoss ? "Boss Account" : "Member"}
                      </div>
                      <div className="text-xs font-mono truncate">{profile?.email ?? user.email}</div>
                      <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                        <Coins className="h-3.5 w-3.5 text-gold" />
                        <span className="text-sm font-bold text-gold">
                          {profile?.credits ?? 0}
                        </span>
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
              </TooltipProvider>
            ) : (
              <Link
                to="/auth"
                className="ml-1 inline-flex items-center gap-2 btn-glass-blue px-3 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Join the Syndicate</span>
                <span className="sm:hidden">Join</span>
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </header>
  );
}