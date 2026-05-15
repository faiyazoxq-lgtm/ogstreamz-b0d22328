import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2, Save, Telescope, Link2, Wand2, Copy, ExternalLink, Music, Upload, Disc3, Wrench, Send, Sparkles, Rocket, Eye, TrendingUp, Satellite, Bot, Radio, Trash2, Megaphone, Users, Zap, Radar, Megaphone as MegaIcon, Sliders, Power, Cpu, Database, RefreshCw, Brain, Activity, Terminal, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { SyndicateProtocolSwitch } from "@/components/SyndicateProtocolSwitch";
import { CivilityPanel } from "@/components/boss/CivilityPanel";
import { useServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/lib/route-guards";
import { scoutUrl } from "@/lib/firecrawl.functions";
import { spawnPortal, bossDeletePortal } from "@/lib/portals.functions";
import { spawnMusicPortal } from "@/lib/music-portals.functions";
import { createTrack } from "@/lib/tracks.functions";
import { spawnTool } from "@/lib/tools.functions";
import { spawnTradePortal } from "@/lib/trade.functions";
import { spawnNewsPortal } from "@/lib/news.functions";
import { generatePortalCinema } from "@/lib/cinema.functions";
import { listBots, upsertBot, deleteBot, broadcastGlobalAlert, runSyndicateTickNow, getFleetStats, setSubscriberPlan, type Plan } from "@/lib/syndicate.functions";
import { generateBrandBible, updateTelegramLinks, deployToTelegram } from "@/lib/telegram.functions";
import { runAgentTask, getOpsSnapshot, runMaintenance } from "@/lib/command-deck.functions";
import { getNerdStats } from "@/lib/nerd-stats.functions";
import { CoinChip } from "@/components/CoinChip";
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

const NAV_SECTIONS: { id: string; label: string; tint: string }[] = [
  { id: "roster", label: "Roster", tint: "#3ad6ff" },
  { id: "intel", label: "Intel · Recon", tint: "#ff2233" },
  { id: "spawners", label: "Spawners · Build", tint: "#ffd166" },
  { id: "broadcast", label: "Broadcast · Reach", tint: "#00e08a" },
  { id: "hubs", label: "Hub Controls", tint: "#a78bfa" },
  { id: "mood", label: "Global Mood", tint: "#ff2e55" },
  { id: "homehubs", label: "Homepage Hubs", tint: "#ff00aa" },
  { id: "topups", label: "Top-Ups", tint: "#ff5577" },
  { id: "command", label: "Command Deck", tint: "#ff00aa" },
  { id: "nerd-stats", label: "Nerd Stats", tint: "#7dd3fc" },
];

export const Route = createFileRoute("/admin")({
  beforeLoad: requireBoss,
  head: () => ({ meta: [{ title: "Power Console · 0G-PORTAL" }] }),
  component: AdminPage,
});

type Row = {
  id: string;
  email: string;
  status: "free" | "vip";
  credits: number;
  rank?: "boss" | "enforcer" | "prospect" | "vip";
  display_name?: string | null;
  stream_links?: unknown;
};

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [rosterQuery, setRosterQuery] = useState("");
  const [rosterStatus, setRosterStatus] = useState<"all" | "free" | "vip">("all");
  const [rosterRank, setRosterRank] = useState<"all" | "prospect" | "enforcer" | "vip">("all");
  const [rosterCredits, setRosterCredits] = useState<"all" | "zero" | "low" | "high">("all");
  const [rosterSort, setRosterSort] = useState<{ key: "email" | "rank" | "status" | "credits"; dir: "asc" | "desc" }>({ key: "email", dir: "asc" });

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id,email,status,credits,rank,display_name,stream_links")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows(((data as Row[]) ?? []).filter((r) => r.rank !== "boss"));
      });
  }, [isAdmin]);

  const update = async (id: string, patch: Partial<Row>) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    toast.success("Vault updated");
  };

  if (loading || !isAdmin) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  const q = rosterQuery.trim().toLowerCase();
  const RANK_ORDER: Record<string, number> = { prospect: 0, enforcer: 1, vip: 2, boss: 3 };
  const streamHaystack = (links: Row["stream_links"]) => {
    if (!links || typeof links !== "object") return "";
    const parts: string[] = [];
    const walk = (v: unknown) => {
      if (!v) return;
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
    };
    walk(links);
    return parts.join(" ").toLowerCase();
  };
  const filteredRows = rows.filter((r) => {
    if (q) {
      const hay = [
        r.email,
        r.display_name ?? "",
        streamHaystack(r.stream_links),
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (rosterStatus !== "all" && r.status !== rosterStatus) return false;
    if (rosterRank !== "all" && r.rank !== rosterRank) return false;
    if (rosterCredits === "zero" && (r.credits ?? 0) !== 0) return false;
    if (rosterCredits === "low" && !((r.credits ?? 0) > 0 && (r.credits ?? 0) < 10)) return false;
    if (rosterCredits === "high" && (r.credits ?? 0) < 10) return false;
    return true;
  }).slice().sort((a, b) => {
    const dir = rosterSort.dir === "asc" ? 1 : -1;
    switch (rosterSort.key) {
      case "email":
        return a.email.localeCompare(b.email) * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "credits":
        return ((a.credits ?? 0) - (b.credits ?? 0)) * dir;
      case "rank":
        return ((RANK_ORDER[a.rank ?? ""] ?? -1) - (RANK_ORDER[b.rank ?? ""] ?? -1)) * dir;
    }
  });
  const toggleSort = (key: "email" | "rank" | "status" | "credits") =>
    setRosterSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const sortIndicator = (key: "email" | "rank" | "status" | "credits") =>
    rosterSort.key === key ? (rosterSort.dir === "asc" ? "▲" : "▼") : "↕";

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          <Shield className="inline h-3.5 w-3.5 mr-2" />Power Console
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">One-Hit Command Deck</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tap a tile to fire. Sections grouped by mission type.</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* LEFT — Tools rail */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 rounded-2xl border border-border bg-card/60 backdrop-blur p-3">
            <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
              <Wrench className="h-3 w-3" /> Tools
            </p>
            <nav className="flex flex-col gap-1">
              {NAV_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="px-3 py-2 rounded-lg text-xs font-semibold hover:bg-white/5 transition border-l-2"
                  style={{ borderColor: s.tint, color: s.tint }}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* CENTER — main panels */}
        <div className="min-w-0">
      <SectionHeader id="roster" icon={<Users className="h-4 w-4" />} label="Roster" tint="#3ad6ff" />
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2">
        <input
          type="search"
          value={rosterQuery}
          onChange={(e) => setRosterQuery(e.target.value)}
          placeholder="Search by email…"
          className="flex-1 min-w-[160px] rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <select
          value={rosterStatus}
          onChange={(e) => setRosterStatus(e.target.value as typeof rosterStatus)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          aria-label="Filter by status"
        >
          <option value="all">All status</option>
          <option value="free">Free</option>
          <option value="vip">VIP</option>
        </select>
        <select
          value={rosterRank}
          onChange={(e) => setRosterRank(e.target.value as typeof rosterRank)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          aria-label="Filter by rank"
        >
          <option value="all">All ranks</option>
          <option value="prospect">Prospect</option>
          <option value="enforcer">Enforcer</option>
          <option value="vip">VIP</option>
        </select>
        <select
          value={rosterCredits}
          onChange={(e) => setRosterCredits(e.target.value as typeof rosterCredits)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          aria-label="Filter by credits"
        >
          <option value="all">Any credits</option>
          <option value="zero">0 🪙</option>
          <option value="low">1–9 🪙</option>
          <option value="high">10+ 🪙</option>
        </select>
        <span className="ml-auto text-[10px] uppercase tracking-[0.25em] text-muted-foreground tabular-nums">
          {filteredRows.length} / {rows.length}
        </span>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border">
          {([
            { key: "email", label: "Email", span: "col-span-4", align: "" },
            { key: "rank", label: "Rank", span: "col-span-2", align: "" },
            { key: "status", label: "Status", span: "col-span-2", align: "" },
            { key: "credits", label: "Credits", span: "col-span-2", align: "" },
          ] as const).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleSort(c.key)}
              className={`${c.span} flex items-center gap-1.5 text-left uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors`}
              aria-label={`Sort by ${c.label}`}
            >
              <span>{c.label}</span>
              <span className={`text-[9px] ${rosterSort.key === c.key ? "text-foreground" : "opacity-50"}`}>
                {sortIndicator(c.key)}
              </span>
            </button>
          ))}
          <div className="col-span-2 text-right">Action</div>
        </div>
        {filteredRows.map((r) => (
          <RoleRow key={r.id} row={r} busy={busy === r.id} onSave={(p) => update(r.id, p)} />
        ))}
        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No members yet.</p>
        )}
        {rows.length > 0 && filteredRows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No members match these filters.</p>
        )}
      </div>

      <SectionHeader id="intel" icon={<Radar className="h-4 w-4" />} label="Intel · Recon" tint="#ff2233" />
      <div className="space-y-6">
        <ScoutPanel />
        <LeadTrackingPanel />
        <SignalCommandPanel />
        <NewsScoutSpawnerPanel />
      </div>

      <SectionHeader id="spawners" icon={<Zap className="h-4 w-4" />} label="Spawners · Build" tint="#ffd166" />
      <div className="space-y-6">
        <SpawnerPanel />
        <MusicSpawnerPanel />
        <TrackUploadPanel />
        <ToolSpawnerPanel />
        <TradeSpawnerPanel />
      </div>

      <SectionHeader id="broadcast" icon={<MegaIcon className="h-4 w-4" />} label="Broadcast · Reach" tint="#00e08a" />
      <div className="space-y-6">
        <TelegramSocialsPanel />
        <FleetCommanderPanel />
        <ConnectHubLinkPanel />
      </div>

      <SectionHeader id="hubs" icon={<Sliders className="h-4 w-4" />} label="Hub Controls · Tuning" tint="#a78bfa" />
      <HubControlsPanel />

      <SectionHeader id="mood" icon={<Brain className="h-4 w-4" />} label="Global Mood · Syndicate Protocol" tint="#ff2e55" />
      <div className="grid gap-4 md:grid-cols-2">
        <SyndicateProtocolSwitch
          hubKey="shape-bridge"
          eyebrow="Full Site · Syndicate Protocol"
          titleNormal="Global Mood · NORMAL"
          titleOg="Global Mood · OG-MODE"
          descriptionNormal={
            <>
              <span className="mood-accent">NORMAL</span> — every site-wide Gemini 3 surface
              (Boss Chat, Shape Bridge, hub agents, jokes, news, lexicon) speaks in the clean
              Elite Analyst voice. PG, brand-safe, no swearing. The OG Bot toggle is separate
              and unaffected.
            </>
          }
          descriptionOg={
            <>
              <span className="mood-accent">OG-MODE</span> — full swearing &amp; chaos across
              every site-wide Gemini 3 surface: Boss Chat, Shape Bridge, hub agents, jokes,
              news, lexicon. Descriptions stay accurate, the voice goes feral. Does NOT touch
              the OG Bot persona — that has its own switch.
            </>
          }
          ogBadge="Full Site · OG Brutal"
        />
        <SyndicateProtocolSwitch
          hubKey="og-bot"
          eyebrow="OG Bot · Telegram Enforcer"
          titleNormal="Global Mood · NORMAL"
          titleOg="Global Mood · OG-MODE"
          descriptionNormal={
            <>
              <span className="mood-accent">NORMAL</span> — OG Bot replies on Telegram and the
              draft assistant stay polite, brand-safe and helpful. No swearing, no threats.
              Does not change anything outside the OG Bot.
            </>
          }
          descriptionOg={
            <>
              <span className="mood-accent">OG-MODE</span> — OG Bot turns into the foul-mouthed
              enforcer: unfiltered swearing, banter, threats and chaos in every Telegram reply
              and draft. Scoped to the OG Bot only — the rest of the site keeps whatever the
              full-site switch says.
            </>
          }
          ogBadge="OG Bot · Foul Mouth"
        />
      </div>
      <details className="mt-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/55">
        <summary className="cursor-pointer">Legacy bridge controls</summary>
        <div className="pt-3"><ShapeBridgePanel /></div>
      </details>

      <div className="mt-6">
        <CivilityPanel />
      </div>

      <SectionHeader id="homehubs" icon={<Rocket className="h-4 w-4" />} label="Homepage · Custom Hubs" tint="#ff00aa" />
      <CustomHubBuilderPanel />

      <SectionHeader id="command" icon={<Terminal className="h-4 w-4" />} label="Command Deck · Superuser" tint="#ff00aa" />
      <div className="space-y-6">
        <OpsSnapshotPanel />
        <AgentConsoleMovedNotice />
        <MaintenancePanel />
      </div>

      <SectionHeader id="nerd-stats" icon={<Database className="h-4 w-4" />} label="Nerd Stats · Deep Telemetry" tint="#7dd3fc" />
      <NerdStatsPanel />
        </div>

        {/* RIGHT — Users DB + quick actions */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            <UsersDirectoryPanel rows={rows} busy={busy} onUpdate={update} />
            <QuickActionsPanel />
          </div>
        </aside>
      </div>
    </main>
  );
}

function SectionHeader({ id, icon, label, tint }: { id?: string; icon: React.ReactNode; label: string; tint: string }) {
  return (
    <div id={id} className="mt-12 mb-4 flex items-center gap-3 scroll-mt-24">
      <span
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.4em] font-bold"
        style={{ background: `${tint}1a`, border: `1px solid ${tint}55`, color: tint }}
      >
        {icon}
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${tint}66, transparent)` }} />
    </div>
  );
}

function UsersDirectoryPanel({ rows, busy, onUpdate }: { rows: Row[]; busy: string | null; onUpdate: (id: string, patch: Partial<Row>) => void }) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => !q || r.email.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
          <Database className="h-3 w-3" /> Users DB
        </p>
        <span className="text-[10px] text-muted-foreground">{filtered.length}/{rows.length}</span>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email…" className="mb-3 h-8 text-xs" />
      <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-2">
        {filtered.slice(0, 60).map((r) => (
          <div key={r.id} className="rounded-lg border border-white/10 bg-black/30 p-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate font-mono text-[11px]" title={r.email}>{r.email}</span>
              <CoinChip credits={r.credits} />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider"
                style={{
                  background: r.status === "vip" ? "#ffd16622" : "#ffffff10",
                  color: r.status === "vip" ? "#ffd166" : "#9aa4b2",
                }}
              >
                {r.status}
              </span>
              <span className="text-[10px] text-muted-foreground">{r.credits} cr</span>
              <div className="flex gap-1">
                <button
                  disabled={busy === r.id}
                  onClick={() => onUpdate(r.id, { credits: r.credits + 10 })}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px]"
                  title="+10 credits"
                >
                  +10
                </button>
                <button
                  disabled={busy === r.id}
                  onClick={() => onUpdate(r.id, { status: r.status === "vip" ? "free" : "vip" })}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px]"
                  title="Toggle VIP"
                >
                  VIP
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-[11px] text-muted-foreground py-6">No matches.</p>
        )}
      </div>
    </div>
  );
}

function QuickActionsPanel() {
  const actions: { label: string; href: string; icon: React.ReactNode; tint: string }[] = [
    { label: "Home", href: "/", icon: <ExternalLink className="h-3 w-3" />, tint: "#3ad6ff" },
    { label: "Battle Hub", href: "/battle", icon: <Zap className="h-3 w-3" />, tint: "#ff2e55" },
    { label: "Profile", href: "/profile", icon: <Users className="h-3 w-3" />, tint: "#a78bfa" },
    { label: "Store", href: "/store", icon: <Rocket className="h-3 w-3" />, tint: "#ffd166" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4">
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2 mb-3">
        <Activity className="h-3 w-3" /> Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            to={a.href}
            className="flex items-center gap-1.5 px-2 py-2 rounded-lg border text-[11px] font-semibold hover:bg-white/5 transition"
            style={{ borderColor: `${a.tint}55`, color: a.tint }}
          >
            {a.icon}
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ConnectHubLinkPanel() {
  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between">
      <div>
        <h2 className="font-bold text-lg flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /> ConnectHUB · Growth Engine</h2>
        <p className="text-xs text-muted-foreground mt-1">Signal-based prospecting: Firecrawl scout → Apollo enrich → Gemini draft → Instantly send.</p>
      </div>
      <Link to="/connect" className="text-sm font-semibold text-primary hover:underline">Open →</Link>
    </section>
  );
}

function ShapeBridgePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<"og" | "normal">("og");
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("hub_settings")
        .select("id, enabled, tuning")
        .eq("hub_key", "shape-bridge")
        .maybeSingle();
      if (!alive) return;
      if (data) {
        setId(data.id);
        setEnabled(!!data.enabled);
        const t = (data.tuning ?? {}) as { mode?: string };
        setMode(t.mode === "normal" ? "normal" : "og");
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function persist(next: { enabled?: boolean; mode?: "og" | "normal" }) {
    if (!id) return;
    setSaving(true);
    const newEnabled = next.enabled ?? enabled;
    const newMode = next.mode ?? mode;
    const { error } = await supabase
      .from("hub_settings")
      .update({
        enabled: newEnabled,
        tuning: { mode: newMode },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnabled(newEnabled);
    setMode(newMode);
    toast.success(`Shape Bridge → ${newMode === "og" ? "OG-MODE (Sweary)" : "Normal Mode"}`);
  }

  const isOg = mode === "og";
  const accent = isOg ? "#ff5c8a" : "#3b82f6";

  return (
    <section
      className="rounded-3xl border p-6 md:p-8"
      style={{
        borderColor: `${accent}55`,
        background: `radial-gradient(120% 120% at 0% 0%, ${accent}22, transparent 55%), linear-gradient(180deg, rgba(8,10,18,0.92), rgba(8,10,18,0.85))`,
        boxShadow: `0 30px 80px -50px ${accent}aa`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em]" style={{ color: accent }}>
            <Brain className="h-3.5 w-3.5" /> 0G-Shape-Bridge
          </div>
          <h3 className="text-2xl md:text-3xl font-extrabold leading-tight">
            Global Mood · {isOg ? "OG-MODE" : "NORMAL"}
          </h3>
          <p className="text-sm text-white/65">
            Controls how your Shapes Inc OG-MODE character replies in the Shapes chat window.
            <span className="text-white/85"> OG-MODE</span> = brutal, hilarious Swearing AI roasting weak hands with live Gold/Oil signals.
            <span className="text-white/85"> Normal Mode</span> = clean, professional trade desk tone using the same market context.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/55">Bridge</div>
            <div className="text-sm font-semibold">{enabled ? "Online" : "Offline"}</div>
          </div>
          <Switch
            checked={enabled}
            disabled={loading || saving}
            onCheckedChange={(v) => persist({ enabled: v })}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {([
          { key: "og" as const, label: "OG-MODE", sub: "Enforcer · Crimson Pulse", color: "#ff2e55" },
          { key: "normal" as const, label: "NORMAL", sub: "Elite Analyst · Gold", color: "#ffd166" },
        ]).map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              disabled={loading || saving}
              onClick={() => persist({ mode: opt.key })}
              className="group relative overflow-hidden rounded-2xl border p-4 text-left transition disabled:opacity-50"
              style={{
                borderColor: active ? opt.color : "rgba(255,255,255,0.08)",
                background: active
                  ? `linear-gradient(135deg, ${opt.color}33, transparent 70%), rgba(8,10,18,0.85)`
                  : "rgba(8,10,18,0.6)",
                boxShadow: active ? `0 18px 40px -28px ${opt.color}` : "none",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: opt.color }}>
                    {active ? "Active" : "Tap to switch"}
                  </div>
                  <div className="mt-1 text-lg font-bold">{opt.label}</div>
                  <div className="text-xs text-white/60">{opt.sub}</div>
                </div>
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ background: opt.color, boxShadow: active ? `0 0 14px ${opt.color}` : "none" }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {saving && (
        <div className="mt-4 inline-flex items-center gap-2 text-xs text-white/60">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing to bridge…
        </div>
      )}
    </section>
  );
}

function fmtMoneyCents(cents: number, currency = "usd") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format((cents ?? 0) / 100);
  } catch { return `$${((cents ?? 0) / 100).toFixed(2)}`; }
}

function StatTile({ label, value, sub, tint = "#7dd3fc" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black font-mono" style={{ color: tint }}>{value}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function NerdStatsPanel() {
  const fetchStats = useServerFn(getNerdStats);
  const [data, setData] = useState<Awaited<ReturnType<typeof getNerdStats>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true); setErr(null);
    try { setData(await fetchStats()); }
    catch (e: any) { setErr(e?.message ?? "Failed to load stats"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5 flex-wrap">
        <Database className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Nerd Stats</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Deep telemetry · live counts</span>
        <Button size="sm" variant="ghost" onClick={reload} disabled={loading} className="ml-auto text-[10px]">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" /> Refresh</>}
        </Button>
      </header>

      {err ? (
        <p className="text-sm text-red-400">{err}</p>
      ) : !data ? (
        <div className="py-8 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : (
        <div className="space-y-6">
          {/* Portals */}
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.3em] text-cyan-300 font-bold mb-2 flex items-center gap-2"><Rocket className="h-3 w-3" /> Portals</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile label="Total" value={data.portals.total} sub={`+${data.portals.new30d} in 30d`} />
              <StatTile label="VIP" value={data.portals.vip} tint="#a78bfa" />
              <StatTile label="Zero views" value={data.portals.zeroView} tint="#fb7185" />
              <StatTile label="Total opens" value={data.portals.totalViews.toLocaleString()} sub={`${data.portals.views24h} / 24h · ${data.portals.views7d} / 7d`} tint="#fbbf24" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(data.portals.byKind).map(([k, n]) => (
                <span key={k} className="text-[10px] uppercase tracking-[0.25em] font-bold px-2 py-1 rounded border border-border bg-background/40">
                  {k}: <span className="text-white font-mono">{n}</span>
                </span>
              ))}
            </div>
            {data.portals.top.length > 0 && (
              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.3em] text-muted-foreground bg-background/40">Top 5 by views</div>
                {data.portals.top.map((p: any) => (
                  <div key={p.slug} className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs items-center border-t border-border">
                    <div className="col-span-7 truncate"><span className="text-white font-bold">{p.name}</span> <span className="text-muted-foreground font-mono">/{p.slug}</span></div>
                    <div className="col-span-3 text-muted-foreground text-[10px] uppercase tracking-wider">{p.kind}</div>
                    <div className="col-span-2 text-right font-mono text-yellow-300"><Eye className="inline h-3 w-3 mr-1" />{p.view_count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Users & credits */}
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.3em] text-emerald-300 font-bold mb-2 flex items-center gap-2"><Users className="h-3 w-3" /> Users & Credits</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile label="Total users" value={data.users.total} sub={`+${data.users.new7d} in 7d`} tint="#34d399" />
              <StatTile label="VIP" value={data.users.vip} tint="#a78bfa" />
              <StatTile label="Free" value={data.users.free} />
              <StatTile label="Credits in circulation" value={data.users.creditsInCirculation.toLocaleString()} tint="#fbbf24" />
            </div>
            {data.users.topSpenders.length > 0 && (
              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.3em] text-muted-foreground bg-background/40">Top wallets</div>
                {data.users.topSpenders.map((u: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs items-center border-t border-border">
                    <div className="col-span-7 truncate text-white flex items-center gap-2 min-w-0">
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div className="col-span-1 text-[10px] uppercase tracking-wider text-muted-foreground">{u.status}</div>
                    <div className="col-span-4 text-right">
                      <CoinChip credits={u.credits} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Revenue & orders */}
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.3em] text-yellow-300 font-bold mb-2 flex items-center gap-2"><TrendingUp className="h-3 w-3" /> Revenue & Orders</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile label="Issued revenue" value={fmtMoneyCents(data.revenue.issuedRevenueCents)} tint="#34d399" />
              <StatTile label="Pending orders" value={data.revenue.pendingOrders} tint="#fbbf24" />
              <StatTile label="Credit purchases" value={data.revenue.creditPurchasesTotal} sub={`+${data.revenue.creditPurch30d} in 30d`} />
              <StatTile label="Credits sold" value={data.revenue.creditsSold.toLocaleString()} sub={fmtMoneyCents(data.revenue.creditRevenueCents)} tint="#7dd3fc" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(data.revenue.ordersByStatus).map(([k, n]) => (
                <span key={k} className="text-[10px] uppercase tracking-[0.25em] font-bold px-2 py-1 rounded border border-border bg-background/40">
                  {k}: <span className="text-white font-mono">{n}</span>
                </span>
              ))}
            </div>
          </div>

          {/* System health */}
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.3em] text-red-300 font-bold mb-2 flex items-center gap-2"><Activity className="h-3 w-3" /> System Health (24h)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile label="Errors" value={data.system.errors24h} tint="#fb7185" />
              <StatTile label="AI logs" value={data.system.aiLogs24h} />
              <StatTile label="Trade scans" value={data.system.tradeScans24h} tint="#fbbf24" />
              <StatTile label="Magic links" value={data.system.magicLinks24h} tint="#a78bfa" />
            </div>
            {data.system.recentErrors.length > 0 && (
              <div className="mt-3 rounded-lg border border-red-900/40 overflow-hidden">
                <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.3em] text-red-300 bg-red-950/30">Recent errors / warnings</div>
                {data.system.recentErrors.map((l: any, i: number) => (
                  <div key={i} className="px-3 py-1.5 text-[11px] border-t border-red-900/30 font-mono">
                    <span className={l.level === "error" ? "text-red-400" : "text-yellow-300"}>[{l.level}]</span>{" "}
                    <span className="text-muted-foreground">{l.source}</span>{" "}
                    <span className="text-white/80">{(l.message ?? "").slice(0, 200)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">Generated {new Date(data.generatedAt).toLocaleTimeString()}</p>
        </div>
      )}
    </section>
  );
}

// ─── Command Deck Panels ─────────────────────────────────────────────

const HOT_PINK = "#ff00aa";

function OpsSnapshotPanel() {
  const fetchSnap = useServerFn(getOpsSnapshot);
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setS(await fetchSnap()); }
    catch (e: any) { toast.error(e?.message ?? "Snapshot failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const tiles: { label: string; value: number | string; tint: string; icon: React.ReactNode }[] = s ? [
    { label: "Members", value: s.users, tint: "#3ad6ff", icon: <Users className="h-3 w-3" /> },
    { label: "VIP", value: s.vipUsers, tint: "#ffd166", icon: <Sparkles className="h-3 w-3" /> },
    { label: "Portals", value: s.portals, tint: "#a78bfa", icon: <Rocket className="h-3 w-3" /> },
    { label: "Tracks", value: s.tracks, tint: "#00e08a", icon: <Music className="h-3 w-3" /> },
    { label: "Suno · pending", value: s.sunoPending, tint: "#ff6b6b", icon: <Disc3 className="h-3 w-3" /> },
    { label: "Suno · 24h", value: s.sunoToday, tint: "#3ad6ff", icon: <Disc3 className="h-3 w-3" /> },
    { label: "Scans · 24h", value: s.scansToday, tint: "#ffd166", icon: <Radar className="h-3 w-3" /> },
    { label: "Custom · queue", value: s.requestsPending, tint: "#ff00aa", icon: <Wand2 className="h-3 w-3" /> },
    { label: "Bots · live", value: s.bots, tint: "#00e08a", icon: <Bot className="h-3 w-3" /> },
    { label: "Leads · 24h", value: s.leadsToday, tint: "#a78bfa", icon: <Send className="h-3 w-3" /> },
    { label: "Codes minted", value: s.codes, tint: "#3ad6ff", icon: <Save className="h-3 w-3" /> },
  ] : [];

  return (
    <section className="rounded-2xl border bg-card p-6" style={{ borderColor: `${HOT_PINK}55` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" style={{ color: HOT_PINK }} />
          <h2 className="font-[Montserrat] font-black text-xl text-white">Live Ops Snapshot</h2>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Realtime counts</span>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-8 text-xs">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Refresh
        </Button>
      </div>
      {!s && !loading && <p className="text-sm text-muted-foreground">Tap refresh to load.</p>}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border bg-black/40 p-3" style={{ borderColor: `${t.tint}44` }}>
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.3em]" style={{ color: t.tint }}>
                {t.icon} {t.label}
              </div>
              <div className="text-2xl font-black text-white mt-1 tabular-nums">{t.value}</div>
            </div>
          ))}
        </div>
      )}
      {s && <p className="mt-3 text-[10px] text-muted-foreground">Snapshot {new Date(s.ts).toLocaleTimeString()}</p>}
    </section>
  );
}

const AGENT_MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash · fast" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro · deep" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite · cheap" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash · preview" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro · preview" },
  { id: "openai/gpt-5", label: "GPT-5 · premium" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini · balanced" },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano · cheapest" },
];

const AGENT_PRESETS: { label: string; system: string; placeholder: string }[] = [
  { label: "Strategist",   system: "You are a ruthless growth strategist for a content + signals platform. Output a numbered action plan with metrics and risks.", placeholder: "How do we 10x weekly active users next 14 days?" },
  { label: "Copywriter",   system: "You are a top-tier marketing copywriter. Voice: street-smart, confident, no fluff. Return 3 variants.", placeholder: "Write hooks for our new XAU bias engine portal." },
  { label: "Analyst",      system: "You are a senior macro/quant analyst. Cross-reference recent news, give bias (BULL/BEAR/NEUTRAL), confidence, 3 decisive facts.", placeholder: "Brief me on Gold for the next 24h." },
  { label: "Code Auditor", system: "You are a senior TypeScript reviewer. Identify bugs, perf issues, and security risks. Be precise.", placeholder: "Review this snippet for race conditions…" },
  { label: "SQL Architect",system: "You are a senior Postgres/Supabase architect. Output safe parameterized SQL + RLS notes.", placeholder: "Give me a query for top 10 spending VIPs last 30 days." },
  { label: "Free Form",    system: "You are a senior operator inside a command deck. Be terse, decisive, and output actionable steps.", placeholder: "Ask anything…" },
];

function AgentConsolePanel() {
  const run = useServerFn(runAgentTask);
  const [preset, setPreset] = useState(AGENT_PRESETS[0]);
  const [model, setModel] = useState(AGENT_MODELS[0].id);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string>("");

  const fire = async () => {
    if (!prompt.trim()) return toast.error("Prompt required");
    setBusy(true); setOut("");
    try {
      const r = await run({ data: { model, system: preset.system, prompt: prompt.trim(), temperature: 0.5 } });
      setOut(r.text || "(empty response)");
      toast.success(`${model.split("/")[1]} responded`);
    } catch (e: any) { toast.error(e?.message ?? "Agent failed"); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border bg-card p-6" style={{ borderColor: `${HOT_PINK}55` }}>
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-5 w-5" style={{ color: HOT_PINK }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">AI Agent Console</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Lovable AI Gateway</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Pick a persona, choose a model, fire a prompt. Direct line to every supported AI.</p>

      <div className="grid sm:grid-cols-3 gap-2 mb-3">
        <select
          value={preset.label}
          onChange={(e) => setPreset(AGENT_PRESETS.find((p) => p.label === e.target.value) || AGENT_PRESETS[0])}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {AGENT_PRESETS.map((p) => <option key={p.label} value={p.label}>Persona · {p.label}</option>)}
        </select>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:col-span-2">
          {AGENT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={preset.placeholder}
        rows={4}
        className="font-mono text-sm"
      />

      <div className="flex items-center gap-2 mt-3">
        <Button onClick={fire} disabled={busy} style={{ background: HOT_PINK, color: "#000" }}>
          {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Thinking…</> : <><Cpu className="h-4 w-4 mr-2" />Run Agent</>}
        </Button>
        {out && (
          <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(out); toast.success("Copied"); }}>
            <Copy className="h-3 w-3 mr-1" /> Copy
          </Button>
        )}
      </div>

      {out && (
        <pre className="mt-4 rounded-lg border border-border bg-black/60 p-4 text-xs text-white whitespace-pre-wrap font-mono max-h-96 overflow-auto">
          {out}
        </pre>
      )}
    </section>
  );
}

function AgentConsoleMovedNotice() {
  return (
    <section className="rounded-2xl border bg-card p-6" style={{ borderColor: `${HOT_PINK}55` }}>
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-5 w-5" style={{ color: HOT_PINK }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">AI Agent Console</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Moved</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Every 0G Bot setting — persona, model, memory, civility, lexicon, agent keys — now lives in the
        boss-only AI Agent page.
      </p>
      <Link
        to="/boss/ai-agent"
        className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
        style={{ background: HOT_PINK, color: "#000" }}
      >
        <Cpu className="h-4 w-4" /> Open 0G Bot · AI Agent
      </Link>
    </section>
  );
}

const MAINTENANCE_ACTIONS: { id: string; label: string; desc: string; danger?: boolean; icon: React.ReactNode }[] = [
  { id: "purge_stale_suno",         label: "Purge stale Suno jobs",        desc: "Delete pending jobs older than 6h.", icon: <Disc3 className="h-4 w-4" /> },
  { id: "expire_vip_passes",        label: "Expire stale VIP passes",      desc: "Revoke any VIP pass past its expiry.", icon: <Sparkles className="h-4 w-4" /> },
  { id: "reset_free_clicks",        label: "Reset free-click counters",    desc: "Zero free_clicks_used for every member.", icon: <RefreshCw className="h-4 w-4" /> },
  { id: "clear_marketing_errors",   label: "Retry failed marketing jobs",  desc: "Flip portal_marketing errors back to pending.", icon: <Megaphone className="h-4 w-4" /> },
  { id: "purge_view_zero_portals",  label: "Delete dead portals",          desc: "Drop portals with 0 views older than 30d.", danger: true, icon: <Trash2 className="h-4 w-4" /> },
];

function MaintenancePanel() {
  const run = useServerFn(runMaintenance);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ id: string; msg: string; ts: number }[]>([]);

  const fire = async (id: string, danger?: boolean) => {
    if (danger && !confirm("This is destructive. Proceed?")) return;
    setBusy(id);
    try {
      const r = await run({ data: { action: id } });
      toast.success(r.message);
      setLog((l) => [{ id, msg: r.message, ts: Date.now() }, ...l].slice(0, 12));
    } catch (e: any) { toast.error(e?.message ?? "Action failed"); }
    finally { setBusy(null); }
  };

  return (
    <section className="rounded-2xl border bg-card p-6" style={{ borderColor: `${HOT_PINK}55` }}>
      <div className="flex items-center gap-2 mb-2">
        <Database className="h-5 w-5" style={{ color: HOT_PINK }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Power Utilities · Maintenance</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">One-Click Housekeeping</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Bulk cleanup actions. Destructive ones are flagged.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MAINTENANCE_ACTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => fire(a.id, a.danger)}
            disabled={!!busy}
            className="text-left rounded-xl border bg-black/40 p-4 transition hover:scale-[1.02] disabled:opacity-40"
            style={{ borderColor: a.danger ? "#ff223388" : `${HOT_PINK}44` }}
          >
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : a.icon}
              <span>{a.label}</span>
              {a.danger && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{a.desc}</p>
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div className="mt-5 rounded-lg border border-border bg-black/60 p-3 max-h-40 overflow-auto">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Recent runs</div>
          {log.map((l, i) => (
            <div key={i} className="text-xs font-mono text-white/80 py-0.5">
              <span className="text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span> · {l.msg}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Custom Hub Builder ───────────────────────────────────────────────

const HUB_ICON_OPTIONS = [
  "Sparkles", "Rocket", "Music2", "Smile", "Wrench", "TrendingUp",
  "Radio", "Bot", "Brain", "Zap", "Star", "Megaphone", "Disc3",
  "Satellite", "Radar",
];

const HUB_ACCENT_PRESETS = [
  "#3ad6ff", "#ff00aa", "#00e08a", "#ffd166", "#a78bfa", "#ff6b6b", "#9aa0ff",
];

type CustomHub = {
  id: string;
  title: string;
  tagline: string;
  href: string;
  icon: string;
  accent: string;
  sort_order: number;
  published: boolean;
};

function CustomHubBuilderPanel() {
  const [hubs, setHubs] = useState<CustomHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [href, setHref] = useState("/");
  const [icon, setIcon] = useState("Sparkles");
  const [accent, setAccent] = useState("#3ad6ff");
  const [sortOrder, setSortOrder] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_hubs")
      .select("*")
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) return toast.error(error.message);
    setHubs((data ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim() || !href.trim()) return toast.error("Title and link required");
    setBusy(true);
    const { error } = await supabase.from("custom_hubs").insert({
      title: title.trim(),
      tagline: tagline.trim(),
      href: href.trim(),
      icon, accent, sort_order: sortOrder, published: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Hub "${title}" published to homepage`);
    setTitle(""); setTagline(""); setHref("/"); setIcon("Sparkles");
    setAccent("#3ad6ff"); setSortOrder(0);
    load();
  };

  const togglePublished = async (h: CustomHub) => {
    const { error } = await supabase.from("custom_hubs")
      .update({ published: !h.published }).eq("id", h.id);
    if (error) return toast.error(error.message);
    setHubs((xs) => xs.map((x) => x.id === h.id ? { ...x, published: !h.published } : x));
  };

  const remove = async (h: CustomHub) => {
    if (!confirm(`Delete hub "${h.title}"?`)) return;
    const { error } = await supabase.from("custom_hubs").delete().eq("id", h.id);
    if (error) return toast.error(error.message);
    setHubs((xs) => xs.filter((x) => x.id !== h.id));
    toast.success("Hub deleted");
  };

  return (
    <section className="rounded-2xl border bg-card p-6 space-y-5" style={{ borderColor: "#ff00aa55" }}>
      <div className="flex items-center gap-2">
        <Rocket className="h-5 w-5" style={{ color: "#ff00aa" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Homepage Hub Builder</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Boss · Spawn tiles on the public homepage
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-xl border border-border bg-black/30 p-4">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AlphaHUB" className="mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Link / Path</label>
          <Input value={href} onChange={(e) => setHref(e.target.value)} placeholder="/p/alpha-portal or https://…" className="mt-1 font-mono text-xs" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Sort Order</label>
          <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value || "0"))} className="mt-1" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Tagline</label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Short pitch shown under the title." className="mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Icon</label>
          <select value={icon} onChange={(e) => setIcon(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded px-2 py-2 text-xs font-mono">
            {HUB_ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Accent</label>
          <div className="mt-1 flex flex-wrap gap-2 items-center">
            {HUB_ACCENT_PRESETS.map((c) => (
              <button key={c} type="button" onClick={() => setAccent(c)}
                className={`h-7 w-7 rounded-full border-2 transition ${accent === c ? "scale-110" : ""}`}
                style={{ background: c, borderColor: accent === c ? "#fff" : "transparent" }}
                aria-label={c}
              />
            ))}
            <Input value={accent} onChange={(e) => setAccent(e.target.value)}
              className="ml-2 w-32 font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={create} disabled={busy} className="font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Rocket className="h-4 w-4 mr-2" /> Publish Hub</>}
        </Button>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
          Live Hubs ({hubs.length})
        </p>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && hubs.length === 0 && <p className="text-xs text-muted-foreground">No custom hubs yet.</p>}
        <div className="grid sm:grid-cols-2 gap-2">
          {hubs.map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border bg-black/30 p-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${h.accent}1f`, color: h.accent, border: `1px solid ${h.accent}55` }}>
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-white truncate">{h.title}</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">{h.href}</div>
              </div>
              <Switch checked={h.published} onCheckedChange={() => togglePublished(h)}
                className="data-[state=checked]:bg-emerald-500" />
              <Button size="icon" variant="ghost" onClick={() => remove(h)} className="h-8 w-8">
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TradeSpawnerPanel() {
  return _TradeSpawnerPanelImpl();
}

function NewsScoutSpawnerPanel() {
  return _NewsScoutSpawnerImpl();
}

const SIGNAL_GROUPS: { label: string; pairs: { pair: string; sym: string; goodCtx: string; badCtx: string }[] }[] = [
  { label: "Metals", pairs: [
    { pair: "Gold", sym: "XAU", goodCtx: "Fed rate cut, weak USD, inflation surge", badCtx: "War ceasefire, lower inflation, strong USD" },
    { pair: "Silver", sym: "XAG", goodCtx: "Industrial demand, solar boom, weak USD", badCtx: "Recession fears, demand collapse" },
    { pair: "Copper", sym: "HG", goodCtx: "China stimulus, EV demand, supply cuts", badCtx: "China slowdown, mining oversupply" },
  ]},
  { label: "Currencies", pairs: [
    { pair: "GBP/USD", sym: "GBP", goodCtx: "BoE hawkish, UK GDP beat", badCtx: "BoE dovish, UK recession, USD strength" },
    { pair: "EUR/USD", sym: "EUR", goodCtx: "ECB hawkish, EZ growth", badCtx: "ECB cuts, EZ recession, USD strength" },
    { pair: "USD/JPY", sym: "JPY", goodCtx: "Fed hawkish, BoJ dovish", badCtx: "BoJ intervention, Fed cuts" },
  ]},
  { label: "Energies", pairs: [
    { pair: "Oil WTI", sym: "WTI", goodCtx: "OPEC cuts, Hormuz blockade, war escalation", badCtx: "Ceasefire, OPEC oversupply, demand drop" },
    { pair: "Brent", sym: "BRN", goodCtx: "Middle East conflict, supply disruption", badCtx: "Peace deal, inventory build" },
    { pair: "Natural Gas", sym: "NG", goodCtx: "Cold snap, Europe shortage, LNG demand", badCtx: "Mild winter, oversupply" },
  ]},
  { label: "Indexes", pairs: [
    { pair: "S&P 500", sym: "SPX", goodCtx: "Fed cuts, AI earnings beat, soft landing", badCtx: "Recession, earnings miss, geopolitical shock" },
    { pair: "NASDAQ", sym: "NDX", goodCtx: "AI capex boom, tech earnings beat", badCtx: "AI bubble fears, regulation, rate hikes" },
    { pair: "FTSE 100", sym: "UKX", goodCtx: "Commodity rally, weak GBP boost", badCtx: "UK recession, energy crash" },
  ]},
];

function SignalCommandPanel() {
  const spawn = useServerFn(spawnNewsPortal);
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<{ slug: string; bias: "good" | "bad" } | null>(null);

  const fire = async (pair: string, sym: string, bias: "good" | "bad", ctx: string) => {
    const key = `${sym}-${bias}`;
    setBusy(key);
    try {
      const r = await spawn({ data: {
        name: `${sym} ${bias === "good" ? "BULLISH" : "BEARISH"} · Bias Engine`,
        pair, bias, context: ctx, vip: false,
      }});
      setLast({ slug: r.portal.slug, bias });
      const url = `${window.location.origin}/p/${r.portal.slug}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success(`${sym} ${bias.toUpperCase()} portal live · link copied`);
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally { setBusy(null); }
  };

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Signal Command · Bias Engine</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">One-Click Spawn</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Pick a pair, fire <span className="text-emerald-400 font-bold">GOOD</span> or <span className="text-red-400 font-bold">BAD</span> news bias. Firecrawl + Perplexity build a live-refreshing portal in seconds.
      </p>
      <div className="grid gap-5">
        {SIGNAL_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-2">{group.label}</div>
            <div className="grid sm:grid-cols-3 gap-3">
              {group.pairs.map((p) => (
                <div key={p.sym} className="rounded-xl border border-border bg-black/30 p-3">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="font-[Montserrat] font-black text-white">{p.pair}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{p.sym}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => fire(p.pair, p.sym, "good", p.goodCtx)}
                      disabled={!!busy}
                      className="rounded-md py-2 text-xs font-bold tracking-widest transition-all disabled:opacity-40 hover:scale-[1.02]"
                      style={{ background: "linear-gradient(180deg,#00e08a33,#00e08a11)", border: "1px solid #00e08a88", color: "#7dffce", boxShadow: "0 0 16px #00e08a44" }}
                    >
                      {busy === `${p.sym}-good` ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "GOOD ▲"}
                    </button>
                    <button
                      onClick={() => fire(p.pair, p.sym, "bad", p.badCtx)}
                      disabled={!!busy}
                      className="rounded-md py-2 text-xs font-bold tracking-widest transition-all disabled:opacity-40 hover:scale-[1.02]"
                      style={{ background: "linear-gradient(180deg,#ff223333,#ff223311)", border: "1px solid #ff223388", color: "#ffb3b3", boxShadow: "0 0 16px #ff223344" }}
                    >
                      {busy === `${p.sym}-bad` ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "BAD ▼"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {last && (
        <div className="mt-5 rounded-lg border bg-black/40 p-3 text-xs flex items-center justify-between gap-3"
          style={{ borderColor: last.bias === "good" ? "#00e08a66" : "#ff223366" }}>
          <a href={`/p/${last.slug}`} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline truncate"
             style={{ color: last.bias === "good" ? "#00e08a" : "#ff2233" }}>
            /p/{last.slug}
          </a>
          <span className="text-muted-foreground">Link copied to clipboard</span>
        </div>
      )}
    </section>
  );
}

type HubSettings = {
  id: string;
  hub_key: string;
  display_name: string;
  enabled: boolean;
  style_prompt: string;
  model: string;
  integrations: Record<string, any>;
  tuning: Record<string, any>;
  updated_at: string;
};

const HUB_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
] as const;

const HUB_LINKS: Record<string, string> = {
  music: "/music", jokes: "/jokes", trade: "/trade", tools: "/tools",
  news: "/", connect: "/connect",
};

function HubControlsPanel() {
  const [hubs, setHubs] = useState<HubSettings[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    supabase.from("hub_settings").select("*").order("display_name")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setHubs((data ?? []) as any);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Loading hub settings…
      </section>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {hubs.map((h) => (
        <HubCard key={h.id} hub={h} onSaved={(patch) => setHubs((xs) => xs.map((x) => x.id === h.id ? { ...x, ...patch } : x))} />
      ))}
    </div>
  );
}

function HubCard({ hub, onSaved }: { hub: HubSettings; onSaved: (p: Partial<HubSettings>) => void }) {
  const [enabled, setEnabled] = useState(hub.enabled);
  const [style, setStyle] = useState(hub.style_prompt);
  const [model, setModel] = useState(hub.model);
  const [integrations, setIntegrations] = useState(JSON.stringify(hub.integrations ?? {}, null, 2));
  const [tuning, setTuning] = useState(JSON.stringify(hub.tuning ?? {}, null, 2));
  const [cooldown, setCooldown] = useState<number>(
    Number((hub.tuning as any)?.cooldown_seconds ?? 0) || 0,
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    let integrationsJson: any, tuningJson: any;
    try { integrationsJson = JSON.parse(integrations || "{}"); }
    catch { return toast.error("Integrations must be valid JSON"); }
    try { tuningJson = JSON.parse(tuning || "{}"); }
    catch { return toast.error("Tuning must be valid JSON"); }
    tuningJson = { ...tuningJson, cooldown_seconds: Math.max(0, Math.floor(cooldown || 0)) };

    setBusy(true);
    const { error } = await supabase.from("hub_settings").update({
      enabled, style_prompt: style, model,
      integrations: integrationsJson, tuning: tuningJson,
    }).eq("id", hub.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${hub.display_name} updated`);
    onSaved({ enabled, style_prompt: style, model, integrations: integrationsJson, tuning: tuningJson });
    setTuning(JSON.stringify(tuningJson, null, 2));
  };

  const toggleEnabled = async (val: boolean) => {
    setEnabled(val);
    const { error } = await supabase.from("hub_settings").update({ enabled: val }).eq("id", hub.id);
    if (error) { setEnabled(!val); return toast.error(error.message); }
    onSaved({ enabled: val });
    toast.success(`${hub.display_name} ${val ? "enabled" : "disabled"}`);
  };

  const link = HUB_LINKS[hub.hub_key];

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Power className={`h-4 w-4 ${enabled ? "text-emerald-400" : "text-muted-foreground"}`} />
            {hub.display_name}
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{hub.hub_key}</span>
          </h3>
          {link && (
            <Link to={link} className="text-[11px] text-[color:var(--neon-blue-bright)] hover:underline inline-flex items-center gap-1 mt-0.5">
              Open hub <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <Switch checked={enabled} onCheckedChange={toggleEnabled} className="data-[state=checked]:bg-emerald-500" />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Style Prompt</label>
        <Textarea
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          rows={3}
          className="mt-1 font-mono text-xs"
          placeholder="Voice, tone, formatting rules used by this hub's AI…"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
        >
          {HUB_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Integrations (JSON)</label>
          <Textarea value={integrations} onChange={(e) => setIntegrations(e.target.value)} rows={4} className="mt-1 font-mono text-[11px]" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tuning (JSON)</label>
          <Textarea value={tuning} onChange={(e) => setTuning(e.target.value)} rows={4} className="mt-1 font-mono text-[11px]" />
        </div>
      </div>

      <div className="flex items-end gap-3 p-3 rounded-lg border border-border/60 bg-background/40">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Message Cooldown (seconds per user)
          </label>
          <input
            type="number"
            min={0}
            max={3600}
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value) || 0)}
            className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
            placeholder="0 = no limit"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Throttles abuse. Each user must wait this long between AI requests on this hub.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {[0, 5, 15, 30, 60].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCooldown(v)}
              className={`text-[10px] px-2 py-0.5 rounded border ${cooldown === v ? "border-[color:var(--neon-blue-bright)] text-[color:var(--neon-blue-bright)]" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {v === 0 ? "off" : `${v}s`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={busy} className="font-bold">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" /> Save</>}
        </Button>
      </div>
    </section>
  );
}

function _NewsScoutSpawnerImpl() {
  const spawn = useServerFn(spawnNewsPortal);
  const cinema = useServerFn(generatePortalCinema);
  const [name, setName] = useState("");
  const [pair, setPair] = useState("Gold");
  const [bias, setBias] = useState<"bad" | "good" | "neutral">("bad");
  const [ctx, setCtx] = useState("Iran War");
  const [vip, setVip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<{ slug: string; name: string } | null>(null);
  const [cineBusy, setCineBusy] = useState<null | "16:9" | "9:16">(null);
  const [cineUrl, setCineUrl] = useState<string | null>(null);

  const onCinema = async (aspect: "16:9" | "9:16") => {
    if (!last) return;
    setCineBusy(aspect);
    setCineUrl(null);
    try {
      toast.message(`Veo 3.1 rendering ${aspect}…`, { description: "This takes 30–90s. Keep this tab open." });
      const r = await cinema({ data: { slug: last.slug, aspect } });
      setCineUrl(r.url);
      toast.success(`Cinema ready · ${aspect}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Veo render failed");
    } finally { setCineBusy(null); }
  };

  const onSpawn = async () => {
    if (!name.trim() || !pair.trim()) return toast.error("Name and pair required");
    setLoading(true);
    try {
      const r = await spawn({ data: { name: name.trim(), pair: pair.trim(), bias, context: ctx.trim(), vip } });
      setLast(r.portal);
      toast.success(`Intel portal "${r.portal.name}" spawned · ${r.articleCount} articles`);
      setName("");
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally { setLoading(false); }
  };

  const url = last && typeof window !== "undefined" ? `${window.location.origin}/p/${last.slug}` : "";
  const accent = bias === "bad" ? "#ff2233" : bias === "good" ? "#00e08a" : "#9aa0ff";

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6" style={{ borderColor: `${accent}66` }}>
      <div className="flex items-center gap-2 mb-2">
        <Satellite className="h-5 w-5" style={{ color: accent }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">News Scout Spawner</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Market Intelligence</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Firecrawl scrapes the top 5 articles, Perplexity writes Bias Analysis + Confidence Score. Auto-refreshes on every visitor.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="GOLD ALERT · Iran Desk" className="mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Asset Pair</label>
          <Input value={pair} onChange={(e) => setPair(e.target.value)} placeholder="Gold / BTC / EURUSD" className="mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Market Bias</label>
          <select value={bias} onChange={(e) => setBias(e.target.value as any)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1">
            <option value="bad">Bad News / War (Crimson)</option>
            <option value="good">Good News / Peace (Emerald)</option>
            <option value="neutral">Neutral Recon</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Context</label>
          <Input value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="Iran War, Fed cut, ETF flows…" className="mt-1" />
        </div>
        <label className="flex items-center gap-2 text-sm text-white sm:col-span-2">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} /> VIP-only deep analysis
        </label>
      </div>
      <Button onClick={onSpawn} disabled={loading} className="mt-4 w-full" style={{ background: accent, color: "#000" }}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Scouting the globe…</> : <><Satellite className="h-4 w-4 mr-2" />Spawn Intelligence Portal</>}
      </Button>
      {last && url && (
        <div className="mt-4 rounded-lg border bg-black/40 p-3 text-xs flex items-center justify-between gap-3" style={{ borderColor: `${accent}66` }}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline truncate" style={{ color: accent }}>{url}</a>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
            <Copy className="h-3 w-3 mr-1" /> Copy
          </Button>
        </div>
      )}
      {last && (
        <div className="mt-3 rounded-lg border bg-black/40 p-3 text-xs space-y-2" style={{ borderColor: `${accent}44` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="uppercase tracking-[0.3em] text-muted-foreground">0G-Cinema · Veo 3.1 Background</span>
            {cineUrl && <a href={cineUrl} target="_blank" rel="noopener noreferrer" className="underline truncate" style={{ color: accent }}>preview .mp4</a>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!!cineBusy} onClick={() => onCinema("16:9")} style={{ background: accent, color: "#000" }} className="flex-1">
              {cineBusy === "16:9" ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Rendering 16:9…</> : "Generate Web BG (16:9)"}
            </Button>
            <Button size="sm" variant="outline" disabled={!!cineBusy} onClick={() => onCinema("9:16")} className="flex-1" style={{ borderColor: `${accent}88`, color: accent }}>
              {cineBusy === "9:16" ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Rendering 9:16…</> : "Mobile View (9:16)"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function _TradeSpawnerPanelImpl() {
  const spawn = useServerFn(spawnTradePortal);
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<"Crypto"|"Forex"|"Stocks">("Crypto");
  const [risk, setRisk] = useState<"Degen"|"Balanced"|"Safe">("Balanced");
  const [vibe, setVibe] = useState("Whale Watching");
  const [vip, setVip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<{ slug: string; name: string } | null>(null);

  const onSpawn = async () => {
    if (!name.trim()) return toast.error("Name required");
    setLoading(true);
    try {
      const r = await spawn({ data: { name: name.trim(), assetClass, risk, vibe: vibe.trim(), vip } });
      setLast(r.portal);
      toast.success(`TradeHUBB "${r.portal.name}" spawned`);
      setName("");
    } catch (e: any) { toast.error(e?.message ?? "Spawn failed"); }
    finally { setLoading(false); }
  };

  const url = last && typeof window !== "undefined" ? `${window.location.origin}/td/${last.slug}` : "";

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6" style={{ borderColor: "rgba(57,255,20,0.4)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="h-5 w-5" style={{ color: "#39ff14" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">TradeHUBB Spawner</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">HFT Terminal</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Spawn a live signal terminal — Perplexity + Firecrawl drive the SCAN MARKETS button.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Terminal Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Whale Pulse · BTC Desk" className="mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Asset Class</label>
          <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as any)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1">
            <option>Crypto</option><option>Forex</option><option>Stocks</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Risk Level</label>
          <select value={risk} onChange={(e) => setRisk(e.target.value as any)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1">
            <option>Degen</option><option>Balanced</option><option>Safe</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Vibe</label>
          <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="Whale Watching" className="mt-1" />
        </div>
        <label className="flex items-center gap-2 text-sm text-white sm:col-span-2">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} /> VIP-only terminal
        </label>
      </div>
      <Button onClick={onSpawn} disabled={loading} className="mt-4 w-full" style={{ background: "#39ff14", color: "#000" }}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Calibrating signals…</> : <><Rocket className="h-4 w-4 mr-2" />Spawn Terminal</>}
      </Button>
      {last && url && (
        <div className="mt-4 rounded-lg border border-[#39ff14]/40 bg-black/40 p-3 text-xs flex items-center justify-between gap-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-[#39ff14] hover:underline truncate">{url}</a>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
            <Copy className="h-3 w-3 mr-1" /> Copy
          </Button>
        </div>
      )}
    </section>
  );
}

function ToolSpawnerPanel() {
  const spawn = useServerFn(spawnTool);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<"kids" | "students" | "pro">("students");
  const [logic, setLogic] = useState("");
  const [vibe, setVibe] = useState("");
  const [vip, setVip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<{ slug: string } | null>(null);

  const onSpawn = async () => {
    if (!name || !logic) return toast.error("Name and logic required");
    setLoading(true);
    try {
      const r = await spawn({ data: { name, audience, logic, vibe, vip } });
      toast.success(`Spawned "${r.tool.name}"`);
      setLast({ slug: r.slug });
      setName(""); setLogic(""); setVibe("");
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally { setLoading(false); }
  };

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-2">
        <Wrench className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">ToolHUB Spawner</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">AI agent designs the inputs, formula, and explanations from your description.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Tool Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kid Algebra Solver" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as any)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="kids">Kids</option>
            <option value="students">Students</option>
            <option value="pro">Professionals / Scientists</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Tool Logic Description</label>
          <Input value={logic} onChange={(e) => setLogic(e.target.value)} placeholder="Step-by-step algebra solver for two-variable equations" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Visual Vibe</label>
          <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="Playful & Colorful, neon blue cartoon" />
        </div>
        <label className="flex items-center gap-2 text-sm text-white sm:col-span-2">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} />
          VIP-only tool (Syndicate members)
        </label>
      </div>
      <Button onClick={onSpawn} disabled={loading} className="mt-4 w-full">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Agent designing...</> : <><Wand2 className="h-4 w-4 mr-2" />Spawn Tool</>}
      </Button>
      {last && (
        <p className="mt-3 text-sm text-muted-foreground">
          Live at{" "}
          <a href={`/t/${last.slug}`} target="_blank" rel="noopener noreferrer" className="underline text-white inline-flex items-center gap-1">
            /t/{last.slug} <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
    </section>
  );
}

function SpawnerPanel() {
  const spawn = useServerFn(spawnPortal);
  const genBrand = useServerFn(generateBrandBible);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState("English");
  const [vibe, setVibe] = useState("");
  const [vip, setVip] = useState(false);
  const [useScout, setUseScout] = useState(true);
  const [initTelegram, setInitTelegram] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ slug: string; name: string; theme: string; vip?: boolean } | null>(null);

  const run = async () => {
    if (!name.trim() || !niche.trim()) {
      toast.error("Name and niche required");
      return;
    }
    setLoading(true);
    setCreated(null);
    try {
      const r = await spawn({ data: { name: name.trim(), niche: niche.trim(), language: language.trim() || "English", vibe: vibe.trim(), vip, useScout } });
      setCreated(r.portal);
      toast.success(`Spawned "${r.portal.name}" with ${r.jokeCount} jokes`);
      if (initTelegram) {
        try {
          toast.message("Generating Telegram Brand Bible…");
          await genBrand({ data: { slug: r.portal.slug } });
          toast.success("Brand Bible generated · scroll to Telegram Socials");
        } catch (e: any) {
          toast.error(`Brand Bible failed: ${e?.message ?? "unknown"}`);
        }
      }
      setName(""); setNiche(""); setVibe("");
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally {
      setLoading(false);
    }
  };

  const url = created ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${created.slug}` : "";

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5">
        <Wand2 className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Portal Spawner</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Niche generator</span>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chinese Smelly Jokes" className="mt-1 h-11 bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Language</label>
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Chinese / English / Spanish..." className="mt-1 h-11 bg-background" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Niche / Theme Description</label>
          <textarea
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Traditional Chinese style, focus on smelly humor"
            rows={2}
            className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Mascot / Image Vibe</label>
          <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="Ancient Chinese architecture and characters" className="mt-1 h-11 bg-background" />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={useScout} onChange={(e) => setUseScout(e.target.checked)} className="h-4 w-4" />
            Firecrawl Scout (latest news)
          </label>
          <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="h-4 w-4" />
            VIP Portal (5 🪙 unlock)
          </label>
          <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] cursor-pointer" style={{ color: "var(--neon-blue-bright)" }}>
            <input type="checkbox" checked={initTelegram} onChange={(e) => setInitTelegram(e.target.checked)} className="h-4 w-4" />
            <Send className="h-3.5 w-3.5" /> Initialize Telegram Socials
          </label>
        </div>
      </div>
      <Button
        onClick={run}
        disabled={loading}
        className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold h-12 px-8 mt-5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Spawning...</> : <><Wand2 className="h-4 w-4 mr-2" />Generate Portal</>}
      </Button>

      {created && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-background/60">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Live Portal</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code className="text-sm text-white font-mono">/p/{created.slug}</code>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border">{created.theme}</span>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(url); toast.success("URL copied"); }}>
              <Copy className="h-3.5 w-3.5 mr-1" />Copy
            </Button>
            <a href={`/p/${created.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs underline">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />Open
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

type TGPortal = {
  id: string;
  slug: string;
  name: string;
  niche: string;
  telegram_config: {
    enabled?: boolean;
    deployed?: boolean;
    botUsername?: string | null;
    groupLink?: string | null;
    vipLink?: string | null;
    brand?: {
      brandName?: string;
      voice?: string;
      bio?: string;
      shortBio?: string;
      logoEmoji?: string;
      marketingPlan?: string;
      starterMessages?: string[];
    };
  } | null;
};

function TelegramSocialsPanel() {
  const genBrand = useServerFn(generateBrandBible);
  const updateLinks = useServerFn(updateTelegramLinks);
  const deploy = useServerFn(deployToTelegram);
  const [portals, setPortals] = useState<TGPortal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase
      .from("portals")
      .select("id, slug, name, niche, telegram_config")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setPortals((data as any[]) ?? []));
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6 sm:p-8" style={{ borderColor: "oklch(0.72 0.22 245 / 0.5)", boxShadow: "0 0 60px oklch(0.72 0.22 245 / 0.15)" }}>
      <header className="flex items-center gap-3 mb-5">
        <Send className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Telegram Socials</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Brand Bible · Deploy · Links</span>
      </header>

      {portals.length === 0 && (
        <p className="text-sm text-muted-foreground">No portals yet. Spawn one above.</p>
      )}

      <div className="space-y-4">
        {portals.map((p) => {
          const cfg = p.telegram_config ?? {};
          const brand = cfg.brand;
          const id = p.id;
          return (
            <div key={id} className="rounded-xl border border-border bg-background/60 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">{brand?.logoEmoji ?? "🛰"}</span>
                <h3 className="font-bold text-white">{brand?.brandName || p.name}</h3>
                <code className="text-[10px] text-muted-foreground">/p/{p.slug}</code>
                {cfg.deployed && (
                  <span className="text-[9px] uppercase tracking-[0.3em] px-2 py-0.5 rounded-full" style={{ color: "var(--neon-blue-bright)", border: "1px solid currentColor" }}>
                    Deployed
                  </span>
                )}
              </div>

              {brand ? (
                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Voice</p>
                    <p className="text-foreground/90 mt-1">{brand.voice}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Bio</p>
                    <p className="text-foreground/90 mt-1">{brand.bio}</p>
                  </div>
                  {brand.marketingPlan && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Marketing Plan</p>
                      <pre className="text-foreground/80 whitespace-pre-wrap mt-1 text-[11px]">{brand.marketingPlan}</pre>
                    </div>
                  )}
                  {brand.starterMessages && brand.starterMessages.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Starter Messages</p>
                      <ul className="space-y-1">
                        {brand.starterMessages.slice(0, 5).map((m, i) => (
                          <li key={i} className="rounded bg-black/40 border border-border px-2 py-1.5 flex items-start justify-between gap-2">
                            <span className="flex-1">{m}</span>
                            <button onClick={() => { navigator.clipboard?.writeText(m); toast.success("Copied"); }} className="opacity-60 hover:opacity-100">
                              <Copy className="h-3 w-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No brand bible yet.</p>
              )}

              <LinksEditor
                slug={p.slug}
                initial={{ groupLink: cfg.groupLink ?? "", vipLink: cfg.vipLink ?? "", botUsername: cfg.botUsername ?? "" }}
                onSave={async (vals) => {
                  setBusy(id);
                  try { await updateLinks({ data: { slug: p.slug, ...vals } }); toast.success("Links saved"); reload(); }
                  catch (e: any) { toast.error(e?.message ?? "Save failed"); }
                  finally { setBusy(null); }
                }}
                disabled={busy === id}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === id}
                  onClick={async () => {
                    setBusy(id);
                    try { await genBrand({ data: { slug: p.slug } }); toast.success("Brand bible generated"); reload(); }
                    catch (e: any) { toast.error(e?.message ?? "Failed"); }
                    finally { setBusy(null); }
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  {brand ? "Regenerate Bible" : "Generate Brand Bible"}
                </Button>
                <Button
                  size="sm"
                  className="btn-glass-blue text-white"
                  disabled={busy === id || !brand}
                  onClick={async () => {
                    setBusy(id);
                    try {
                      const r = await deploy({ data: { slug: p.slug } });
                      toast.success(`Deployed to @${r.botUsername ?? "bot"}`);
                      reload();
                    } catch (e: any) { toast.error(e?.message ?? "Deploy failed"); }
                    finally { setBusy(null); }
                  }}
                >
                  <Rocket className="h-3.5 w-3.5 mr-1" />
                  Deploy to Telegram
                </Button>
                {cfg.botUsername && (
                  <a href={`https://t.me/${cfg.botUsername}`} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center">
                    <ExternalLink className="h-3 w-3 mr-1" />@{cfg.botUsername}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LinksEditor({ slug: _slug, initial, onSave, disabled }: { slug: string; initial: { groupLink: string; vipLink: string; botUsername: string }; onSave: (v: { groupLink: string; vipLink: string; botUsername: string }) => Promise<void>; disabled?: boolean }) {
  const [g, setG] = useState(initial.groupLink);
  const [v, setV] = useState(initial.vipLink);
  const [b, setB] = useState(initial.botUsername);
  return (
    <div className="mt-3 grid sm:grid-cols-3 gap-2">
      <Input value={g} onChange={(e) => setG(e.target.value)} placeholder="https://t.me/joinchat/…" className="h-9 bg-background text-xs" />
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://t.me/+vip…" className="h-9 bg-background text-xs" />
      <div className="flex gap-2">
        <Input value={b} onChange={(e) => setB(e.target.value)} placeholder="bot username" className="h-9 bg-background text-xs flex-1" />
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onSave({ groupLink: g, vipLink: v, botUsername: b })}>
          <Save className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TrackUploadPanel() {
  const create = useServerFn(createTrack);
  const [portals, setPortals] = useState<{ slug: string; name: string }[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("200");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; title: string; suno_prompt: string } | null>(null);

  useEffect(() => {
    supabase.from("portals").select("slug, name").eq("kind", "music").order("created_at", { ascending: false })
      .then(({ data }) => setPortals((data as any[]) ?? []));
  }, []);

  const upload = async () => {
    if (!slug || !title.trim() || !previewFile || !fullFile) {
      toast.error("Pick a portal, title, and both audio files");
      return;
    }
    setBusy(true);
    setCreated(null);
    try {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewPath = `${slug}/${stamp}/preview.mp3`;
      const fullPath = `${slug}/${stamp}/full.mp3`;
      const u1 = await supabase.storage.from("tracks").upload(previewPath, previewFile, { contentType: previewFile.type || "audio/mpeg", upsert: false });
      if (u1.error) throw new Error(`Preview upload: ${u1.error.message}`);
      const u2 = await supabase.storage.from("tracks").upload(fullPath, fullFile, { contentType: fullFile.type || "audio/mpeg", upsert: false });
      if (u2.error) throw new Error(`Full upload: ${u2.error.message}`);

      const r = await create({ data: {
        portal_slug: slug, title: title.trim(),
        preview_path: previewPath, full_path: fullPath,
        price_cents: Math.max(50, parseInt(price, 10) || 200),
      } });
      setCreated(r.track);
      toast.success("Track published");
      setTitle(""); setPreviewFile(null); setFullFile(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5">
        <Disc3 className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Track Vault</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Preview &amp; sell</span>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Music Portal</label>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 h-11 w-full bg-background border border-border rounded-md px-2 text-sm">
            <option value="">— select —</option>
            {portals.map((p) => <option key={p.slug} value={p.slug}>{p.name} (/m/{p.slug})</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Track Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midnight Nasheed" className="mt-1 h-11 bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Price (cents)</label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 h-11 bg-background" />
        </div>
        <div />
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Preview MP3 (≈30s)</label>
          <Input type="file" accept="audio/*" onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)} className="mt-1 h-11 bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Full HQ MP3</label>
          <Input type="file" accept="audio/*" onChange={(e) => setFullFile(e.target.files?.[0] ?? null)} className="mt-1 h-11 bg-background text-xs" />
        </div>
      </div>
      <Button onClick={upload} disabled={busy} className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold h-12 px-8 mt-5">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Publish Track</>}
      </Button>

      {created && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-background/60">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Suno V5 Style Prompt</p>
          <pre className="text-xs whitespace-pre-wrap bg-black/40 border border-border rounded-md p-3 mt-2 max-h-64 overflow-auto">{created.suno_prompt}</pre>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => { navigator.clipboard?.writeText(created.suno_prompt); toast.success("Prompt copied"); }}>
            <Copy className="h-3.5 w-3.5 mr-1" />Copy for Suno
          </Button>
        </div>
      )}
    </section>
  );
}

function MusicSpawnerPanel() {
  const spawn = useServerFn(spawnMusicPortal);
  const [slug, setSlug] = useState("");
  const [language, setLanguage] = useState("English");
  const [style, setStyle] = useState("");
  const [vibe, setVibe] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ slug: string; name: string; theme: string } | null>(null);

  const run = async () => {
    if (!slug.trim() || !style.trim()) {
      toast.error("Slug and style required");
      return;
    }
    setLoading(true);
    setCreated(null);
    try {
      const r = await spawn({ data: { slug: slug.trim(), language: language.trim() || "English", style: style.trim(), vibe: vibe.trim() } });
      setCreated(r.portal);
      toast.success(`Music portal "${r.portal.name}" spawned`);
      setSlug(""); setStyle(""); setVibe("");
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally {
      setLoading(false);
    }
  };

  const url = created ? `${typeof window !== "undefined" ? window.location.origin : ""}/m/${created.slug}` : "";

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5">
        <Music className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Music Portal Spawner</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">0G-Studio factory</span>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Slug</label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="urdu-nasheeds" className="mt-1 h-11 bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Language</label>
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Urdu / English / Spanish" className="mt-1 h-11 bg-background" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Style / Genre</label>
          <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Nasheed / Spiritual" className="mt-1 h-11 bg-background" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Background Vibe</label>
          <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="Blue Mosque at night, neon blue accents" className="mt-1 h-11 bg-background" />
        </div>
      </div>
      <Button
        onClick={run}
        disabled={loading}
        className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold h-12 px-8 mt-5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Spawning...</> : <><Music className="h-4 w-4 mr-2" />Spawn Music Portal</>}
      </Button>

      {created && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-background/60">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Live Music Portal</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code className="text-sm text-white font-mono">/m/{created.slug}</code>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border">{created.theme}</span>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(url); toast.success("URL copied"); }}>
              <Copy className="h-3.5 w-3.5 mr-1" />Copy
            </Button>
            <a href={`/m/${created.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs underline">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />Open
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function RoleRow({ row, busy, onSave }: { row: Row; busy: boolean; onSave: (p: Partial<Row>) => void }) {
  const [credits, setCredits] = useState(String(row.credits));
  const [status, setStatus] = useState<"free" | "vip">(row.status);
  const rankTint: Record<string, string> = {
    prospect: "border-zinc-500/40 text-zinc-300",
    enforcer: "border-amber-400/50 text-amber-200",
    vip: "border-fuchsia-400/50 text-fuchsia-200",
    boss: "border-rose-500/50 text-rose-200",
  };
  const rankKey = row.rank ?? "prospect";
  return (
    <div className="grid grid-cols-12 gap-2 px-5 py-4 items-center border-b border-border last:border-b-0">
      <div className="col-span-4 text-sm truncate">{row.email}</div>
      <div className="col-span-2">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${rankTint[rankKey] ?? rankTint.prospect}`}>
          {rankKey}
        </span>
      </div>
      <div className="col-span-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "free" | "vip")}
          className="bg-background border border-border rounded-md px-2 py-1.5 text-sm w-full"
        >
          <option value="free">Free</option>
          <option value="vip">VIP</option>
        </select>
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          min={0}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="col-span-2 text-right">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onSave({ credits: parseInt(credits, 10) || 0, status })}
          className="btn-glass-blue text-white text-xs uppercase tracking-widest"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" />Save</>}
        </Button>
      </div>
    </div>
  );
}

function LeadTrackingPanel() {
  const [rows, setRows] = useState<{ slug: string; name: string; niche: string; view_count: number; vip: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{ slug: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletePortalFn = useServerFn(bossDeletePortal);

  const reload = () => {
    setLoading(true);
    supabase
      .from("portals")
      .select("slug, name, niche, view_count, vip, created_at")
      .order("view_count", { ascending: false })
      .limit(50)
      .then(({ data }) => { setRows((data as any[]) ?? []); setLoading(false); });
  };

  useEffect(() => { reload(); }, []);

  const total = rows.reduce((s, r) => s + (r.view_count || 0), 0);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deletePortalFn({ data: { slug: pendingDelete.slug } });
      toast.success(`Deleted "${pendingDelete.name}"`);
      setRows((rs) => rs.filter((r) => r.slug !== pendingDelete.slug));
      setPendingDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5 flex-wrap">
        <TrendingUp className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Lead Tracking</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Visits · Hot Leads</span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-foreground/80">
          Total Opens: <span className="text-white font-bold">{total}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={reload} className="text-[10px]">Refresh</Button>
      </header>
      {loading ? (
        <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No portals yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border bg-background/40">
            <div className="col-span-5">Portal</div>
            <div className="col-span-3">Niche</div>
            <div className="col-span-2 text-right">Opens</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {rows.map((r) => {
            const url = typeof window !== "undefined" ? `${window.location.origin}/p/${r.slug}` : `/p/${r.slug}`;
            const heat = r.view_count >= 50 ? "text-red-400" : r.view_count >= 10 ? "text-yellow-400" : "text-foreground/70";
            return (
              <div key={r.slug} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs items-center border-b border-border last:border-0 hover:bg-background/40">
                <div className="col-span-5 truncate">
                  <span className="text-white font-bold">{r.name}</span>
                  {r.vip && <span className="ml-2 text-[9px] uppercase tracking-[0.3em] px-1.5 py-0.5 rounded border" style={{ color: "var(--neon-blue-bright)", borderColor: "currentColor" }}>VIP</span>}
                  <div className="text-[10px] text-muted-foreground font-mono">/p/{r.slug}</div>
                </div>
                <div className="col-span-3 truncate text-muted-foreground">{r.niche}</div>
                <div className={`col-span-2 text-right font-mono font-bold ${heat}`}>
                  <Eye className="inline h-3 w-3 mr-1" />{r.view_count}
                </div>
                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => { navigator.clipboard?.writeText(url); toast.success("Client link copied"); }}
                    className="opacity-60 hover:opacity-100"
                    title="Copy client link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPendingDelete({ slug: r.slug, name: r.name })}
                    className="opacity-70 hover:opacity-100 text-red-400 hover:text-red-300"
                    title="Delete portal"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete portal?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-bold text-white">{pendingDelete?.name}</span>
              {pendingDelete ? <> (<span className="font-mono">/p/{pendingDelete.slug}</span>)</> : null}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ScoutPanel() {
  const scout = useServerFn(scoutUrl);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof scoutUrl>> | null>(null);

  const run = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await scout({ data: { url: url.trim() } });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Scout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5">
        <Telescope className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Scout</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Firecrawl recon</span>
      </header>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://news.site/article..."
            className="pl-9 h-11 bg-background"
          />
        </div>
        <Button
          onClick={run}
          disabled={loading || !url.trim()}
          className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold h-11 px-6"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan Target"}
        </Button>
      </div>
      {result && (
        <div className="mt-6 space-y-4">
          {result.title && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Page Title</p>
              <p className="text-sm text-white mt-1">{result.title}</p>
            </div>
          )}
          {result.summary && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Summary</p>
              <p className="text-sm text-foreground mt-1 leading-relaxed">{result.summary}</p>
            </div>
          )}
          {result.titles.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                Themes / Headings ({result.titles.length})
              </p>
              <ul className="flex flex-wrap gap-2">
                {result.titles.map((t, i) => (
                  <li
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-secondary/60 border border-border text-foreground"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ════════════ FLEET COMMANDER ════════════
type Bot = {
  id: string; pair_name: string; pair_label: string; channel_chat_id: string;
  tier_required: Plan; update_frequency: string; bias: string; active: boolean;
  last_pinged_at: string | null; ping_count: number; last_broadcast: string | null;
};
type FleetStats = {
  bots: any[];
  planCounts: Record<string, number>;
  activeMembers: number;
  churned: number;
  churnRate: number;
  recentProfiles: { id: string; email: string; subscription_plan: Plan }[];
};

function FleetCommanderPanel() {
  const list = useServerFn(listBots);
  const upsert = useServerFn(upsertBot);
  const remove = useServerFn(deleteBot);
  const tickNow = useServerFn(runSyndicateTickNow);
  const broadcast = useServerFn(broadcastGlobalAlert);
  const stats = useServerFn(getFleetStats);
  const setPlan = useServerFn(setSubscriberPlan);

  const [bots, setBots] = useState<Bot[]>([]);
  const [s, setS] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [pair, setPair] = useState("Gold");
  const [label, setLabel] = useState("0G · Gold Desk");
  const [chatId, setChatId] = useState("@og_gold_desk");
  const [tier, setTier] = useState<Plan>("stream_user");
  const [freq, setFreq] = useState("15min");
  const [bias, setBias] = useState("neutral");
  const [msg, setMsg] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [a, b] = await Promise.allSettled([list(), stats()]);
    if (a.status === "fulfilled") setBots(((a.value as any).bots as Bot[]) || []);
    else toast.error(typeof a.reason?.message === "string" ? a.reason.message : "Bots load failed");
    if (b.status === "fulfilled") setS(b.value as FleetStats);
    else toast.error(typeof b.reason?.message === "string" ? b.reason.message : "Stats load failed");
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const onAdd = async () => {
    if (!pair.trim() || !chatId.trim()) return toast.error("Pair name and channel ID required");
    setBusyAction("add");
    try {
      await upsert({ data: { pair_name: pair, pair_label: label || pair, channel_chat_id: chatId, tier_required: tier, update_frequency: freq, bias, active: true } });
      toast.success(`Bot for ${pair} registered`);
      setPair(""); setLabel(""); setChatId("");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Add failed"); }
    finally { setBusyAction(null); }
  };

  const onToggle = async (b: Bot) => {
    setBusyAction(b.id);
    try {
      await upsert({ data: { id: b.id, pair_name: b.pair_name, pair_label: b.pair_label, channel_chat_id: b.channel_chat_id, tier_required: b.tier_required, update_frequency: b.update_frequency, bias: b.bias, active: !b.active } });
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Toggle failed"); }
    finally { setBusyAction(null); }
  };

  const onRemove = async (b: Bot) => {
    if (!confirm(`Remove bot for ${b.pair_name}?`)) return;
    setBusyAction(b.id);
    try { await remove({ data: { id: b.id } }); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Delete failed"); }
    finally { setBusyAction(null); }
  };

  const onTick = async () => {
    setBusyAction("tick");
    try {
      const r = await tickNow();
      toast.success(`Tick: ${r.posted} posted · ${r.skipped} skipped` + (r.errors.length ? ` · ${r.errors.length} errors` : ""));
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Tick failed"); }
    finally { setBusyAction(null); }
  };

  const onBroadcast = async () => {
    if (!msg.trim()) return toast.error("Message required");
    setBusyAction("broadcast");
    try {
      const r = await broadcast({ data: { message: msg.trim() } });
      toast.success(`Broadcast: ${r.ok}/${r.total} channels reached`);
      setMsg("");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Broadcast failed"); }
    finally { setBusyAction(null); }
  };

  const onPlanChange = async (userId: string, newPlan: Plan) => {
    try { await setPlan({ data: { user_id: userId, plan: newPlan } }); toast.success("Plan updated"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Update failed"); }
  };

  const cyan = "#00e0ff";
  return (
    <section className="mt-10 rounded-2xl border bg-card p-6" style={{ borderColor: `${cyan}55` }}>
      <div className="flex items-center gap-2 mb-1">
        <Bot className="h-5 w-5" style={{ color: cyan }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Fleet Commander · Syndicate</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Multi-Channel Telegram</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Master bot fans out a 15-min Perplexity scout to every active pair channel. Boss can broadcast a global alert that
        relays into each pair's channel with its own context.
      </p>

      {/* Stats */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="rounded-lg border border-border bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Active members</div>
            <div className="text-2xl font-black text-white mt-1">{s.activeMembers}</div>
          </div>
          <div className="rounded-lg border border-border bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Churn rate</div>
            <div className="text-2xl font-black text-white mt-1">{s.churnRate}%</div>
          </div>
          <div className="rounded-lg border border-border bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Active bots</div>
            <div className="text-2xl font-black text-white mt-1">{(s.bots ?? []).filter((b: any) => b.active).length}</div>
          </div>
          <div className="rounded-lg border border-border bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Plans</div>
            <div className="text-xs text-white mt-1 leading-relaxed">
          M: <b>{s.planCounts?.metal || 0}</b> · E: <b>{s.planCounts?.energy || 0}</b> · S: <b>{s.planCounts?.syndicate || 0}</b>
            </div>
          </div>
        </div>
      )}

      {/* Add bot */}
      <div className="rounded-xl border border-border bg-black/30 p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="h-4 w-4" style={{ color: cyan }} />
          <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Register Pair Channel</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input value={pair} onChange={(e) => setPair(e.target.value)} placeholder="Pair (Gold)" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (0G · Gold Desk)" />
          <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Channel @username or -100…" />
          <select value={tier} onChange={(e) => setTier(e.target.value as Plan)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="free">Tier · Free</option>
            <option value="stream_user">Tier · Stream User</option>
            <option value="vip">Tier · VIP</option>
            <option value="real_og">Tier · Real OG</option>
          </select>
          <select value={freq} onChange={(e) => setFreq(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="5min">Every 5 min (high freq)</option>
            <option value="15min">Every 15 min (default)</option>
            <option value="hourly">Hourly</option>
            <option value="volatility">Volatility-only (stub)</option>
          </select>
          <select value={bias} onChange={(e) => setBias(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="neutral">Neutral feed</option>
            <option value="good">Bullish slant</option>
            <option value="bad">Bearish slant</option>
          </select>
        </div>
        <Button onClick={onAdd} disabled={busyAction === "add"} className="mt-3 w-full" style={{ background: cyan, color: "#000" }}>
          {busyAction === "add" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registering…</> : <><Bot className="h-4 w-4 mr-2" />Register Bot</>}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-2">
          Master bot must be added as <b>admin</b> in the channel with "Post messages" permission. Use <code>@channel_username</code> for public channels or numeric <code>-100…</code> for private.
        </p>
      </div>

      {/* Bot list */}
      <div className="rounded-xl border border-border overflow-hidden mb-5">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border bg-black/40">
          <div className="col-span-3">Pair</div>
          <div className="col-span-3">Channel</div>
          <div className="col-span-2">Tier · Freq</div>
          <div className="col-span-2">Last ping</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {loading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!loading && bots.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No pair bots yet.</div>}
        {bots.map((b) => (
          <div key={b.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/50 text-sm items-center">
            <div className="col-span-3">
              <div className="font-bold text-white">{b.pair_label}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{b.pair_name} · {b.bias}</div>
            </div>
            <div className="col-span-3 font-mono text-xs text-white truncate">{b.channel_chat_id}</div>
            <div className="col-span-2 text-xs text-white"><span className="uppercase">{({metal:"Stream User", energy:"VIP", syndicate:"Real OG", stream_user:"Stream User", vip:"VIP", real_og:"Real OG", free:"Free"} as Record<string,string>)[b.tier_required] ?? b.tier_required}</span> · {b.update_frequency}</div>
            <div className="col-span-2 text-[11px] text-muted-foreground">
              {b.last_pinged_at ? new Date(b.last_pinged_at).toLocaleString() : "never"} <br />
              <span className="opacity-70">{b.ping_count} pings</span>
            </div>
            <div className="col-span-2 flex justify-end gap-1">
              <Button size="sm" variant="outline" onClick={() => onToggle(b)} disabled={busyAction === b.id}
                className="h-7 text-[10px]" style={{ borderColor: b.active ? `${cyan}88` : "#666", color: b.active ? cyan : "#aaa" }}>
                {b.active ? "ON" : "OFF"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRemove(b)} disabled={busyAction === b.id} className="h-7 text-[10px] text-red-400 hover:text-red-300">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Tick + Broadcast */}
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <Button onClick={onTick} disabled={busyAction === "tick"} variant="outline" style={{ borderColor: `${cyan}88`, color: cyan }}>
          {busyAction === "tick" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Ticking…</> : <><Radio className="h-4 w-4 mr-2" />Run Tick Now</>}
        </Button>
        <Button onClick={refresh} variant="ghost"><Eye className="h-4 w-4 mr-2" />Refresh stats</Button>
      </div>

      <div className="rounded-xl border border-border bg-black/30 p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-4 w-4" style={{ color: cyan }} />
          <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Boss · Global Alert</h3>
        </div>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          placeholder="🚨 Hormuz update: Iran navy intercepted tanker. All desks brace for spike across oil + gold." />
        <Button onClick={onBroadcast} disabled={busyAction === "broadcast"} className="mt-3 w-full" style={{ background: cyan, color: "#000" }}>
          {busyAction === "broadcast" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Broadcasting…</> : <><Megaphone className="h-4 w-4 mr-2" />Relay to All Pair Bots</>}
        </Button>
      </div>

      {/* Subscriber Management */}
      {s && (s.recentProfiles ?? []).length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border bg-black/40 flex items-center gap-2">
            <Users className="h-3 w-3" /> Subscriber Management · Recent 50
          </div>
          {(s.recentProfiles ?? []).map((p) => (
            <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border/50 text-sm items-center">
              <div className="col-span-7 truncate text-white">{p.email}</div>
              <div className="col-span-5 flex justify-end gap-1">
                {(["free","stream_user","vip","real_og"] as const).map((pl) => {
                  const legacyMap: Record<string,string> = { free:"free", stream_user:"metal", vip:"energy", real_og:"syndicate" };
                  const isActive = p.subscription_plan === pl || p.subscription_plan === legacyMap[pl];
                  const label = pl === "free" ? "Free" : pl === "stream_user" ? "Stream" : pl === "vip" ? "VIP" : "Real OG";
                  return (
                    <Button key={pl} size="sm" variant={isActive ? "default" : "outline"}
                      onClick={() => onPlanChange(p.id, pl as Plan)}
                      className="h-7 text-[10px] uppercase"
                      style={isActive ? { background: cyan, color: "#000" } : { borderColor: "#444", color: "#aaa" }}>
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}