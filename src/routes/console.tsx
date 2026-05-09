import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Brain, Sliders, Cpu, Bot, Radio, Wand2, Telescope, Terminal,
  ArrowUpRight, Gauge,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalMood } from "@/hooks/use-global-mood";
import { SyndicateProtocolSwitch } from "@/components/SyndicateProtocolSwitch";
import { TVStaticLogo } from "@/components/TVStaticLogo";
import { SkeletonShimmer } from "@/components/SkeletonShimmer";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "0G-Console · AI Agents & Hub Controls" },
      { name: "description", content: "AI agents, model tuning, mood toggle, hub controls, fleet bots, syndicate orchestration." },
    ],
  }),
  component: ConsolePage,
});

type LogRow = {
  id: string; source: string; level: string; message: string; created_at: string;
};

type Tile = {
  to: string;
  hash?: string;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
};

const TILES: Tile[] = [
  { to: "/admin", hash: "hubs",      label: "Hub Controls",      blurb: "Per-hub model, prompt, integrations, on/off",   Icon: Sliders,   tint: "#a78bfa" },
  { to: "/admin", hash: "mood",      label: "Global Mood",       blurb: "Shape-Bridge OG vs Normal, sweary toggle",      Icon: Brain,     tint: "#ff5c8a" },
  { to: "/admin", hash: "spawners",  label: "AI Spawners",       blurb: "Spawn portals, music studios, trade terminals", Icon: Wand2,     tint: "#ffd166" },
  { to: "/admin", hash: "intel",     label: "Intel · Recon",     blurb: "Firecrawl scout, news mining, research",        Icon: Telescope, tint: "#ff2233" },
  { to: "/admin", hash: "broadcast", label: "Broadcast Engine",  blurb: "Telegram syndicate alerts, fleet broadcasts",   Icon: Radio,     tint: "#00e08a" },
  { to: "/admin", hash: "command",   label: "Command Deck",      blurb: "Agent tasks, ops snapshot, maintenance jobs",   Icon: Cpu,       tint: "#3ad6ff" },
  { to: "/fleet", label: "Fleet Bots",         blurb: "Telegram fleet — pairs, biases, frequencies",       Icon: Bot,       tint: "#7dff2e" },
  { to: "/syndicate-overlord", label: "Syndicate Overlord", blurb: "Per-user grants, VIP passes, deep tools", Icon: Gauge,  tint: "#ff7a1a" },
];

function ConsolePage() {
  const { mood } = useGlobalMood();
  const isOg = mood === "og";

  return (
    <>
      {isOg && <div aria-hidden className="og-vignette" />}

      <main className="relative z-[1] mx-auto w-full max-w-7xl px-4 pt-6 pb-28 md:pb-10 space-y-5">
        <ConsoleHeader isOg={isOg} />

        {/* Tile grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TILES.map((t) => (
            <Link
              key={t.label + (t.hash ?? "")}
              to={t.to}
              hash={t.hash}
              className="group glass-obsidian-cmd rounded-2xl p-4 transition-all hover:-translate-y-0.5"
              style={{ borderColor: `${t.tint}66` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${t.tint}1f`, border: `1px solid ${t.tint}55` }}
                >
                  <t.Icon className="h-4 w-4" style={{ color: t.tint }} />
                </div>
                <ArrowUpRight
                  className="h-4 w-4 opacity-50 group-hover:opacity-100 transition"
                  style={{ color: t.tint }}
                />
              </div>
              <h3 className="mt-3 syndicate-header text-sm text-white/95">{t.label}</h3>
              <p className="mt-1 text-[11px] text-white/60 leading-relaxed">{t.blurb}</p>
            </Link>
          ))}
        </section>

        {/* Enforcer Console — full width */}
        <section className="glass-obsidian-cmd rounded-3xl p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
                Enforcer Console
              </div>
              <div className="syndicate-header text-base md:text-lg text-white/95">Live Agent Telemetry</div>
            </div>
            <Terminal className="h-4 w-4 neon-icon" />
          </div>
          <EnforcerFeed />
        </section>
      </main>
    </>
  );
}

function ConsoleHeader({ isOg }: { isOg: boolean }) {
  return (
    <header className="glass-obsidian-cmd rounded-3xl p-4 md:p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className={isOg ? "demon-pulse" : ""}>
          <TVStaticLogo size={56} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.4em] mood-accent terminal-mono">
            0G · Console
          </div>
          <h1 className="syndicate-header text-xl md:text-2xl text-white/95 truncate">
            AI Agents · Models · Hub Controls
          </h1>
          <p className="mt-1 text-xs text-white/55">
            Everything machine. Humans, credits, passes? Open the{" "}
            <Link to="/boss" className="underline" style={{ color: "#ffd166" }}>Boss Portal</Link>.
          </p>
        </div>
      </div>
      <SyndicateProtocolSwitch compact />
    </header>
  );
}

function EnforcerFeed() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    if (!user) { setHydrating(false); return; }
    supabase
      .from("ai_logs")
      .select("id, source, level, message, created_at")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (!alive) return;
        setRows(((data as LogRow[]) ?? []).reverse());
        setHydrating(false);
      });

    const channel = supabase
      .channel("ai-logs-console")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_logs" },
        (payload: any) => setRows((rs) => [...rs.slice(-80), payload.new as LogRow]),
      )
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [rows.length]);

  return (
    <div
      ref={scrollRef}
      className="terminal-mono text-[12px] mt-3 rounded-2xl bg-black/70 p-3 max-h-[42vh] min-h-[220px] overflow-y-auto space-y-1 border border-white/5"
    >
      {hydrating && (
        <div className="space-y-2">
          <SkeletonShimmer className="h-3 w-3/4" />
          <SkeletonShimmer className="h-3 w-1/2" />
          <SkeletonShimmer className="h-3 w-2/3" />
        </div>
      )}
      {!hydrating && rows.length === 0 && (
        <div className="text-white/40 italic">// awaiting agent transmissions…</div>
      )}
      {rows.map((r) => {
        const tone =
          r.level === "error" ? "text-rose-300"
          : r.level === "warn" ? "text-amber-300"
          : "text-white/85";
        return (
          <div key={r.id} className={tone}>
            <span style={{ color: "var(--syndicate-glow)" }}>›</span>{" "}
            [{new Date(r.created_at).toLocaleTimeString()}] {r.source}/
            {r.level.toUpperCase()} ▸ {r.message}
          </div>
        );
      })}
    </div>
  );
}
