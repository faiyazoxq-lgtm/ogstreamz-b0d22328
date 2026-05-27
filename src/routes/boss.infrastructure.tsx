import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { KeyRound, MessageSquare, Send, Ban, ScrollText, Brain, Settings } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
import { ApiKeysPage } from "@/routes/boss.api-keys";
import { TelegramSetupPage } from "@/routes/boss.telegram-setup";
import { TelegramTestPage } from "@/routes/boss.telegram-test";
import { DomainDenylistPage } from "@/routes/boss.domain-denylist";
import { DenylistAuditPage } from "@/routes/boss.denylist-audit";
import { OGBotMemoryPage } from "@/routes/boss.og-bot-memory";
import { SettingsPage } from "@/routes/boss.settings";

export const Route = createFileRoute("/boss/infrastructure")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Infrastructure · Boss · 0G-STREAMZ" },
      { name: "description", content: "Agent keys, Telegram tools, domain filters, OG bot memory and platform settings." },
    ],
  }),
  component: BossInfrastructurePage,
});

const TABS = [
  { id: "agent-keys",      label: "Agent Keys",      Icon: KeyRound,      tint: "#ffd166" },
  { id: "telegram-setup",  label: "Telegram Setup",  Icon: MessageSquare, tint: "#3ad6ff" },
  { id: "telegram-test",   label: "Telegram Test",   Icon: Send,          tint: "#7dd3fc" },
  { id: "domain-denylist", label: "Domain Denylist", Icon: Ban,           tint: "#ff5577" },
  { id: "denylist-audit",  label: "Denylist Audit",  Icon: ScrollText,    tint: "#a78bfa" },
  { id: "og-bot-memory",   label: "OG Bot Memory",   Icon: Brain,         tint: "#00e08a" },
  { id: "settings",        label: "Settings",        Icon: Settings,      tint: "#94a3b8" },
] as const;

type TabId = typeof TABS[number]["id"];

function BossInfrastructurePage() {
  const loc = useLocation();
  const navigate = useNavigate();
  const active = useMemo<TabId>(() => {
    const h = (loc.hash || "").replace(/^#/, "");
    return (TABS.find((t) => t.id === h)?.id ?? "agent-keys") as TabId;
  }, [loc.hash]);

  useEffect(() => {
    if (!loc.hash) {
      void navigate({ to: "/boss/infrastructure", hash: "agent-keys", replace: true });
    }
  }, [loc.hash, navigate]);

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
          Agent keys, Telegram admin tools, domain filters, OG bot memory and platform settings — unified.
        </p>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) => navigate({ to: "/boss/infrastructure", hash: v, replace: false })}
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

        <TabsContent value="agent-keys" className="mt-5"><ApiKeysPage /></TabsContent>
        <TabsContent value="telegram-setup" className="mt-5"><TelegramSetupPage /></TabsContent>
        <TabsContent value="telegram-test" className="mt-5"><TelegramTestPage /></TabsContent>
        <TabsContent value="domain-denylist" className="mt-5"><DomainDenylistPage /></TabsContent>
        <TabsContent value="denylist-audit" className="mt-5"><DenylistAuditPage /></TabsContent>
        <TabsContent value="og-bot-memory" className="mt-5"><OGBotMemoryPage /></TabsContent>
        <TabsContent value="settings" className="mt-5"><SettingsPage /></TabsContent>
      </Tabs>
    </div>
  );
}