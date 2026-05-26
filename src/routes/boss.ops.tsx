import { createFileRoute } from "@tanstack/react-router";
import { Power, Bell, Rocket, ShieldCheck, BarChart3, ScrollText } from "lucide-react";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/ops")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Ops · Boss · 0G-STREAMZ" },
      { name: "description", content: "Power bar, alerts, publish checks, civility and analytics — day-to-day operations." },
    ],
  }),
  component: BossOpsPage,
});

const SECTIONS = [
  { id: "power",     label: "Power Bar",     blurb: "Master toggles & reverse tool.", Icon: Power,       tint: "#00e08a" },
  { id: "alerts",    label: "Alerts",        blurb: "Live incident feed.",            Icon: Bell,        tint: "#ff5577" },
  { id: "publish",   label: "Publish Check", blurb: "Pre-publish validation.",        Icon: Rocket,      tint: "#ffd166" },
  { id: "civility",  label: "Civility",      blurb: "Default site tone & lexicon.",   Icon: ShieldCheck, tint: "#3ad6ff" },
  { id: "analytics", label: "Analytics",     blurb: "Portal & syndicate metrics.",    Icon: BarChart3,   tint: "#a78bfa" },
  { id: "audit",     label: "Audit Log",     blurb: "Boss action history.",           Icon: ScrollText,  tint: "#94a3b8" },
] as const;

function BossOpsPage() {
  return (
    <div className="space-y-5">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
          0G · Ops
        </p>
        <h1 className="syndicate-header text-2xl md:text-3xl text-white/95 mt-1">
          Operations Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Future home for the power bar, alerts, publish gates, moderation defaults and analytics.
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