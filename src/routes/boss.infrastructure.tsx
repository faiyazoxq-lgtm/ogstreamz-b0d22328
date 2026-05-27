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
  { id: "agent-keys",      label: "Agent Keys",      Icon: KeyRound,      tint: "#ffd166", purpose: "Encrypted vault for AI agent and integration secrets." },
  { id: "telegram-setup",  label: "Telegram Setup",  Icon: MessageSquare, tint: "#3ad6ff", purpose: "BotFather configuration checklist and member outreach." },
  { id: "telegram-test",   label: "Telegram Test",   Icon: Send,          tint: "#7dd3fc", purpose: "Live-send test messages and bot health diagnostics." },
  { id: "domain-denylist", label: "Domain Denylist", Icon: Ban,           tint: "#ff5577", purpose: "Block domains sitewide — links, embeds, and text." },
  { id: "denylist-audit",  label: "Denylist Audit",  Icon: ScrollText,    tint: "#a78bfa", purpose: "Scan for blocked-domain leaks across DB and pages." },
  { id: "og-bot-memory",   label: "OG Bot Memory",   Icon: Brain,         tint: "#00e08a", purpose: "View and edit persistent facts OG Bot remembers." },
  { id: "settings",        label: "Settings",        Icon: Settings,      tint: "#94a3b8", purpose: "Tunable platform values like signup bonus credits." },
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

  const activeTab = TABS.find((t) => t.id === active)!;

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
          Secrets, integrations, domain filtering, bot memory, and platform settings — the wiring behind the syndicate.
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
              title={t.purpose}
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 gap-1.5"
            >
              <t.Icon className="h-3.5 w-3.5" style={{ color: t.tint }} />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabIntro icon={activeTab.Icon} label={activeTab.label} purpose={activeTab.purpose} tint={activeTab.tint} />

        <TabsContent value="agent-keys"      className="mt-4 space-y-4"><ApiKeysPage /></TabsContent>
        <TabsContent value="telegram-setup"  className="mt-4 space-y-4"><TelegramSetupPage /></TabsContent>
        <TabsContent value="telegram-test"   className="mt-4 space-y-4"><TelegramTestPage /></TabsContent>
        <TabsContent value="domain-denylist" className="mt-4 space-y-4"><DomainDenylistPage /></TabsContent>
        <TabsContent value="denylist-audit"  className="mt-4 space-y-4"><DenylistAuditPage /></TabsContent>
        <TabsContent value="og-bot-memory"   className="mt-4 space-y-4"><OGBotMemoryPage /></TabsContent>
        <TabsContent value="settings"        className="mt-4 space-y-4"><SettingsPage /></TabsContent>
      </Tabs>
    </div>
  );
}

function TabIntro({ icon: Icon, label, purpose, tint }: { icon: typeof KeyRound; label: string; purpose: string; tint: string }) {
  return (
    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60">
      <Icon className="h-3.5 w-3.5" style={{ color: tint }} />
      <span className="font-medium text-white/80">{label}</span>
      <span className="text-white/40">·</span>
      <span>{purpose}</span>
    </div>
  );
}
