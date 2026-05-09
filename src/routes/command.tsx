import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TrendingUp, Music, Rocket, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalMood } from "@/hooks/use-global-mood";
import { SyndicateProtocolSwitch } from "@/components/SyndicateProtocolSwitch";
import { TradingViewChart } from "@/components/TradingViewWidgets";
import { TVStaticLogo } from "@/components/TVStaticLogo";
import { SkeletonShimmer } from "@/components/SkeletonShimmer";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/command")({
  head: () => ({
    meta: [
      { title: "0G Command Center — Syndicate Control Grid" },
      { name: "description", content: "Live XAU/USD radar, Enforcer Console, and Hub controls — flip the Syndicate Protocol mood from any device." },
    ],
  }),
  component: CommandCenterPage,
});

type LogRow = {
  id: string;
  source: string;
  level: string;
  message: string;
  created_at: string;
};

function CommandCenterPage() {
  const { mood } = useGlobalMood();
  const isOg = mood === "og";

  return (
    <>
      {isOg && <div aria-hidden className="og-vignette" />}

      <main className="relative z-[1] mx-auto w-full max-w-7xl px-4 pt-6 pb-28 md:pb-10 space-y-5">
        <CommandHeader isOg={isOg} />

        {/* Command Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Trade Radar — spans 2 cols on desktop */}
          <div className="glass-obsidian-cmd rounded-3xl p-4 md:p-5 lg:col-span-2">
            <CardLabel
              eyebrow="Trade Radar"
              title="XAU / USD · Live"
              accent="#ffd166"
            />
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/5">
              <TradingViewChart symbol="OANDA:XAUUSD" height={460} />
            </div>
          </div>

          {/* Hub Controls */}
          <div className="glass-obsidian-cmd rounded-3xl p-4 md:p-5">
            <CardLabel eyebrow="Hub Controls" title="Spawn / Launch / Open" accent="#ffd166" />
            <div className="mt-4 grid gap-3">
              <HubButton to="/trade" label="Spawn TradeHUB" Icon={TrendingUp} />
              <HubButton to="/music" label="Launch MusicHUB" Icon={Music} />
              <HubButton to="/connect" label="Open ConnectHUB" Icon={Rocket} />
            </div>
            <p className="mt-4 text-[11px] terminal-mono text-white/45 leading-relaxed">
              Mood:&nbsp;
              <span className="mood-accent uppercase tracking-[0.25em]">
                {isOg ? "OG · ENFORCER" : "NORMAL · ANALYST"}
              </span>
            </p>
          </div>
        </section>

        {/* Enforcer Console — full width */}
        <section className="glass-obsidian-cmd rounded-3xl p-4 md:p-5">
          <CardLabel
            eyebrow="Enforcer Console"
            title="Live Syndicate Telemetry"
            accent="#ffd166"
            icon={<Terminal className="h-4 w-4 neon-icon" />}
          />
          <EnforcerFeed />
        </section>
      </main>
    </>
  );
}

function CommandHeader({ isOg }: { isOg: boolean }) {
  return (
    <header className="glass-obsidian-cmd rounded-3xl p-4 md:p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className={isOg ? "demon-pulse" : ""}>
          <TVStaticLogo size={56} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.4em] mood-accent terminal-mono">
            0G · Command Center
          </div>
          <h1 className="syndicate-header text-xl md:text-2xl text-white/95 truncate">
            Syndicate Control Grid
          </h1>
        </div>
      </div>
      <SyndicateProtocolSwitch compact />
    </header>
  );
}

function CardLabel({
  eyebrow,
  title,
  accent,
  icon,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div
          className="text-[10px] uppercase tracking-[0.4em] terminal-mono"
          style={{ color: accent }}
        >
          {eyebrow}
        </div>
        <div className="syndicate-header text-base md:text-lg text-white/95 truncate">{title}</div>
      </div>
      {icon}
    </div>
  );
}

function HubButton({
  to,
  label,
  Icon,
}: {
  to: "/trade" | "/music" | "/connect";
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all hover:-translate-y-0.5"
      style={{
        borderColor: "color-mix(in srgb, var(--syndicate-glow) 45%, transparent)",
        background: "rgba(0,0,0,0.45)",
        boxShadow: "inset 0 0 24px color-mix(in srgb, var(--syndicate-glow) 8%, transparent)",
      }}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 neon-icon" />
        <span className="syndicate-header text-sm text-white/90">{label}</span>
      </span>
      <span
        className="text-[10px] uppercase tracking-[0.3em] terminal-mono opacity-60 group-hover:opacity-100 transition"
        style={{ color: "var(--syndicate-glow)" }}
      >
        Engage →
      </span>
    </Link>
  );
}

function EnforcerFeed() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setHydrating(false);
      return;
    }
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
      .channel("ai-logs-cmd")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_logs" },
        (payload: any) => {
          const row = payload.new as LogRow;
          setRows((rs) => [...rs.slice(-80), row]);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [rows.length]);

  return (
    <div
      ref={scrollRef}
      className="terminal-mono text-[12px] mt-3 rounded-2xl bg-black/70 p-3 max-h-[42vh] min-h-[260px] overflow-y-auto space-y-1 border border-white/5"
    >
      {hydrating && (
        <div className="space-y-2">
          <SkeletonShimmer className="h-3 w-3/4" />
          <SkeletonShimmer className="h-3 w-1/2" />
          <SkeletonShimmer className="h-3 w-2/3" />
        </div>
      )}
      {!hydrating && rows.length === 0 && (
        <div className="text-white/40 italic">// awaiting Syndicate transmissions…</div>
      )}
      {rows.map((r) => {
        const tone =
          r.level === "error"
            ? "text-rose-300"
            : r.level === "warn"
              ? "text-amber-300"
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