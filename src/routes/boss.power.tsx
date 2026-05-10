import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Power, CreditCard, Coins, Skull, Undo2, Rocket, BarChart3, KeyRound,
  ShieldCheck, Bell, Tags, Grid3x3, Boxes, Inbox, Tv, Music, Users,
  RefreshCw, AlertTriangle, Crown, Activity, ArrowUpRight, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMode, setPaymentMode } from "@/hooks/use-payment-mode";
import { CollapsiblePanel } from "@/components/boss/CollapsiblePanel";
import { PowerToggle } from "@/components/boss/PowerToggle";
import { QuickJump } from "@/components/boss/QuickJump";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/boss/power")({
  head: () => ({
    meta: [
      { title: "Power Portal · Boss · 0G-STREAMZ" },
      { name: "description", content: "Ultimate boss control centre — power toggles, reversals & quick-access portal actions." },
    ],
  }),
  component: BossPowerPortal,
});

type Reversal = {
  id: string; source_table: string; source_id: string; user_id: string;
  credits_reversed: number; amount_cents: number; currency: string;
  reason: string | null; created_at: string;
};
type ReverseResult = {
  dry_run: boolean; window_minutes: number; cutoff: string;
  credit_purchases_reversed: number; track_purchases_reversed: number;
  credits_refunded: number; amount_cents_affected: number;
};

const WINDOW_PRESETS = [5, 15, 60, 240, 1440];

type QueueCounts = {
  topups: number; streams: number; tracks: number; grants: number;
  alerts: number; portals: number;
};

type PortalAction = {
  key: string;
  to: string;
  hash?: string;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
  countKey?: keyof QueueCounts;
};

const PORTAL_ACTIONS: PortalAction[] = [
  { key: "topups",   to: "/admin",             hash: "topups", label: "Top-Up Requests",  blurb: "Approve / deny credit top-ups",                Icon: Inbox,       tint: "#ff5577", countKey: "topups" },
  { key: "stream",   to: "/boss/stream-queue",                  label: "Stream Queue",     blurb: "Confirm 0G STREAMZ portal access",             Icon: Tv,          tint: "#3ad6ff", countKey: "streams" },
  { key: "tracks",   to: "/admin",             hash: "tracks", label: "Custom Tracks",    blurb: "Review user-submitted track briefs",           Icon: Music,       tint: "#a78bfa", countKey: "tracks" },
  { key: "grants",   to: "/admin",             hash: "roster", label: "Credit Grants",    blurb: "Pre-allocated credits awaiting attach",        Icon: Coins,       tint: "#ffd166", countKey: "grants" },
  { key: "users",    to: "/boss/users",                         label: "User Roster",      blurb: "Rank, status, ban, force sign-out",            Icon: Users,       tint: "#3ad6ff" },
  { key: "portals",  to: "/boss/portals",                       label: "Portals",          blurb: "Browse, edit, regenerate every portal",        Icon: Grid3x3,     tint: "#3ad6ff", countKey: "portals" },
  { key: "hubs",     to: "/boss/hubs",                          label: "Hubs",             blurb: "Manage built-in & custom hubs",                Icon: Boxes,       tint: "#a78bfa" },
  { key: "pricing",  to: "/boss/pricing",                       label: "Pricing",          blurb: "Coin packs & store catalogue",                 Icon: Tags,        tint: "#00e08a" },
  { key: "costs",    to: "/boss/portal-costs",                  label: "Coin Costs",       blurb: "Per-hub create & per-portal use costs",        Icon: Coins,       tint: "#ffd166" },
  { key: "civility", to: "/boss/civility",                      label: "Civility",         blurb: "Toggle Guttermouth swear-chat default",        Icon: ShieldCheck, tint: "#3ad6ff" },
  { key: "alerts",   to: "/boss/alerts",                        label: "System Alerts",    blurb: "Realtime API errors & fallbacks",              Icon: Bell,        tint: "#ff5577", countKey: "alerts" },
  { key: "publish",  to: "/boss/publish-check",                 label: "Publish Check",    blurb: "Pre-publish validation checklist",             Icon: Rocket,      tint: "#ffd166" },
  { key: "keys",     to: "/boss/api-keys",                      label: "Agent Keys",       blurb: "Encrypted vault for AI / API keys",            Icon: KeyRound,    tint: "#a78bfa" },
  { key: "analytics",to: "/boss/analytics",                     label: "Analytics",        blurb: "Anonymous public-view counts",                 Icon: BarChart3,   tint: "#00e08a" },
];

function BossPowerPortal() {
  const paymentMode = usePaymentMode();
  const [togglingPayments, setTogglingPayments] = useState(false);
  const [confirmGoLive, setConfirmGoLive] = useState(false);
  const [coinFrozen, setCoinFrozen] = useState<boolean | null>(null);
  const [togglingCoin, setTogglingCoin] = useState(false);
  const [swearDefault, setSwearDefault] = useState<boolean | null>(null);
  const [togglingSwear, setTogglingSwear] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [counts, setCounts] = useState<QueueCounts>({
    topups: 0, streams: 0, tracks: 0, grants: 0, alerts: 0, portals: 0,
  });

  // Reverse-purchases tool
  const [windowMinutes, setWindowMinutes] = useState<string>("60");
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ReverseResult | null>(null);
  const [history, setHistory] = useState<Reversal[]>([]);
  const minutes = useMemo(
    () => Math.max(0, Math.trunc(Number(windowMinutes) || 0)),
    [windowMinutes],
  );

  async function loadAll() {
    const head = (q: any) => q.then((r: any) => (r.error ? 0 : Math.max(0, r.count ?? 0)));
    const [civ, coin, topups, streams, tracks, grants, alerts, portals, hist] = await Promise.all([
      supabase.from("civility_settings").select("swear_default").limit(1).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "power.coin_frozen").maybeSingle(),
      head(supabase.from("topup_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
      head(supabase.from("stream_verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
      head(supabase.from("custom_track_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
      head(supabase.from("pending_credit_grants").select("*", { count: "exact", head: true })),
      head(supabase.from("system_alerts").select("*", { count: "exact", head: true }).is("acknowledged_at", null)),
      head(supabase.from("portals").select("*", { count: "exact", head: true })),
      supabase.from("purchase_reversals").select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    setSwearDefault(civ?.data?.swear_default ?? null);
    setCoinFrozen(coin?.data?.value === true);
    setCounts({ topups, streams, tracks, grants, alerts, portals });
    setHistory((hist?.data ?? []) as Reversal[]);
    setLastSync(new Date());
    setRefreshing(false);
  }

  useEffect(() => {
    void loadAll();
    const t = setInterval(() => loadAll(), 60_000);
    return () => clearInterval(t);
  }, []);

  async function applyPaymentMode(next: "live" | "test") {
    setTogglingPayments(true);
    try { await setPaymentMode(next); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to switch payment mode"); }
    finally { setTogglingPayments(false); }
  }
  function togglePaymentMode() {
    if (paymentMode === "live") void applyPaymentMode("test");
    else setConfirmGoLive(true);
  }
  async function toggleCoinFreeze() {
    if (coinFrozen === null) return;
    setTogglingCoin(true);
    const next = !coinFrozen;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "power.coin_frozen", value: next }, { onConflict: "key" });
    if (!error) setCoinFrozen(next); else toast.error(error.message);
    setTogglingCoin(false);
  }
  async function toggleSwear() {
    if (swearDefault === null) return;
    setTogglingSwear(true);
    const next = !swearDefault;
    const { error } = await supabase
      .from("civility_settings")
      .update({ swear_default: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (!error) setSwearDefault(next); else toast.error(error.message);
    setTogglingSwear(false);
  }

  async function runReverse(dryRun: boolean) {
    if (!minutes) { toast.error("Enter a window in minutes"); return; }
    if (!dryRun && confirmText.trim().toUpperCase() !== "REVERSE") {
      toast.error('Type REVERSE to confirm'); return;
    }
    setRunning(true);
    const { data, error } = await supabase.rpc("reverse_recent_purchases", {
      window_minutes: minutes, dry_run: dryRun,
    });
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    const result = data as unknown as ReverseResult;
    setLastResult(result);
    if (dryRun) {
      toast.success(`Preview: would reverse ${result.credit_purchases_reversed + result.track_purchases_reversed} purchase(s)`);
    } else {
      toast.success(`Reversed ${result.credit_purchases_reversed + result.track_purchases_reversed} purchase(s)`);
      setConfirmText("");
      void loadAll();
    }
  }

  const totalQueue = counts.topups + counts.streams + counts.tracks + counts.grants;
  const ok = totalQueue === 0 && counts.alerts === 0;

  return (
    <div className="space-y-6">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6" style={{ color: "#ffd166" }} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
                0G · Power Portal
              </p>
              <h1 className="syndicate-header text-2xl md:text-3xl text-white/95">Ultimate Boss Controls</h1>
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
            >
              {ok ? <Sparkles className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {ok ? "All clear" : `${totalQueue + counts.alerts} need attention`}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/40">
              <Activity className="h-3.5 w-3.5" />
              {lastSync ? `Synced ${lastSync.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "—"}
            </span>
            <button
              type="button"
              onClick={() => { setRefreshing(true); void loadAll(); }}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/15 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/65 max-w-2xl">
          Master switches, reversals & every portal action in one place. For full metrics open the{" "}
          <Link to="/boss/overview" className="underline" style={{ color: "var(--syndicate-glow)" }}>Boss Overview</Link>.
        </p>
      </header>

      {/* Power toggles */}
      <CollapsiblePanel
        id="pwr.toggles"
        title="Power Bar"
        Icon={Power}
        tint="#ffd166"
        subtitle="One-tap master switches — payments, coins & chat tone"
      >
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <QuickJump to="/boss/power" hash="reverse" Icon={Undo2} label="Reverse" tint="#ff5577" />
          <QuickJump to="/boss/publish-check" Icon={Rocket} label="Publish" tint="#ffd166" />
          <QuickJump to="/boss/analytics" Icon={BarChart3} label="Analytics" tint="#00e08a" />
          <QuickJump to="/boss/api-keys" Icon={KeyRound} label="Agent Keys" tint="#a78bfa" />
        </div>
      </CollapsiblePanel>

      {/* Portal Actions — quick-access grid */}
      <CollapsiblePanel
        id="pwr.actions"
        title="Portal Actions"
        Icon={Sparkles}
        tint="#a78bfa"
        subtitle="Every boss action surface — pending counts shown live"
        badge={
          totalQueue > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-200 ring-1 ring-rose-400/40">
              {totalQueue} pending
            </span>
          ) : null
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PORTAL_ACTIONS.map((a) => {
            const count = a.countKey ? counts[a.countKey] : 0;
            const hot = a.countKey === "alerts" ? count > 0 : count > 0 && a.countKey !== "portals";
            return (
              <Link
                key={a.key}
                to={a.to}
                hash={a.hash}
                className="group relative rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  borderColor: `${a.tint}55`,
                  background: `linear-gradient(135deg, ${a.tint}10 0%, rgba(0,0,0,0.25) 100%)`,
                  boxShadow: hot ? `0 0 22px -10px ${a.tint}` : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ background: `${a.tint}1f`, border: `1px solid ${a.tint}55` }}
                  >
                    <a.Icon className="h-4 w-4" style={{ color: a.tint }} />
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition" style={{ color: a.tint }} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <h3 className="syndicate-header text-sm text-white/95">{a.label}</h3>
                  {a.countKey && count > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[10px] font-extrabold tabular-nums"
                      style={{
                        background: hot ? a.tint : `${a.tint}22`,
                        color: hot ? "#0a0a0a" : a.tint,
                        boxShadow: hot ? `0 0 12px ${a.tint}77` : undefined,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-white/55 leading-snug">{a.blurb}</p>
              </Link>
            );
          })}
        </div>
      </CollapsiblePanel>

      {/* Reverse purchases */}
      <CollapsiblePanel
        id="pwr.reverse"
        title="Reverse Recent Purchases"
        Icon={Undo2}
        tint="#ff5577"
        defaultOpen={false}
        subtitle="Refund credit purchases & log track reversals — always dry-run first"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-200 ring-1 ring-rose-400/40">
            destructive
          </span>
        }
      >
        <div id="reverse" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55 font-bold mr-1">Window</span>
            {WINDOW_PRESETS.map((m) => {
              const active = minutes === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWindowMinutes(String(m))}
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tabular-nums transition active:scale-[0.96]",
                    active
                      ? "bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/60 shadow-[0_0_18px_-6px_rgba(244,63,94,0.7)]"
                      : "bg-white/5 text-white/55 hover:text-white/90 ring-1 ring-white/10",
                  ].join(" ")}
                >
                  {m < 60 ? `${m}m` : m < 1440 ? `${m / 60}h` : `${m / 1440}d`}
                </button>
              );
            })}
            <input
              type="number"
              min={1}
              max={10080}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(e.target.value)}
              className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/90 tabular-nums"
              aria-label="Custom window in minutes"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55 font-bold">
              Type REVERSE to arm
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="REVERSE"
                className="w-44 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm font-bold tracking-widest text-rose-200 placeholder:text-white/20"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => runReverse(true)}
                disabled={running}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-white/90 hover:bg-white/10 disabled:opacity-50"
              >
                Dry-run preview
              </button>
              <button
                type="button"
                onClick={() => runReverse(false)}
                disabled={running || confirmText.trim().toUpperCase() !== "REVERSE"}
                className="rounded-md bg-rose-500/90 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Execute reverse
              </button>
            </div>
          </div>

          {lastResult && (
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] terminal-mono text-white/45 font-bold">Credit purchases</div>
                <div className="text-sm font-extrabold text-white/95 tabular-nums mt-0.5">{lastResult.credit_purchases_reversed}</div>
              </li>
              <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] terminal-mono text-white/45 font-bold">Track purchases</div>
                <div className="text-sm font-extrabold text-white/95 tabular-nums mt-0.5">{lastResult.track_purchases_reversed}</div>
              </li>
              <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] terminal-mono text-white/45 font-bold">Credits refunded</div>
                <div className="text-sm font-extrabold text-white/95 tabular-nums mt-0.5">{lastResult.credits_refunded}</div>
              </li>
              <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] terminal-mono text-white/45 font-bold">Cents affected</div>
                <div className="text-sm font-extrabold text-white/95 tabular-nums mt-0.5">{lastResult.amount_cents_affected}</div>
              </li>
            </ul>
          )}

          {history.length > 0 && (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <div className="px-3 py-2 text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55 font-bold bg-white/5">
                Recent reversals
              </div>
              <ul className="divide-y divide-white/5">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white/85 truncate">{h.source_table} · {h.source_id.slice(0, 8)}</div>
                      <div className="text-white/45 text-[10px]">{new Date(h.created_at).toLocaleString("en-GB")}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-rose-200 font-extrabold">−{h.credits_reversed}c</div>
                      <div className="text-white/45 text-[10px]">{h.amount_cents}{h.currency}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsiblePanel>

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
