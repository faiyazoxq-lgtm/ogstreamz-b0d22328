import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Crown, LayoutDashboard, ShieldCheck, BarChart3, Skull, Users, ChevronLeft,
  ShieldAlert, LogIn, Tv, Tags, Bell, Sparkles, Settings, Boxes, Grid3x3,
  Coins, Power, Rocket, KeyRound, Wallet, SlidersHorizontal, Lock, ScrollText,
  ShieldOff, Lightbulb, Megaphone,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BossSearch } from "@/components/BossSearch";
import { requireBoss } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import { PowerStatusBar } from "@/components/boss/PowerStatusBar";
import { BossCommandRail, type RailItem, type RailGroup } from "@/components/boss/BossCommandRail";

export const Route = createFileRoute("/boss")({
  beforeLoad: requireBoss,
  component: BossLayout,
});

const TOP: RailItem = { to: "/boss/overview", label: "Command Centre", Icon: Crown, exact: true, desc: "Merged dashboard" };

const GROUPS: RailGroup[] = [
  {
    id: "command",
    label: "Command",
    Icon: Crown,
    tint: "#ffd166",
    items: [
      { to: "/boss/alerts", label: "Alerts", Icon: Bell, desc: "Live incidents" },
      { to: "/boss/publish-check", label: "Publish", Icon: Rocket, desc: "Pre-publish validation" },
      { to: "/boss/analytics", label: "Analytics", Icon: BarChart3, desc: "Portal metrics" },
      { to: "/syndicate-overlord", label: "Overlord", Icon: LayoutDashboard, desc: "Syndicate deck" },
    ],
  },
  {
    id: "people",
    label: "People",
    Icon: Users,
    tint: "#3ad6ff",
    items: [
      { to: "/boss/users", label: "Roster", Icon: Users, desc: "Rank, credits, bans" },
      { to: "/boss/stream-queue", label: "Stream Queue", Icon: Tv, desc: "Pending verifications" },
    ],
  },
  {
    id: "money",
    label: "Money & Power",
    Icon: Wallet,
    tint: "#00e08a",
    items: [
      { to: "/boss/overview", label: "Power Bar", Icon: Power, desc: "Master toggles & reverse tool" },
      { to: "/boss/pricing", label: "Pricing", Icon: Tags, desc: "Coin packs & products" },
      { to: "/boss/portal-costs", label: "Coin Costs", Icon: Coins, desc: "Per-hub & per-portal" },
      { to: "/boss/promotions", label: "Promotions", Icon: Megaphone, desc: "Sign-up bonus & promos" },
      { to: "/admin", label: "Admin Console", Icon: Sparkles, desc: "Top-ups, passes, vault" },
    ],
  },
  {
    id: "content",
    label: "Content",
    Icon: Boxes,
    tint: "#a78bfa",
    items: [
      { to: "/boss/hubs", label: "Hubs", Icon: Boxes, desc: "Built-in & custom hubs" },
      { to: "/boss/portals", label: "Portals", Icon: Grid3x3, desc: "Manage portals" },
    ],
  },
  {
    id: "moderation",
    label: "Moderation",
    Icon: ShieldCheck,
    tint: "#ff5577",
    items: [
      { to: "/boss/civility", label: "Civility", Icon: ShieldCheck, desc: "Default site tone" },
      { to: "/boss/lexicon", label: "Lexicon", Icon: Skull, desc: "Word lists" },
    ],
  },
  {
    id: "system",
    label: "System",
    Icon: SlidersHorizontal,
    tint: "#94a3b8",
    items: [
      { to: "/boss/api-keys", label: "Agent Keys", Icon: KeyRound, desc: "Encrypted vault" },
      { to: "/boss/secrets-inventory", label: "Secrets Inventory", Icon: Lock, desc: "Platform secrets list" },
      { to: "/boss/function-audit", label: "Function Audit", Icon: ScrollText, desc: "Exposed DB functions" },
      { to: "/boss/function-grants", label: "Function Grants", Icon: ShieldOff, desc: "Revoke EXECUTE w/ restore log" },
      { to: "/boss/function-ideas", label: "Function Ideas", Icon: Lightbulb, desc: "Plug-in & feature backlog" },
      { to: "/boss/settings", label: "Settings", Icon: Settings, desc: "Tunables" },
    ],
  },
];

function BossLayout() {
  const { user, isAdmin, profile, loading } = useAuth();
  const isBoss = profile?.rank === "boss" || isAdmin;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [alertsUnread, setAlertsUnread] = useState(0);

  useEffect(() => {
    if (!isBoss) return;
    let cancelled = false;
    const refresh = async () => {
      const { count } = await supabase
        .from("system_alerts")
        .select("*", { count: "exact", head: true })
        .is("acknowledged_at", null);
      if (!cancelled) setAlertsUnread(count ?? 0);
    };
    refresh();
    const ch = supabase
      .channel("system_alerts_badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, refresh)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [isBoss]);

  if (loading) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  if (!user || !isBoss) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20">
        <div role="alert" aria-live="polite" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-destructive/50 bg-destructive/15">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="syndicate-header text-xl text-foreground">403 — Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user
              ? "Your account doesn't have Boss clearance. Ask an existing Boss to grant you access."
              : "You need to sign in with a Boss-tier account to view this area."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary/80">
              <ChevronLeft className="h-4 w-4" /> Back to site
            </Link>
            {!user && (
              <Link to="/auth" className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-bold text-gold hover:bg-gold/15">
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  const currentItem = [TOP, ...GROUPS.flatMap((g) => g.items)].find((n) =>
    n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/"),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pt-3 pb-12">
      {/* Top utility bar */}
      <div className="sticky top-16 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 backdrop-blur-xl bg-background/80 border-b border-border flex items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground shrink-0">
          <ChevronLeft className="h-4 w-4" /> Exit
        </Link>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] font-extrabold text-gold shrink-0">
          <Crown className="h-3.5 w-3.5" /> Boss · {currentItem?.label ?? "Console"}
        </span>
        <div className="flex-1 min-w-0">
          <BossSearch />
        </div>
      </div>

      {/* Persistent power status bar */}
      <div className="sticky top-[5.25rem] z-25 -mx-3 sm:-mx-6 px-3 sm:px-6 py-1.5 backdrop-blur-xl bg-background/75 border-b border-gold/10 flex items-center justify-between gap-2">
        <PowerStatusBar />
        <Link
          to="/boss/overview"
          hash="power"
          className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/45 hover:text-gold transition shrink-0"
        >
          Power Bar →
        </Link>
      </div>

      {/* Merged command rail (replaces sidebar + drawer) */}
      <BossCommandRail
        top={TOP}
        groups={GROUPS}
        alertsUnread={alertsUnread}
        alertsTo="/boss/alerts"
      />

      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
