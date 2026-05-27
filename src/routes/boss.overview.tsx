import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Crown, Users, Coins, Ticket, KeyRound, Handshake, Inbox, FileText, ArrowUpRight,
  Share2, ShieldCheck, BarChart3, Skull, Activity, RefreshCw, AlertTriangle, Tv,
  Tags, CheckCircle2, Radio, Zap, Bell,
  Rocket, Boxes, Grid3x3, Settings as SettingsIcon, Gauge, Send,
  ShieldOff, ScanSearch, ListChecks, Brain,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CollapsiblePanel } from "@/components/boss/CollapsiblePanel";
import { TelegramInboxPanel } from "@/components/boss/TelegramInboxPanel";
import { TelegramConnectionPanel } from "@/components/boss/TelegramConnectionPanel";
import { GlobalPowerPanel } from "@/components/boss/GlobalPowerPanel";
import { PendingQueuesPanel } from "@/components/boss/PendingQueuesPanel";
import { ReversePurchasesPanel } from "@/components/boss/ReversePurchasesPanel";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/boss/overview")({
  head: () => ({
    meta: [
      { title: "Boss Portal · 0G-STREAMZ" },
      { name: "description", content: "People, credits, passes, codes, resellers, top-ups — the human side of the syndicate." },
    ],
  }),
  component: BossOverview,
});

type Metric = {
  key: string;
  label: string;
  value: number | null;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
  to?: string;
  hash?: string;
  format?: (n: number) => string;
};

const fmtNum = (n: number) => n.toLocaleString("en-GB");

type Tile = {
  to: string;
  hash?: string;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
};

const TILES: Tile[] = [
  // People
  { to: "/boss/members", hash: "roster", label: "Members Roster",  blurb: "Rank, status, credits, ban, force sign-out, stream verify",   Icon: Users,        tint: "#3ad6ff" },
  { to: "/boss/stream-queue",        label: "Stream Queue",      blurb: "Pending 0G STREAMZ portal verifications",                     Icon: Tv,           tint: "#3ad6ff" },
  // Money & Power (toggles & reverse tool live inline on this page)
  { to: "/boss/content", hash: "pricing",    label: "Pricing",           blurb: "Coin packs & store product catalogue",                        Icon: Tags,         tint: "#00e08a" },
  { to: "/boss/content", hash: "coin-costs", label: "Coin Costs",        blurb: "Per-hub create & per-portal use costs",                       Icon: Coins,        tint: "#ffd166" },
  { to: "/boss/content", hash: "usage",      label: "Portal Usage Audit", blurb: "Every charged portal action — slug, user, cost, time",       Icon: Coins,        tint: "#ffd166" },
  { to: "/boss/members", hash: "topups",    label: "Top-Up Requests",   blurb: "Approve or deny credit top-ups",                              Icon: Inbox,        tint: "#ff5577" },
  { to: "/boss/members", hash: "roster",    label: "Adjust Credits",    blurb: "Boss-grant credits by email or user-id",                      Icon: Coins,        tint: "#ffd166" },
  { to: "/boss/members", hash: "passes",    label: "VIP Passes",        blurb: "Mint, grant, revoke, share signup passes",                    Icon: Ticket,       tint: "#a78bfa" },
  { to: "/boss/members", hash: "codes",     label: "Redeem Codes",      blurb: "Create, list, expire promo codes",                            Icon: KeyRound,     tint: "#00e08a" },
  { to: "/boss/members", hash: "resellers", label: "Resellers",         blurb: "Reseller wallets, mark-up, downline",                         Icon: Handshake,    tint: "#ff7a1a" },
  { to: "/boss/members", hash: "share",     label: "Share Cards",       blurb: "Generate share-link cards for passes",                        Icon: Share2,       tint: "#ff5acd" },
  { to: "/boss/members", hash: "notes",     label: "Boss Notes",        blurb: "Private operational notes",                                   Icon: FileText,     tint: "#94a3b8" },
  // Content
  { to: "/boss/content", hash: "hubs",    label: "Hubs",              blurb: "Manage built-in & custom hubs",                               Icon: Boxes,        tint: "#a78bfa" },
  { to: "/boss/content", hash: "portals", label: "Portals",           blurb: "Browse, edit, regenerate covers for every portal",            Icon: Grid3x3,      tint: "#3ad6ff" },
  // Moderation
  { to: "/boss/content", hash: "civility", label: "Civility Controls", blurb: "Toggle Guttermouth swear-chat default tone",                  Icon: ShieldCheck,  tint: "#3ad6ff" },
  { to: "/boss/content", hash: "lexicon",  label: "Swear Lexicon",     blurb: "HEAVY / MID / SOFT word lists · refusal patterns · openers", Icon: Skull,        tint: "#ff2e55" },
  // Insights
  { to: "/boss/ops", hash: "analytics", label: "Analytics",         blurb: "Anonymous public-view counts for every portal & battle",      Icon: BarChart3,    tint: "#00e08a" },
  { to: "/boss/ops", hash: "overlord",  label: "Overlord Deck",     blurb: "Syndicate command deck across the network",                   Icon: Activity,     tint: "#a78bfa" },
  // Command & System
  { to: "/boss/ops", hash: "alerts",   label: "System Alerts",     blurb: "API errors and Perplexity fallback activity, realtime",       Icon: Bell,         tint: "#ff5577" },
  { to: "/boss/ops", hash: "publish",  label: "Publish Check",     blurb: "Pre-publish validation & manual checklist",                   Icon: Rocket,       tint: "#ffd166" },
  { to: "/boss/infrastructure", hash: "agent-keys",     label: "Agent Keys",        blurb: "Encrypted vault for AI / integration API keys",               Icon: KeyRound,     tint: "#a78bfa" },
  { to: "/boss/infrastructure", hash: "telegram-setup", label: "Telegram Setup",    blurb: "BotFather checklist · /setdomain, privacy, slash commands",   Icon: Send,         tint: "#3ad6ff" },
  { to: "/boss/analytics-setup",     label: "Analytics Setup",   blurb: "Cookieless Cloudflare Web Analytics · paste token, no banner", Icon: BarChart3,    tint: "#3ad6ff" },
  { to: "/boss/infrastructure", hash: "domain-denylist", label: "Domain Denylist",   blurb: "Block specific domains from appearing anywhere on the site",   Icon: ShieldOff,    tint: "#ff5577" },
  { to: "/boss/infrastructure", hash: "denylist-audit",  label: "Denylist Audit",    blurb: "Scan stored fields, pages & redirects for blocked domains",    Icon: ScanSearch,   tint: "#00e08a" },
  { to: "/boss/ops", hash: "todo",                       label: "Boss To-Do",        blurb: "Prioritised job list to make the project perfect — work it top-down", Icon: ListChecks,   tint: "#ffd166" },
  { to: "/boss/infrastructure", hash: "og-bot-memory",   label: "OG Bot Memory",     blurb: "View, edit, and clear the persistent facts OG Bot remembers about you", Icon: Brain,        tint: "#a78bfa" },
  { to: "/boss/infrastructure", hash: "settings",        label: "Settings",          blurb: "Signup bonus, feature flags & tunables",                      Icon: SettingsIcon, tint: "#94a3b8" },
];

const TILE_CATEGORIES: { id: string; label: string; tint: string; labels: string[] }[] = [
  { id: "people",     label: "People",        tint: "#3ad6ff", labels: ["Members Roster", "Stream Queue"] },
  { id: "money",      label: "Money & Power", tint: "#ffd166", labels: ["Pricing", "Coin Costs", "Portal Usage Audit", "Top-Up Requests", "Adjust Credits", "VIP Passes", "Redeem Codes", "Resellers", "Share Cards", "Boss Notes"] },
  { id: "content",    label: "Content",       tint: "#a78bfa", labels: ["Hubs", "Portals"] },
  { id: "moderation", label: "Moderation",    tint: "#ff2e55", labels: ["Civility Controls", "Swear Lexicon"] },
  { id: "insights",   label: "Insights",      tint: "#00e08a", labels: ["Analytics", "Overlord Deck"] },
  { id: "system",     label: "Command & System", tint: "#94a3b8", labels: ["Boss To-Do", "OG Bot Memory", "System Alerts", "Publish Check", "Agent Keys", "Telegram Setup", "Analytics Setup", "Domain Denylist", "Denylist Audit", "Settings"] },
];

function BossOverview() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    profiles: 0,
    creditsTotal: 0,
    portals: 0,
    topupPending: 0,
    streamVerifyPending: 0,
    customTrackPending: 0,
    pendingCreditGrants: 0,
    activeProducts: 0,
    newToday: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // user is referenced via useAuth() so handlers can attribute updates if extended
  void user;

  async function loadStats() {
    setError(null);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const since = startOfDay.toISOString();

    const head = (q: any) => q.then((r: any) => (r.error ? -1 : (r.count ?? 0)));
    try {
      const [
        profiles, portals, topup, sverify, ctracks, grants, prods, newToday, civ, credits,
      ] = await Promise.all([
        head(supabase.from("profiles").select("*", { count: "exact", head: true })),
        head(supabase.from("portals").select("*", { count: "exact", head: true })),
        head(supabase.from("topup_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
        head(supabase.from("stream_verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
        head(supabase.from("custom_track_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
        head(supabase.from("pending_credit_grants").select("*", { count: "exact", head: true })),
        head(supabase.from("store_products").select("*", { count: "exact", head: true }).eq("active", true)),
        head(supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since)),
        supabase.from("civility_settings").select("swear_default").limit(1).maybeSingle(),
        Promise.resolve({ data: null, error: { message: "no-rpc" } } as any),
      ]);

      // credits fallback: if RPC missing, query directly via edge-safe aggregate
      let creditsTotal = 0;
      if (credits && !credits.error && typeof credits.data === "number") {
        creditsTotal = credits.data as number;
      } else {
        const { data: crows } = await supabase.from("profiles").select("credits");
        creditsTotal = (crows ?? []).reduce((acc: number, r: any) => acc + (r.credits ?? 0), 0);
      }

      setStats({
        profiles: Math.max(0, profiles),
        creditsTotal,
        portals: Math.max(0, portals),
        topupPending: Math.max(0, topup),
        streamVerifyPending: Math.max(0, sverify),
        customTrackPending: Math.max(0, ctracks),
        pendingCreditGrants: Math.max(0, grants),
        activeProducts: Math.max(0, prods),
        newToday: Math.max(0, newToday),
      });
      // swear_default / coin_frozen are owned by /boss/power; no need to mirror here.
      void civ;
      setLastSync(new Date());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load command-center metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStats();
    const t = setInterval(() => loadStats(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics: Metric[] = [
    { key: "profiles", label: "Members", value: loading ? null : stats.profiles, Icon: Users, tint: "#3ad6ff", to: "/boss/members", hash: "roster", format: fmtNum },
    { key: "newToday", label: "New Today", value: loading ? null : stats.newToday, Icon: Zap, tint: "#a78bfa", format: fmtNum },
    { key: "credits", label: "Credits in Circulation", value: loading ? null : stats.creditsTotal, Icon: Coins, tint: "#ffd166", format: fmtNum },
    { key: "products", label: "Active Products", value: loading ? null : stats.activeProducts, Icon: Tags, tint: "#00e08a", to: "/boss/content", hash: "pricing", format: fmtNum },
    { key: "portals", label: "Portals Live", value: loading ? null : stats.portals, Icon: Radio, tint: "#ff7a1a", format: fmtNum },
    { key: "queue", label: "Open Queue", value: loading ? null : stats.topupPending + stats.streamVerifyPending + stats.customTrackPending + stats.pendingCreditGrants, Icon: Inbox, tint: "#ff5577", format: fmtNum },
  ];

  const totalQueue =
    stats.topupPending + stats.streamVerifyPending + stats.customTrackPending + stats.pendingCreditGrants;
  const ok = !loading && !error && totalQueue === 0;

  return (
    <div className="space-y-6">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6" style={{ color: "#ffd166" }} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
                0G · Command Centre
              </p>
              <h1 className="syndicate-header text-2xl md:text-3xl text-white/95">Boss Overview</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] terminal-mono"
              style={{
                background: ok ? "rgba(0,224,138,0.10)" : "rgba(255,85,119,0.10)",
                border: `1px solid ${ok ? "#00e08a55" : "#ff557755"}`,
                color: ok ? "#00e08a" : "#ff8aa3",
              }}
              aria-live="polite"
            >
              {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {loading ? "Syncing" : ok ? "All clear" : `${totalQueue} action${totalQueue === 1 ? "" : "s"} required`}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/40">
              <Activity className="h-3.5 w-3.5" />
              {lastSync ? `Synced ${lastSync.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "—"}
            </span>
            <button
              type="button"
              onClick={() => { setRefreshing(true); loadStats(); }}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/15 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/55 max-w-2xl">
          Power controls, queues, and shortcuts for the whole syndicate. Auto-syncs every 60s ·
          for AI agents and model tuning use the{" "}
          <Link to="/console" className="underline" style={{ color: "var(--syndicate-glow)" }}>0G-Console</Link>.
        </p>
        {error && (
          <p className="mt-3 text-xs text-destructive" role="alert">{error}</p>
        )}
      </header>

      <SectionHeading label="Status" tint="#3ad6ff" hint="Live snapshot · refreshes every 60s" />

      {/* Live metric strip */}
      <CollapsiblePanel
        id="metrics"
        title="Live Metrics"
        Icon={Gauge}
        tint="#3ad6ff"
        subtitle="Members, credits, products, portals & open queue"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55">
            {metrics.length} cards
          </span>
        }
      >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55">{m.label}</span>
                <m.Icon className="h-3.5 w-3.5" style={{ color: m.tint }} />
              </div>
              <div className="mt-2 syndicate-header text-xl md:text-2xl text-white/95 tabular-nums">
                {m.value === null ? <span className="text-white/30">––</span> : (m.format ? m.format(m.value) : m.value)}
              </div>
            </>
          );
          const cls = "glass-obsidian-cmd rounded-2xl p-3 md:p-4 transition hover:-translate-y-0.5";
          const style = { borderColor: `${m.tint}55` } as React.CSSProperties;
          return m.to ? (
            <Link key={m.key} to={m.to} hash={m.hash} className={cls} style={style}>{body}</Link>
          ) : (
            <div key={m.key} className={cls} style={style}>{body}</div>
          );
        })}
      </div>
      </CollapsiblePanel>

      <SectionHeading label="Action Required" tint="#ff5577" hint="Requests waiting on a Boss decision" />

      {/* Canonical pending-action queue (single source of truth) */}
      <PendingQueuesPanel />

      <SectionHeading label="Global Controls" tint="#ffd166" hint="Network-wide power switches" />

      {/* Canonical global power controls (single source of truth) */}
      <GlobalPowerPanel />

      <SectionHeading label="Communications" tint="#3ad6ff" hint="Outbound channels & bot inboxes" />

      <CollapsiblePanel
        id="telegram-inbox"
        title="Telegram Inbox"
        Icon={Send}
        tint="#3ad6ff"
        subtitle="Bot DMs and groups · pick a chat to view messages and reply"
        defaultOpen={false}
      >
        <div className="space-y-4">
          <TelegramConnectionPanel />
          <TelegramInboxPanel />
        </div>
      </CollapsiblePanel>

      <SectionHeading label="Navigate" tint="#a78bfa" hint="Every Boss surface, grouped by domain" />

      <CollapsiblePanel
        id="modules"
        title="Modules"
        Icon={Boxes}
        tint="#a78bfa"
        subtitle="Jump to any Boss surface"
        defaultOpen={false}
      >
      <div className="space-y-5">
      {TILE_CATEGORIES.map((cat) => {
        const tiles = cat.labels
          .map((l) => TILES.find((t) => t.label === l))
          .filter((t): t is Tile => Boolean(t));
        if (tiles.length === 0) return null;
        return (
          <div key={cat.id}>
            <h3 className="syndicate-header text-sm text-white/80 mb-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: cat.tint, boxShadow: `0 0 10px ${cat.tint}` }} />
              {cat.label}
              <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/35">{tiles.length}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tiles.map((t) => (
                <Link
                  key={t.label + (t.hash ?? "")}
                  to={t.to}
                  hash={t.hash}
                  className="group glass-obsidian-cmd rounded-2xl p-4 transition-all hover:-translate-y-0.5"
                  style={{ borderColor: `${t.tint}55` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${t.tint}1f`, border: `1px solid ${t.tint}55` }}
                    >
                      <t.Icon className="h-4 w-4" style={{ color: t.tint }} />
                    </div>
                    <ArrowUpRight
                      className="h-4 w-4 opacity-40 group-hover:opacity-100 transition"
                      style={{ color: t.tint }}
                    />
                  </div>
                  <h3 className="mt-3 syndicate-header text-sm text-white/95">{t.label}</h3>
                  <p className="mt-1 text-[11px] text-white/55 leading-relaxed">{t.blurb}</p>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
      </div>
      </CollapsiblePanel>

      <SectionHeading
        label="Danger Zone"
        tint="#ff2e55"
        hint="Destructive · reverse recent purchases & refund credits"
      />

      {/* Canonical reverse-purchases tool + recent reversals (single source of truth) */}
      <ReversePurchasesPanel />
    </div>
  );
}

function SectionHeading({ label, tint, hint }: { label: string; tint: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2 pl-1">
      <span
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{ background: tint, boxShadow: `0 0 10px ${tint}` }}
      />
      <h2
        className="syndicate-header text-[11px] uppercase tracking-[0.35em] terminal-mono"
        style={{ color: tint }}
      >
        {label}
      </h2>
      {hint && (
        <span className="text-[11px] text-white/35 truncate">{hint}</span>
      )}
      <span
        className="flex-1 h-px"
        style={{ background: `linear-gradient(to right, ${tint}33, transparent)` }}
      />
    </div>
  );
}

