import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Bell, Rocket, BarChart3, LayoutDashboard, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
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
  { id: "alerts",    label: "Alerts",        Icon: Bell,            tint: "#ff5577", purpose: "Live system alerts and upstream API errors." },
  { id: "publish",   label: "Publish Check", Icon: Rocket,          tint: "#ffd166", purpose: "Validate readiness before going live." },
  { id: "analytics", label: "Analytics",     Icon: BarChart3,       tint: "#a78bfa", purpose: "Anonymous visit stats across portals and battles." },
  { id: "overlord",  label: "Overlord",      Icon: LayoutDashboard, tint: "#3ad6ff", purpose: "Command-deck tools for users, passes, and codes." },
  { id: "todo",      label: "Boss To-Do",    Icon: FileText,        tint: "#00e08a", purpose: "Priority-tracked ops workflow board." },
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

  const activeTab = TABS.find((t) => t.id === active)!;

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
          Monitoring, validation, analytics, command tools, and workflow — everything needed to keep the syndicate running.
        </p>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) => navigate({ to: "/boss/ops", hash: v, replace: false })}
      >
        <TabsList className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              title={t.purpose}
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 gap-1.5"
            >
              <t.Icon className="h-3.5 w-3.5" style={{ color: t.tint }} />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabIntro icon={activeTab.Icon} label={activeTab.label} purpose={activeTab.purpose} tint={activeTab.tint} />

        <TabsContent value="alerts" className="mt-4 space-y-4"><AlertsPanel /></TabsContent>
        <TabsContent value="publish" className="mt-4 space-y-4"><PublishCheckPanel /></TabsContent>
        <TabsContent value="analytics" className="mt-4 space-y-4"><AnalyticsPanel /></TabsContent>
        <TabsContent value="overlord" className="mt-4 space-y-4"><OverlordPanel /></TabsContent>
        <TabsContent value="todo" className="mt-4 space-y-4"><BossTodoPage /></TabsContent>
      </Tabs>
    </div>
  );
}

function TabIntro({ icon: Icon, label, purpose, tint }: { icon: typeof Bell; label: string; purpose: string; tint: string }) {
  return (
    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60">
      <Icon className="h-3.5 w-3.5" style={{ color: tint }} />
      <span className="font-medium text-white/80">{label}</span>
      <span className="text-white/40">·</span>
      <span>{purpose}</span>
    </div>
  );
}
