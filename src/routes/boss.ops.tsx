import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Bell, Rocket, BarChart3, LayoutDashboard, FileText } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
import { BossTabIntro } from "@/components/boss/tab-intro";
import { ResponsiveTabsList } from "@/components/boss/responsive-tabs-list";
import { AlertsPanel } from "@/components/boss/ops/alerts";
import { PublishCheckPanel } from "@/components/boss/ops/publish-check";
import { AnalyticsPanel } from "@/components/boss/ops/analytics";
import { OverlordPanel } from "@/components/boss/ops/overlord";
import { BossTodoPage } from "@/components/boss/ops/todo";

export const Route = createFileRoute("/boss/ops")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Ops · Boss · 0G-STREAMZ" },
      { name: "description", content: "Alerts, publish checks, analytics, overlord deck and boss to-do — unified operations surface." },
    ],
  }),
  component: BossOpsPage,
});

const TABS = [
  { id: "alerts",    label: "Alerts",        Icon: Bell,            tint: "#ff5577",
    group: "Monitor",  purpose: "Live system alerts and upstream API errors." },
  { id: "publish",   label: "Publish Check", Icon: Rocket,          tint: "#ffd166",
    group: "Validate", purpose: "Pre-flight readiness check before going live." },
  { id: "analytics", label: "Analytics",     Icon: BarChart3,       tint: "#a78bfa",
    group: "Review",   purpose: "Anonymous visit stats across portals and battles." },
  { id: "overlord",  label: "Overlord",      Icon: LayoutDashboard, tint: "#3ad6ff",
    group: "Command",  purpose: "Command-deck tools for users, passes, and codes." },
  { id: "todo",      label: "Boss To-Do",    Icon: FileText,        tint: "#00e08a",
    group: "Workflow", purpose: "Priority-tracked operational notes and to-dos." },
] as const;

type TabId = typeof TABS[number]["id"];

function BossOpsPage() {
  const loc = useLocation();
  const navigate = useNavigate();
  const active = useMemo<TabId>(() => {
    const h = (loc.hash || "").replace(/^#/, "");
    return (TABS.find((t) => t.id === h)?.id ?? "alerts") as TabId;
  }, [loc.hash]);

  useEffect(() => {
    if (!loc.hash) {
      void navigate({ to: "/boss/ops", hash: "alerts", replace: true });
    }
  }, [loc.hash, navigate]);

  return (
    <div className="space-y-5">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
          0G · Ops
        </p>
        <h1 className="syndicate-header text-2xl md:text-3xl text-white/95 mt-1">
          Operations
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Everything that keeps the syndicate running — <span className="text-white/80">Monitor</span> alerts,
          <span className="text-white/80"> Validate</span> readiness,
          <span className="text-white/80"> Review</span> analytics,
          and work the <span className="text-white/80">Command</span> deck and ops <span className="text-white/80">Workflow</span> board.
        </p>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) => navigate({ to: "/boss/ops", hash: v, replace: false })}
      >
        <ResponsiveTabsList
          items={TABS}
          value={active}
          onChange={(v) => navigate({ to: "/boss/ops", hash: v, replace: false })}
        />

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-5 space-y-4">
            <BossTabIntro icon={t.Icon} label={t.label} purpose={t.purpose} tint={t.tint} group={t.group} />
            {t.id === "alerts"    && <AlertsPanel />}
            {t.id === "publish"   && <PublishCheckPanel />}
            {t.id === "analytics" && <AnalyticsPanel />}
            {t.id === "overlord"  && <OverlordPanel />}
            {t.id === "todo"      && <BossTodoPage />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
