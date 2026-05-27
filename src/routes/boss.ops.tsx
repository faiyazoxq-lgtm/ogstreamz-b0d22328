import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Bell, Rocket, BarChart3, LayoutDashboard, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
import { AlertsPanel } from "@/components/boss/ops/alerts";
import { PublishCheckPanel } from "@/components/boss/ops/publish-check";
import { AnalyticsPanel } from "@/components/boss/ops/analytics";
import { OverlordPanel } from "@/components/boss/ops/overlord";
import { BossTodoPage } from "@/routes/boss.todo";

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
  { id: "alerts",   label: "Alerts",        Icon: Bell,            tint: "#ff5577" },
  { id: "publish",  label: "Publish Check", Icon: Rocket,          tint: "#ffd166" },
  { id: "analytics",label: "Analytics",     Icon: BarChart3,       tint: "#a78bfa" },
  { id: "overlord", label: "Overlord",      Icon: LayoutDashboard, tint: "#3ad6ff" },
  { id: "todo",     label: "Boss To-Do",    Icon: FileText,        tint: "#00e08a" },
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
          Operations Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Alerts, publish validation, analytics, overlord deck and the boss to-do list in one place.
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
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 gap-1.5"
            >
              <t.Icon className="h-3.5 w-3.5" style={{ color: t.tint }} />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="alerts" className="mt-5"><AlertsPanel /></TabsContent>
        <TabsContent value="publish" className="mt-5"><PublishCheckPanel /></TabsContent>
        <TabsContent value="analytics" className="mt-5"><AnalyticsPanel /></TabsContent>
        <TabsContent value="overlord" className="mt-5"><OverlordPanel /></TabsContent>
        <TabsContent value="todo" className="mt-5"><BossTodoPage /></TabsContent>
      </Tabs>
    </div>
  );
}