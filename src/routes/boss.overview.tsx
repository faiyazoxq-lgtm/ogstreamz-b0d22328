import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Crown, Users, Coins, Ticket, KeyRound, Handshake, Inbox, FileText, ArrowUpRight,
  Share2, ShieldCheck, BarChart3, Skull, Activity, RefreshCw, AlertTriangle, Tv,
  Tags, Music, CheckCircle2, Radio, Zap, Bell, CreditCard, Power, Snowflake, Undo2,
  Rocket, Boxes, Grid3x3, Settings as SettingsIcon, Sparkles, Loader2, ShieldAlert, Gauge,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMode, setPaymentMode } from "@/hooks/use-payment-mode";
import { CollapsiblePanel } from "@/components/boss/CollapsiblePanel";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type ActionItem = {
  key: string;
  label: string;
  count: number;
  to: string;
  hash?: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
  hint: string;
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
  { to: "/boss/users",               label: "User Roster",       blurb: "Rank, status, credits, ban, force sign-out, stream verify",   Icon: Users,        tint: "#3ad6ff" },
  { to: "/boss/stream-queue",        label: "Stream Queue",      blurb: "Pending 0G STREAMZ portal verifications",                     Icon: Tv,           tint: "#3ad6ff" },
  // Money & Power
  { to: "/boss/power",               label: "Power Controls",    blurb: "Freeze payments, freeze coins, reverse recent purchases",     Icon: Power,        tint: "#ff5577" },
  { to: "/boss/pricing",             label: "Pricing",           blurb: "Coin packs & store product catalogue",                        Icon: Tags,         tint: "#00e08a" },
  { to: "/boss/portal-costs",        label: "Coin Costs",        blurb: "Per-hub create & per-portal use costs",                       Icon: Coins,        tint: "#ffd166" },
  { to: "/admin", hash: "topups",    label: "Top-Up Requests",   blurb: "Approve or deny credit top-ups",                              Icon: Inbox,        tint: "#ff5577" },
  { to: "/admin", hash: "roster",    label: "Adjust Credits",    blurb: "Boss-grant credits by email or user-id",                      Icon: Coins,        tint: "#ffd166" },
  { to: "/admin", hash: "passes",    label: "VIP Passes",        blurb: "Mint, grant, revoke, share signup passes",                    Icon: Ticket,       tint: "#a78bfa" },
  { to: "/admin", hash: "codes",     label: "Redeem Codes",      blurb: "Create, list, expire promo codes",                            Icon: KeyRound,     tint: "#00e08a" },
  { to: "/admin", hash: "resellers", label: "Resellers",         blurb: "Reseller wallets, mark-up, downline",                         Icon: Handshake,    tint: "#ff7a1a" },
  { to: "/admin", hash: "share",     label: "Share Cards",       blurb: "Generate share-link cards for passes",                        Icon: Share2,       tint: "#ff5acd" },
  { to: "/admin", hash: "notes",     label: "Boss Notes",        blurb: "Private operational notes",                                   Icon: FileText,     tint: "#94a3b8" },
  { to: "/admin",                    label: "Admin Console",     blurb: "Full legacy admin surface — top-ups, passes, vault",          Icon: Sparkles,     tint: "#94a3b8" },
  // Content
  { to: "/boss/hubs",                label: "Hubs",              blurb: "Manage built-in & custom hubs",                               Icon: Boxes,        tint: "#a78bfa" },
  { to: "/boss/portals",             label: "Portals",           blurb: "Browse, edit, regenerate covers for every portal",            Icon: Grid3x3,      tint: "#3ad6ff" },
  // Moderation
  { to: "/boss/civility",            label: "Civility Controls", blurb: "Toggle Guttermouth swear-chat default tone",                  Icon: ShieldCheck,  tint: "#3ad6ff" },
  { to: "/boss/lexicon",             label: "Swear Lexicon",     blurb: "HEAVY / MID / SOFT word lists · refusal patterns · openers", Icon: Skull,        tint: "#ff2e55" },
  // Insights
  { to: "/boss/analytics",           label: "Analytics",         blurb: "Anonymous public-view counts for every portal & battle",      Icon: BarChart3,    tint: "#00e08a" },
  { to: "/syndicate-overlord",       label: "Overlord Deck",     blurb: "Syndicate command deck across the network",                   Icon: Activity,     tint: "#a78bfa" },
  // Command & System
  { to: "/boss/alerts",              label: "System Alerts",     blurb: "API errors and Perplexity fallback activity, realtime",       Icon: Bell,         tint: "#ff5577" },
  { to: "/boss/publish-check",       label: "Publish Check",     blurb: "Pre-publish validation & manual checklist",                   Icon: Rocket,       tint: "#ffd166" },
  { to: "/boss/api-keys",            label: "Agent Keys",        blurb: "Encrypted vault for AI / integration API keys",               Icon: KeyRound,     tint: "#a78bfa" },
  { to: "/boss/settings",            label: "Settings",          blurb: "Signup bonus, feature flags & tunables",                      Icon: SettingsIcon, tint: "#94a3b8" },
];

const TILE_CATEGORIES: { id: string; label: string; tint: string; labels: string[] }[] = [
  { id: "people",     label: "People",        tint: "#3ad6ff", labels: ["User Roster", "Stream Queue"] },
  { id: "money",      label: "Money & Power", tint: "#ffd166", labels: ["Power Controls", "Pricing", "Coin Costs", "Top-Up Requests", "Adjust Credits", "VIP Passes", "Redeem Codes", "Resellers", "Share Cards", "Boss Notes", "Admin Console"] },
  { id: "content",    label: "Content",       tint: "#a78bfa", labels: ["Hubs", "Portals"] },
  { id: "moderation", label: "Moderation",    tint: "#ff2e55", labels: ["Civility Controls", "Swear Lexicon"] },
  { id: "insights",   label: "Insights",      tint: "#00e08a", labels: ["Analytics", "Overlord Deck"] },
  { id: "system",     label: "Command & System", tint: "#94a3b8", labels: ["System Alerts", "Publish Check", "Agent Keys", "Settings"] },
];

function BossOverview() {
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
  const [swearDefault, setSwearDefault] = useState<boolean | null>(null);
  const [togglingSwear, setTogglingSwear] = useState(false);
  const paymentMode = usePaymentMode();
  const [togglingPayments, setTogglingPayments] = useState(false);
  const [confirmGoLive, setConfirmGoLive] = useState(false);
  const [coinFrozen, setCoinFrozen] = useState<boolean | null>(null);
  const [togglingCoin, setTogglingCoin] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setSwearDefault(civ?.data?.swear_default ?? null);
      const { data: coinRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "power.coin_frozen")
        .maybeSingle();
      setCoinFrozen(coinRow?.value === true);
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

  async function toggleSwear() {
    if (swearDefault === null) return;
    setTogglingSwear(true);
    const next = !swearDefault;
    const { error } = await supabase
      .from("civility_settings")
      .update({ swear_default: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (!error) setSwearDefault(next);
    setTogglingSwear(false);
  }

  async function toggleCoinFreeze() {
    if (coinFrozen === null) return;
    setTogglingCoin(true);
    const next = !coinFrozen;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "power.coin_frozen", value: next }, { onConflict: "key" });
    if (!error) setCoinFrozen(next);
    setTogglingCoin(false);
  }

  async function applyPaymentMode(next: "live" | "test") {
    setTogglingPayments(true);
    try {
      await setPaymentMode(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to switch payment mode");
    } finally {
      setTogglingPayments(false);
    }
  }

  function togglePaymentMode() {
    if (paymentMode === "live") {
      void applyPaymentMode("test");
    } else {
      setConfirmGoLive(true);
    }
  }

  const metrics: Metric[] = [
    { key: "profiles", label: "Members", value: loading ? null : stats.profiles, Icon: Users, tint: "#3ad6ff", to: "/boss/users", format: fmtNum },
    { key: "newToday", label: "New Today", value: loading ? null : stats.newToday, Icon: Zap, tint: "#a78bfa", format: fmtNum },
    { key: "credits", label: "Credits in Circulation", value: loading ? null : stats.creditsTotal, Icon: Coins, tint: "#ffd166", format: fmtNum },
    { key: "products", label: "Active Products", value: loading ? null : stats.activeProducts, Icon: Tags, tint: "#00e08a", to: "/boss/pricing", format: fmtNum },
    { key: "portals", label: "Portals Live", value: loading ? null : stats.portals, Icon: Radio, tint: "#ff7a1a", format: fmtNum },
    { key: "queue", label: "Pending Actions", value: loading ? null : stats.topupPending + stats.streamVerifyPending + stats.customTrackPending + stats.pendingCreditGrants, Icon: Inbox, tint: "#ff5577", format: fmtNum },
  ];

  const actionQueue: ActionItem[] = [
    { key: "topups", label: "Top-up requests", count: stats.topupPending, to: "/admin", hash: "topups", Icon: Inbox, tint: "#ff5577", hint: "Approve or deny credit top-ups" },
    { key: "stream", label: "Stream verifications", count: stats.streamVerifyPending, to: "/boss/stream-queue", Icon: Tv, tint: "#3ad6ff", hint: "Confirm 0G STREAMZ portal access" },
    { key: "ctracks", label: "Custom track requests", count: stats.customTrackPending, to: "/admin", hash: "tracks", Icon: Music, tint: "#a78bfa", hint: "Review user-submitted track briefs" },
    { key: "grants", label: "Pending credit grants", count: stats.pendingCreditGrants, to: "/admin", hash: "roster", Icon: Coins, tint: "#ffd166", hint: "Pre-allocated credits awaiting attach" },
  ];

  const totalQueue = useMemo(
    () => actionQueue.reduce((a, b) => a + b.count, 0),
    [actionQueue],
  );
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
        <p className="mt-3 text-sm text-white/65 max-w-2xl">
          Live status across members, credits, passes, portals & queues. Auto-syncs every 60s.
          For AI agents, hub controls, or model tuning open the{" "}
          <Link to="/console" className="underline" style={{ color: "var(--syndicate-glow)" }}>0G-Console</Link>.
        </p>
        {error && (
          <p className="mt-3 text-xs text-destructive" role="alert">{error}</p>
        )}
      </header>

      {/* Live metric strip */}
      <section aria-label="Key metrics" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
      </section>

      {/* Power Bar — large tactile toggles */}
      <section aria-label="Power controls" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="syndicate-header text-base md:text-lg text-white/95 flex items-center gap-2">
            <Power className="h-4 w-4" style={{ color: "#ffd166" }} /> Power Bar
            <span className="text-[10px] uppercase tracking-[0.3em] terminal-mono text-white/35 font-normal">One-tap controls</span>
          </h2>
          <Link to="/boss/power" className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/45 hover:text-gold transition">
            Full controls <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <PowerToggle
            title="Payments"
            Icon={CreditCard}
            active={paymentMode === "live"}
            activeLabel="LIVE"
            inactiveLabel="TEST"
            activeTint="#00e08a"
            inactiveTint="#ff9940"
            activeHint="Charging real cards site-wide"
            inactiveHint="Sandbox only · safe to toggle on"
            onToggle={togglePaymentMode}
            saving={togglingPayments}
            ready
          />
          <PowerToggle
            title="Coin transactions"
            Icon={Coins}
            active={coinFrozen === false}
            activeLabel="FLOWING"
            inactiveLabel="FROZEN"
            activeTint="#00e08a"
            inactiveTint="#ff5577"
            activeHint="Earn / spend live across the site"
            inactiveHint="All earn / spend halted — tap to thaw"
            onToggle={toggleCoinFreeze}
            saving={togglingCoin}
            ready={coinFrozen !== null}
          />
          <PowerToggle
            title="Guttermouth"
            Icon={Skull}
            active={swearDefault === true}
            activeLabel="ON"
            inactiveLabel="OFF"
            activeTint="#ff2e55"
            inactiveTint="#3ad6ff"
            activeHint="Foul-mouth chat is default for new sessions"
            inactiveHint="Civil mode default · tap to unleash"
            onToggle={toggleSwear}
            saving={togglingSwear}
            ready={swearDefault !== null}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <QuickJump to="/boss/power" Icon={Undo2} label="Reverse" tint="#ff5577" />
          <QuickJump to="/boss/publish-check" Icon={Rocket} label="Publish" tint="#ffd166" />
          <QuickJump to="/boss/analytics" Icon={BarChart3} label="Analytics" tint="#00e08a" />
          <QuickJump to="/boss/api-keys" Icon={KeyRound} label="Agent Keys" tint="#a78bfa" />
        </div>
      </section>

      {/* Action queue */}
      <section className="glass-obsidian-cmd rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="syndicate-header text-sm md:text-base text-white/95 flex items-center gap-2">
            <Inbox className="h-4 w-4" style={{ color: "#ff5577" }} /> Action Queue
          </h2>
          <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/45 font-bold">
            {totalQueue} open
          </span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {actionQueue.map((a) => {
            const urgent = a.count > 0;
            return (
              <li key={a.key}>
                <Link
                  to={a.to}
                  hash={a.hash}
                  className="flex items-center gap-3 p-3 group rounded-xl border transition active:scale-[0.99]"
                  style={{
                    borderColor: urgent ? `${a.tint}55` : "rgba(255,255,255,0.06)",
                    background: urgent ? `${a.tint}10` : "rgba(255,255,255,0.02)",
                  }}
                >
                  <span
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${a.tint}1f`, border: `1px solid ${a.tint}55` }}
                  >
                    <a.Icon className="h-4 w-4" style={{ color: a.tint }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white/95 truncate tracking-tight">{a.label}</div>
                    <div className="text-[11px] text-white/50 truncate">{a.hint}</div>
                  </div>
                  <span
                    className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full text-xs font-extrabold tabular-nums"
                    style={{
                      background: urgent ? `${a.tint}25` : "rgba(255,255,255,0.04)",
                      color: urgent ? a.tint : "rgba(255,255,255,0.45)",
                      border: `1px solid ${urgent ? a.tint + "66" : "rgba(255,255,255,0.08)"}`,
                      boxShadow: urgent ? `0 0 12px -3px ${a.tint}66` : "none",
                    }}
                  >
                    {a.count}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/30 group-hover:text-white/70 transition" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {TILE_CATEGORIES.map((cat) => {
        const tiles = cat.labels
          .map((l) => TILES.find((t) => t.label === l))
          .filter((t): t is Tile => Boolean(t));
        if (tiles.length === 0) return null;
        return (
          <div key={cat.id}>
            <h2 className="syndicate-header text-sm text-white/80 mb-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: cat.tint, boxShadow: `0 0 10px ${cat.tint}` }} />
              {cat.label}
              <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/35">{tiles.length}</span>
            </h2>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
            </section>
          </div>
        );
      })}
      <AlertDialog open={confirmGoLive} onOpenChange={setConfirmGoLive}>
        <AlertDialogContent className="border-destructive/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Switch payments to LIVE mode?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Every checkout site-wide will charge <strong>real money</strong> to real cards
                immediately. Sandbox / test cards will be rejected.
              </span>
              <span className="block text-orange-300">
                The "Test Mode" banner will disappear for all members the moment you confirm.
              </span>
              <span className="block text-white/60 text-xs">
                Only switch to live when your Stripe account, products and prices are fully
                verified for production.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglingPayments}>Stay in test mode</AlertDialogCancel>
            <AlertDialogAction
              disabled={togglingPayments}
              onClick={() => { void applyPaymentMode("live"); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {togglingPayments ? "Switching…" : "Yes, go LIVE"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PowerToggle({
  title, Icon, active, activeLabel, inactiveLabel, activeTint, inactiveTint,
  activeHint, inactiveHint, onToggle, saving, ready,
}: {
  title: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeTint: string;
  inactiveTint: string;
  activeHint: string;
  inactiveHint: string;
  onToggle: () => void;
  saving: boolean;
  ready: boolean;
}) {
  const tint = active ? activeTint : inactiveTint;
  const label = active ? activeLabel : inactiveLabel;
  const hint = active ? activeHint : inactiveHint;
  const disabled = !ready || saving;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      className="group relative text-left rounded-2xl p-4 border transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{
        borderColor: `${tint}66`,
        background: `linear-gradient(135deg, ${tint}14 0%, rgba(0,0,0,0.25) 100%)`,
        boxShadow: active ? `0 0 28px -10px ${tint}` : "0 0 0 transparent",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition"
          style={{
            background: `${tint}22`,
            border: `1px solid ${tint}66`,
            boxShadow: active ? `inset 0 0 12px -2px ${tint}` : "none",
          }}
        >
          <Icon className="h-5 w-5" style={{ color: tint }} />
        </span>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.2em] tabular-nums"
          style={{
            background: `${tint}1f`,
            color: tint,
            border: `1px solid ${tint}77`,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: tint,
              boxShadow: `0 0 8px ${tint}`,
              animation: active ? "pulse 1.8s ease-in-out infinite" : undefined,
            }}
          />
          {label}
        </span>
      </div>
      <div className="text-sm font-bold text-white/95 tracking-tight">{title}</div>
      <div className="mt-1 text-[11px] text-white/55 leading-snug min-h-[2.4em]">{hint}</div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/40">
          {disabled ? (saving ? "Saving…" : "Loading…") : "Tap to toggle"}
        </span>
        <span
          className="relative inline-flex h-6 w-11 items-center rounded-full transition"
          style={{
            background: active ? tint : "rgba(255,255,255,0.12)",
            boxShadow: active ? `0 0 14px -2px ${tint}` : "inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all"
            style={{ transform: `translateX(${active ? "22px" : "2px"})` }}
          />
        </span>
      </div>
    </button>
  );
}

function QuickJump({
  to, Icon, label, tint,
}: {
  to: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  tint: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.2em] transition active:scale-[0.97] hover:-translate-y-0.5"
      style={{
        borderColor: `${tint}55`,
        background: `${tint}12`,
        color: tint,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <ArrowUpRight className="h-3 w-3 opacity-50 group-hover:opacity-100 transition" />
    </Link>
  );
}
