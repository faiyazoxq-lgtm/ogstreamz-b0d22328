import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Crown, LayoutDashboard, ShieldCheck, BarChart3, Skull, Users, ChevronLeft,
  ShieldAlert, Tv, Tags, Bell, Sparkles, Settings, Boxes, Grid3x3,
  Coins, Power, Rocket, KeyRound, Wallet, SlidersHorizontal, Lock, ScrollText,
  ShieldOff, Lightbulb, Megaphone, Phone, LayoutGrid, Brain,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BossSearch } from "@/components/BossSearch";
import { requireBoss } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import { PowerStatusBar } from "@/components/boss/PowerStatusBar";
import { BossCommandRail, type RailItem, type RailGroup } from "@/components/boss/BossCommandRail";
import { AccessDenied } from "@/components/AccessDenied";

export const Route = createFileRoute("/boss")({
  beforeLoad: requireBoss,
  component: BossLayout,
});

const TOP: RailItem = { to: "/boss/overview", label: "Command Centre", Icon: Crown, exact: true, desc: "Merged dashboard" };

// Mega "everything in one page" console — added so the boss can land on a
// single grouped surface instead of jumping between rail items.
const CONTROL_CENTRE: RailItem = {
  to: "/boss/control-centre",
  label: "Control Centre",
  Icon: LayoutGrid,
  desc: "All toggles & commands grouped",
};

const GROUPS: RailGroup[] = [
  {
    id: "command",
    label: "Command",
    Icon: Crown,
    tint: "#ffd166",
    items: [
      CONTROL_CENTRE,
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
      { to: "/boss/contacts", label: "Contacts", Icon: Phone, desc: "Phone numbers & spares" },
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
      { to: "/boss/ai-agent", label: "0G Bot · AI Agent", Icon: Brain, desc: "All bot settings in one place" },
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
      { to: "/boss/audit-log", label: "Audit Log", Icon: ScrollText, desc: "Boss action history" },
      { to: "/boss/function-grants", label: "Function Grants", Icon: ShieldOff, desc: "Revoke EXECUTE w/ restore log" },
      { to: "/boss/function-ideas", label: "Function Ideas", Icon: Lightbulb, desc: "Plug-in & feature backlog" },
      { to: "/boss/realtime-denials", label: "Realtime Denials", Icon: ShieldAlert, desc: "Audit denied subscriptions" },
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
      <main className="px-5 py-20">
        <AccessDenied
          message={
            user
              ? "Your account doesn't have Boss clearance. Ask an existing Boss to grant you access."
              : "You need to sign in with a Boss-tier account to view this area."
          }
          showSignIn={!user}
        />
      </main>
    );
  }

  const currentItem = [TOP, ...GROUPS.flatMap((g) => g.items)].find((n) =>
    n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/"),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pt-3 pb-12">
      {/* Unified Boss header: exit + breadcrumb + search + status */}
      <div className="sticky top-16 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-2 pb-2 backdrop-blur-xl bg-background/85 border-b border-gold/15 shadow-[0_8px_24px_-20px_rgba(255,209,102,0.5)]">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            aria-label="Exit Boss"
            className="group inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-white/5 shrink-0 transition"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden xs:inline sm:inline">Exit</span>
          </Link>
          <span className="h-5 w-px bg-white/10 shrink-0" aria-hidden />
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] font-extrabold text-gold shrink-0">
            <Crown className="h-3.5 w-3.5 drop-shadow-[0_0_6px_rgba(255,209,102,0.55)]" />
            <span className="hidden sm:inline">Boss</span>
            <span className="hidden md:inline text-white/30">·</span>
            <span className="hidden md:inline text-white/80 normal-case tracking-tight font-bold">
              {currentItem?.label ?? "Console"}
            </span>
          </span>
          <div className="flex-1 min-w-0">
            <BossSearch />
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <PowerStatusBar />
          </div>
          <Link
            to="/boss/overview"
            hash="power"
            className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/40 hover:text-gold transition shrink-0"
          >
            Power Bar →
          </Link>
        </div>
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
