import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Brain, Cpu, Loader2, Copy, Crown, KeyRound, Skull,
  ShieldCheck, MemoryStick, MessageSquare, Sparkles, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { runAgentTask } from "@/lib/command-deck.functions";
import { GlobalMoodPanel } from "@/components/boss/GlobalMoodPanel";

export const Route = createFileRoute("/boss/ai-agent")({
  head: () => ({
    meta: [
      { title: "0G Bot · AI Agent Settings · Boss Portal" },
      { name: "description", content: "Single control surface for every 0G Bot setting — persona, model, memory, civility, lexicon, agent keys." },
    ],
  }),
  component: BossAiAgentPage,
});

const HOT_PINK = "#ff00aa";

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

type SettingTile = {
  to: string;
  hash?: string;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
};

const SETTING_TILES: SettingTile[] = [
  { to: "/boss/infrastructure", hash: "og-bot-memory", label: "Bot Memory", blurb: "Persistent facts the 0G Bot remembers between sessions.", Icon: MemoryStick, tint: "#a78bfa" },
  { to: "/boss/content",        hash: "civility",      label: "Civility & Tone", blurb: "Per-portal swear-chat toggle and global default tone.", Icon: ShieldCheck, tint: "#3ad6ff" },
  { to: "/boss/content",        hash: "lexicon",       label: "Swear Lexicon", blurb: "HEAVY/MID/SOFT lists, refusals, openers, fillers.", Icon: Skull, tint: "#ff5577" },
  { to: "/boss/infrastructure", hash: "agent-keys",    label: "Agent Keys", blurb: "Encrypted vault for OpenAI/Gemini/Lovable AI keys.", Icon: KeyRound, tint: "#ffd166" },
  { to: "/console",            label: "Live Telemetry", blurb: "Realtime ai_logs feed + hub controls overview.", Icon: Sparkles, tint: "#00e08a" },
];

function BossAiAgentPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const isBoss = profile?.rank === "boss" || isAdmin;

  useEffect(() => {
    if (loading) return;
    if (!user || !isBoss) navigate({ to: "/" });
  }, [loading, user, isBoss, navigate]);

  if (loading || !isBoss) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-6 pb-28 md:pb-12 space-y-6">
      <Link to="/boss" className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Boss portal
      </Link>

      <header className="flex items-start gap-3">
        <Crown className="h-7 w-7 mt-1" style={{ color: HOT_PINK }} />
        <div className="min-w-0">
          <h1 className="syndicate-header text-2xl md:text-3xl text-white/95">0G Bot · AI Agent Settings</h1>
          <p className="text-sm text-white/55 mt-1">
            Every 0G Bot lever in one place — persona, model, memory, civility, lexicon, keys. Boss only.
          </p>
        </div>
      </header>

      <AgentRunnerPanel />

      <section>
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/50 mb-3">Bot settings</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SETTING_TILES.map((t) => (
            <Link
              key={t.to + (t.hash ? "#" + t.hash : "")}
              to={t.to}
              hash={t.hash}
              className="group rounded-2xl border bg-card/60 p-4 transition hover:-translate-y-0.5 hover:bg-card/80"
              style={{ borderColor: `${t.tint}55` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${t.tint}1f`, border: `1px solid ${t.tint}55` }}
                >
                  <t.Icon className="h-4 w-4" style={{ color: t.tint }} />
                </div>
                <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition" style={{ color: t.tint }} />
              </div>
              <h3 className="mt-3 syndicate-header text-sm text-white/95">{t.label}</h3>
              <p className="mt-1 text-[11px] text-white/60 leading-relaxed">{t.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5" style={{ borderColor: `${HOT_PINK}33` }}>
        <GlobalMoodPanel />
      </section>
    </main>
  );
}

function AgentRunnerPanel() {
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