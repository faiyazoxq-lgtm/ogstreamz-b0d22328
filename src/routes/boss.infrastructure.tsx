import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Lock, ScrollText, ShieldOff, ShieldAlert, Settings, Brain } from "lucide-react";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/infrastructure")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Infrastructure · Boss · 0G-STREAMZ" },
      { name: "description", content: "Agent keys, secrets, function audit, grants and platform settings." },
    ],
  }),
  component: BossInfrastructurePage,
});

const SECTIONS = [
  { id: "agent-keys",      label: "Agent Keys",        blurb: "Encrypted API key vault.",      Icon: KeyRound,    tint: "#ffd166" },
  { id: "secrets",         label: "Secrets Inventory", blurb: "Platform secrets list.",        Icon: Lock,        tint: "#00e08a" },
  { id: "function-audit",  label: "Function Audit",    blurb: "Exposed DB functions.",         Icon: ScrollText,  tint: "#3ad6ff" },
  { id: "function-grants", label: "Function Grants",   blurb: "Revoke EXECUTE w/ restore.",    Icon: ShieldOff,   tint: "#ff5577" },
  { id: "realtime",        label: "Realtime Denials",  blurb: "Audit denied subscriptions.",   Icon: ShieldAlert, tint: "#a78bfa" },
  { id: "ai-agent",        label: "0G Bot · AI Agent", blurb: "All bot settings in one place.", Icon: Brain,       tint: "#7dd3fc" },
  { id: "settings",        label: "Settings",          blurb: "Platform tunables.",            Icon: Settings,    tint: "#94a3b8" },
] as const;

function BossInfrastructurePage() {
  return (
    <div className="space-y-5">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
          0G · Infrastructure
        </p>
        <h1 className="syndicate-header text-2xl md:text-3xl text-white/95 mt-1">
          Infrastructure Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Future home for agent keys, secrets, function audit, grants and platform settings.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <div
            key={s.id}
            className="glass-obsidian-cmd rounded-2xl p-4 border border-white/5"
          >
            <div className="flex items-center gap-2">
              <s.Icon className="h-4 w-4" style={{ color: s.tint }} />
              <span className="text-sm font-semibold text-white/90">{s.label}</span>
            </div>
            <p className="mt-2 text-xs text-white/50">{s.blurb}</p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-white/30">
              Coming soon
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}