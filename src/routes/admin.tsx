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
import { useServerFn } from "@tanstack/react-start";
import { scoutUrl } from "@/lib/firecrawl.functions";
import { spawnPortal } from "@/lib/portals.functions";
import { spawnMusicPortal } from "@/lib/music-portals.functions";
import { createTrack } from "@/lib/tracks.functions";
import { spawnTool } from "@/lib/tools.functions";
import { spawnTradePortal } from "@/lib/trade.functions";
import { spawnNewsPortal } from "@/lib/news.functions";
import { generatePortalCinema } from "@/lib/cinema.functions";
import { listBots, upsertBot, deleteBot, broadcastGlobalAlert, runSyndicateTickNow, getFleetStats, setSubscriberPlan, type Plan } from "@/lib/syndicate.functions";
import { generateBrandBible, updateTelegramLinks, deployToTelegram } from "@/lib/telegram.functions";
import { runAgentTask, getOpsSnapshot, runMaintenance } from "@/lib/command-deck.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Power Console · 0G-PORTAL" }] }),
  component: AdminPage,
});

type Row = { id: string; email: string; status: "free" | "vip"; credits: number; rank?: "boss" | "enforcer" | "prospect" | "vip" };

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id,email,status,credits,rank")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows(((data as Row[]) ?? []).filter((r) => r.rank !== "boss"));
      });
  }, [isAdmin]);

  const update = async (id: string, patch: Partial<Row>) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    toast.success("Vault updated");
  };

  if (loading || !isAdmin) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          <Shield className="inline h-3.5 w-3.5 mr-2" />Power Console
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">One-Hit Command Deck</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tap a tile to fire. Sections grouped by mission type.</p>
      </header>

      <SectionHeader icon={<Users className="h-4 w-4" />} label="Roster" tint="#3ad6ff" />
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border">
          <div className="col-span-5">Email</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2">Credits</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        {rows.map((r) => (
          <RoleRow key={r.id} row={r} busy={busy === r.id} onSave={(p) => update(r.id, p)} />
        ))}
        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No members yet.</p>
        )}
      </div>

      <SectionHeader icon={<Radar className="h-4 w-4" />} label="Intel · Recon" tint="#ff2233" />
      <div className="space-y-6">
        <ScoutPanel />
        <LeadTrackingPanel />
        <SignalCommandPanel />
        <NewsScoutSpawnerPanel />
      </div>

      <SectionHeader icon={<Zap className="h-4 w-4" />} label="Spawners · Build" tint="#ffd166" />
      <div className="space-y-6">
        <SpawnerPanel />
        <MusicSpawnerPanel />
        <TrackUploadPanel />
        <ToolSpawnerPanel />
        <TradeSpawnerPanel />
      </div>

      <SectionHeader icon={<MegaIcon className="h-4 w-4" />} label="Broadcast · Reach" tint="#00e08a" />
      <div className="space-y-6">
        <TelegramSocialsPanel />
        <FleetCommanderPanel />
        <ConnectHubLinkPanel />
      </div>

      <SectionHeader icon={<Sliders className="h-4 w-4" />} label="Hub Controls · Tuning" tint="#a78bfa" />
      <HubControlsPanel />

      <SectionHeader icon={<Terminal className="h-4 w-4" />} label="Command Deck · Superuser" tint="#ff00aa" />
      <div className="space-y-6">
        <OpsSnapshotPanel />
        <AgentConsolePanel />
        <MaintenancePanel />
      </div>
    </main>
  );
}

function SectionHeader({ icon, label, tint }: { icon: React.ReactNode; label: string; tint: string }) {
  return (
    <div className="mt-12 mb-4 flex items-center gap-3">
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
          <a href={`/p/${last.slug}`} target="_blank" rel="noreferrer" className="font-mono hover:underline truncate"
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
  const [busy, setBusy] = useState(false);

  const save = async () => {
    let integrationsJson: any, tuningJson: any;
    try { integrationsJson = JSON.parse(integrations || "{}"); }
    catch { return toast.error("Integrations must be valid JSON"); }
    try { tuningJson = JSON.parse(tuning || "{}"); }
    catch { return toast.error("Tuning must be valid JSON"); }

    setBusy(true);
    const { error } = await supabase.from("hub_settings").update({
      enabled, style_prompt: style, model,
      integrations: integrationsJson, tuning: tuningJson,
    }).eq("id", hub.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${hub.display_name} updated`);
    onSaved({ enabled, style_prompt: style, model, integrations: integrationsJson, tuning: tuningJson });
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
          <a href={url} target="_blank" rel="noreferrer" className="font-mono hover:underline truncate" style={{ color: accent }}>{url}</a>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
            <Copy className="h-3 w-3 mr-1" /> Copy
          </Button>
        </div>
      )}
      {last && (
        <div className="mt-3 rounded-lg border bg-black/40 p-3 text-xs space-y-2" style={{ borderColor: `${accent}44` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="uppercase tracking-[0.3em] text-muted-foreground">0G-Cinema · Veo 3.1 Background</span>
            {cineUrl && <a href={cineUrl} target="_blank" rel="noreferrer" className="underline truncate" style={{ color: accent }}>preview .mp4</a>}
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
          <a href={url} target="_blank" rel="noreferrer" className="font-mono text-[#39ff14] hover:underline truncate">{url}</a>
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
          <a href={`/t/${last.slug}`} target="_blank" rel="noreferrer" className="underline text-white inline-flex items-center gap-1">
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
            VIP Portal ($5 unlock)
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
            <a href={`/p/${created.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs underline">
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
                  <a href={`https://t.me/${cfg.botUsername}`} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center">
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
            <a href={`/m/${created.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs underline">
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
  return (
    <div className="grid grid-cols-12 gap-2 px-5 py-4 items-center border-b border-border last:border-b-0">
      <div className="col-span-5 text-sm truncate">{row.email}</div>
      <div className="col-span-3">
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
            <div className="col-span-4">Niche</div>
            <div className="col-span-2 text-right">Opens</div>
            <div className="col-span-1 text-right">Link</div>
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
                <div className="col-span-4 truncate text-muted-foreground">{r.niche}</div>
                <div className={`col-span-2 text-right font-mono font-bold ${heat}`}>
                  <Eye className="inline h-3 w-3 mr-1" />{r.view_count}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => { navigator.clipboard?.writeText(url); toast.success("Client link copied"); }}
                    className="opacity-60 hover:opacity-100"
                    title="Copy client link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  const [tier, setTier] = useState<Plan>("metal");
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
            <option value="metal">Tier · Metal Plan</option>
            <option value="energy">Tier · Energy Plan</option>
            <option value="syndicate">Tier · Syndicate</option>
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
            <div className="col-span-2 text-xs text-white"><span className="uppercase">{b.tier_required}</span> · {b.update_frequency}</div>
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
                {(["free","metal","energy","syndicate"] as Plan[]).map((pl) => (
                  <Button key={pl} size="sm" variant={p.subscription_plan === pl ? "default" : "outline"}
                    onClick={() => onPlanChange(p.id, pl)}
                    className="h-7 text-[10px] uppercase"
                    style={p.subscription_plan === pl ? { background: cyan, color: "#000" } : { borderColor: "#444", color: "#aaa" }}>
                    {pl}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}