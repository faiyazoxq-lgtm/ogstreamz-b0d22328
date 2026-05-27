import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Crown, LayoutDashboard, ShieldCheck, BarChart3, Skull, Users, ChevronLeft,
  ShieldAlert, Tv, Tags, Bell, Sparkles, Settings, Boxes, Grid3x3,
  Coins, Power, Rocket, KeyRound, Wallet, SlidersHorizontal, Lock, ScrollText,
  ShieldOff, Lightbulb, Megaphone, Phone, LayoutGrid, Brain, FileText,
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
    id: "dashboard",
    label: "Dashboard",
    Icon: LayoutGrid,
    tint: "#ffd166",
    items: [
      { to: "/boss/overview",       label: "Overview",       Icon: Crown,         exact: true, desc: "Merged command surface" },
      { to: "/boss/members",        label: "Members",        Icon: Users,         desc: "Roster · Top-ups · Passes · Codes" },
      { to: "/boss/content",        label: "Content",        Icon: Boxes,         desc: "Hubs · Portals · Promotions" },
      { to: "/boss/ops",            label: "Ops",            Icon: Power,         desc: "Power bar · Alerts · Publish · Analytics" },
      { to: "/boss/infrastructure", label: "Infrastructure", Icon: SlidersHorizontal, desc: "Keys · Telegram · Denylist · Bot memory · Settings" },
    ],
  },
  {
    id: "command",
    label: "Command",
    Icon: Crown,
    tint: "#ffd166",
    items: [
      CONTROL_CENTRE,
      { to: "/boss/ops", hash: "alerts", label: "Alerts", Icon: Bell, desc: "Live incidents" },
      { to: "/boss/ops", hash: "publish", label: "Publish", Icon: Rocket, desc: "Pre-publish validation" },
      { to: "/boss/ops", hash: "analytics", label: "Analytics", Icon: BarChart3, desc: "Portal metrics" },
      { to: "/boss/ops", hash: "overlord", label: "Overlord", Icon: LayoutDashboard, desc: "Syndicate deck" },
      { to: "/boss/ops", hash: "todo", label: "Boss To-Do", Icon: FileText, desc: "Boss task list" },
    ],
  },
  {
    id: "people",
    label: "People",
    Icon: Users,
    tint: "#3ad6ff",
    items: [
      { to: "/boss/members", hash: "roster",    label: "Roster",     Icon: Users,    desc: "Members, ranks & credits" },
      { to: "/boss/members", hash: "topups",    label: "Top-Ups",    Icon: Wallet,   desc: "Approve credit requests" },
      { to: "/boss/members", hash: "passes",    label: "Passes",     Icon: Tags,     desc: "VIP passes" },
      { to: "/boss/members", hash: "codes",     label: "Codes",      Icon: KeyRound, desc: "Redeem codes" },
      { to: "/boss/members", hash: "resellers", label: "Resellers",  Icon: Users,    desc: "Reseller wallets" },
      { to: "/boss/stream-queue", label: "Stream Queue", Icon: Tv,    desc: "Pending verifications" },
      { to: "/boss/contacts",     label: "Contacts",     Icon: Phone, desc: "Phone numbers & spares" },
    ],
  },
  {
    id: "money",
    label: "Money & Power",
    Icon: Wallet,
    tint: "#00e08a",
    items: [
      { to: "/boss/overview", label: "Power Bar", Icon: Power, exact: false, desc: "Master toggles & reverse tool" },
      { to: "/boss/content", hash: "pricing", label: "Pricing", Icon: Tags, desc: "Coin packs & products" },
      { to: "/boss/content", hash: "coin-costs", label: "Coin Costs", Icon: Coins, desc: "Per-hub & per-portal" },
      { to: "/boss/content", hash: "usage", label: "Portal Usage", Icon: BarChart3, desc: "Per-portal spend & visits" },
      { to: "/boss/promotions", label: "Promotions", Icon: Megaphone, desc: "Sign-up bonus & promos" },
      { to: "/admin", label: "Legacy Admin", Icon: Sparkles, desc: "Original admin console" },
    ],
  },
  {
    id: "content",
    label: "Content",
    Icon: Boxes,
    tint: "#a78bfa",
    items: [
      { to: "/boss/content", hash: "hubs", label: "Hubs", Icon: Boxes, desc: "Built-in & custom hubs" },
      { to: "/boss/content", hash: "portals", label: "Portals", Icon: Grid3x3, desc: "Manage portals" },
      { to: "/boss/content", hash: "pricing", label: "Pricing", Icon: Tags, desc: "Coin packs & products" },
      { to: "/boss/content", hash: "coin-costs", label: "Coin Costs", Icon: Coins, desc: "Per-hub & per-portal" },
      { to: "/boss/content", hash: "usage", label: "Portal Usage", Icon: BarChart3, desc: "Per-portal spend & visits" },
    ],
  },
  {
    id: "moderation",
    label: "Moderation",
    Icon: ShieldCheck,
    tint: "#ff5577",
    items: [
      { to: "/boss/content", hash: "civility", label: "Civility", Icon: ShieldCheck, desc: "Default site tone" },
      { to: "/boss/content", hash: "lexicon", label: "Swear Lexicon", Icon: Skull, desc: "Word lists & openers" },
      { to: "/boss/ai-agent", label: "0G Bot · AI Agent", Icon: Brain, desc: "All bot settings in one place" },
    ],
  },
  {
    id: "system",
    label: "System",
    Icon: SlidersHorizontal,
    tint: "#94a3b8",
    items: [
      { to: "/boss/infrastructure", hash: "agent-keys", label: "Agent Keys", Icon: KeyRound, desc: "Encrypted vault" },
      { to: "/boss/infrastructure", hash: "telegram-setup", label: "Telegram Setup", Icon: Phone, desc: "BotFather checklist" },
      { to: "/boss/infrastructure", hash: "domain-denylist", label: "Domain Denylist", Icon: ShieldOff, desc: "Block specific domains" },
      { to: "/boss/infrastructure", hash: "denylist-audit", label: "Denylist Audit", Icon: ScrollText, desc: "Scan for blocked domains" },
      { to: "/boss/infrastructure", hash: "og-bot-memory", label: "OG Bot Memory", Icon: Brain, desc: "Persistent bot facts" },
      { to: "/boss/infrastructure", hash: "settings", label: "Settings", Icon: Settings, desc: "Tunables" },
      { to: "/boss/secrets-inventory", label: "Secrets Inventory", Icon: Lock, desc: "Platform secrets list" },
      { to: "/boss/function-audit", label: "Function Audit", Icon: ScrollText, desc: "Exposed DB functions" },
      { to: "/boss/audit-log", label: "Audit Log", Icon: ScrollText, desc: "Boss action history" },
      { to: "/boss/free-purchases", label: "Free Purchases", Icon: ScrollText, desc: "Boss override unlocks" },
      { to: "/boss/function-grants", label: "Function Grants", Icon: ShieldOff, desc: "Revoke EXECUTE w/ restore log" },
      { to: "/boss/function-ideas", label: "Function Ideas", Icon: Lightbulb, desc: "Plug-in & feature backlog" },
      { to: "/boss/realtime-denials", label: "Realtime Denials", Icon: ShieldAlert, desc: "Audit denied subscriptions" },
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
        alertsTo="/boss/ops"
      />

      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
