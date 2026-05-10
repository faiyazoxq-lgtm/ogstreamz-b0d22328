import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Crown, Users, Coins, Ticket, KeyRound, Handshake, Inbox, FileText, ArrowUpRight,
  Share2, ShieldCheck, BarChart3, Skull, Activity, RefreshCw, AlertTriangle, Tv,
  Tags, Music, CheckCircle2, Radio, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  Icon: React.ComponentType<{ className?: string }>;
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
  { to: "/boss/users",               label: "User Roster",      blurb: "Full control · rank, status, credits, ban, force sign-out, stream verify", Icon: Users,    tint: "#3ad6ff" },
  { to: "/admin", hash: "roster",    label: "Legacy Roster",    blurb: "Original admin console roster view",                Icon: Users,    tint: "#94a3b8" },
  { to: "/admin", hash: "topups",    label: "Top-Up Requests",  blurb: "Approve or deny credit top-ups",                     Icon: Inbox,    tint: "#ff5577" },
  { to: "/admin", hash: "roster",    label: "Adjust Credits",   blurb: "Boss-grant credits by email or user-id",             Icon: Coins,    tint: "#ffd166" },
  { to: "/admin", hash: "passes",    label: "VIP Passes",       blurb: "Mint, grant, revoke, share signup passes",           Icon: Ticket,   tint: "#a78bfa" },
  { to: "/admin", hash: "codes",     label: "Redeem Codes",     blurb: "Create, list, expire promo codes",                   Icon: KeyRound, tint: "#00e08a" },
  { to: "/admin", hash: "resellers", label: "Resellers",        blurb: "Reseller wallets, mark-up, downline",                Icon: Handshake,tint: "#ff7a1a" },
  { to: "/admin", hash: "share",     label: "Share Cards",      blurb: "Generate share-link cards for passes",               Icon: Share2,   tint: "#ff5acd" },
  { to: "/admin", hash: "notes",     label: "Boss Notes",       blurb: "Private operational notes",                          Icon: FileText, tint: "#94a3b8" },
  { to: "/boss/civility",            label: "Civility Controls",blurb: "Toggle Guttermouth swear-chat · keep things civil", Icon: ShieldCheck, tint: "#3ad6ff" },
  { to: "/boss/analytics",           label: "View Analytics",   blurb: "Anonymous public-view counts for every portal & battle", Icon: BarChart3, tint: "#00e08a" },
  { to: "/boss/lexicon",             label: "Swear Lexicon",    blurb: "Edit HEAVY/MID/SOFT word lists · refusal patterns · openers", Icon: Skull, tint: "#ff2e55" },
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

      {/* Action queue + quick controls */}
      <section className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <div className="glass-obsidian-cmd rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="syndicate-header text-sm md:text-base text-white/95 flex items-center gap-2">
              <Inbox className="h-4 w-4" style={{ color: "#ff5577" }} /> Action Queue
            </h2>
            <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/45">
              {totalQueue} open
            </span>
          </div>
          <ul className="divide-y divide-white/5">
            {actionQueue.map((a) => {
              const urgent = a.count > 0;
              return (
                <li key={a.key}>
                  <Link
                    to={a.to}
                    hash={a.hash}
                    className="flex items-center gap-3 py-2.5 px-1 group hover:bg-white/[0.03] rounded-md transition"
                  >
                    <span
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${a.tint}1f`, border: `1px solid ${a.tint}55` }}
                    >
                      <a.Icon className="h-4 w-4" style={{ color: a.tint }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white/90 truncate">{a.label}</div>
                      <div className="text-[11px] text-white/50 truncate">{a.hint}</div>
                    </div>
                    <span
                      className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
                      style={{
                        background: urgent ? `${a.tint}22` : "rgba(255,255,255,0.04)",
                        color: urgent ? a.tint : "rgba(255,255,255,0.45)",
                        border: `1px solid ${urgent ? a.tint + "66" : "rgba(255,255,255,0.08)"}`,
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
        </div>

        <div className="glass-obsidian-cmd rounded-2xl p-4 md:p-5">
          <h2 className="syndicate-header text-sm md:text-base text-white/95 flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4" style={{ color: "#ffd166" }} /> Quick Controls
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#3ad6ff" }} />
                  Guttermouth default
                </div>
                <div className="text-[11px] text-white/50">
                  Site-wide swear-chat default for new sessions.
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSwear}
                disabled={swearDefault === null || togglingSwear}
                aria-pressed={!!swearDefault}
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50"
                style={{
                  background: swearDefault ? "#00e08a" : "rgba(255,255,255,0.15)",
                  boxShadow: swearDefault ? "0 0 14px -2px #00e08a99" : "none",
                }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white transition"
                  style={{ transform: `translateX(${swearDefault ? "22px" : "2px"})` }}
                />
              </button>
            </div>
            <Link
              to="/boss/civility"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05] transition"
            >
              <span className="text-sm font-semibold text-white/90 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#3ad6ff" }} /> Civility console
              </span>
              <ArrowUpRight className="h-4 w-4 text-white/40" />
            </Link>
            <Link
              to="/boss/analytics"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05] transition"
            >
              <span className="text-sm font-semibold text-white/90 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" style={{ color: "#00e08a" }} /> View analytics
              </span>
              <ArrowUpRight className="h-4 w-4 text-white/40" />
            </Link>
            <Link
              to="/console"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05] transition"
            >
              <span className="text-sm font-semibold text-white/90 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-300" /> 0G-Console
              </span>
              <ArrowUpRight className="h-4 w-4 text-white/40" />
            </Link>
          </div>
        </div>
      </section>

      <div>
        <h2 className="syndicate-header text-sm text-white/70 mb-3 flex items-center gap-2">
          <Crown className="h-3.5 w-3.5" style={{ color: "#ffd166" }} /> All Modules
        </h2>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => (
          <Link
            key={t.label + (t.hash ?? "")}
            to={t.to}
            hash={t.hash}
            className="group glass-obsidian-cmd rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{ borderColor: `${t.tint}66` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: `${t.tint}1f`, border: `1px solid ${t.tint}55` }}
              >
                <t.Icon className="h-5 w-5" style={{ color: t.tint }} />
              </div>
              <ArrowUpRight
                className="h-4 w-4 opacity-50 group-hover:opacity-100 transition"
                style={{ color: t.tint }}
              />
            </div>
            <h2 className="mt-4 syndicate-header text-base text-white/95">{t.label}</h2>
            <p className="mt-1 text-xs text-white/60 leading-relaxed">{t.blurb}</p>
          </Link>
        ))}
      </section>
      </div>
    </div>
  );
}
