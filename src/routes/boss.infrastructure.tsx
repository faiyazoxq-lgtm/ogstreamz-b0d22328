import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { KeyRound, MessageSquare, Send, Ban, ScrollText, Brain, Settings } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
import { BossTabIntro } from "@/components/boss/tab-intro";
import { ResponsiveTabsList } from "@/components/boss/responsive-tabs-list";
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
  { id: "agent-keys",      label: "Agent Keys",      Icon: KeyRound,      tint: "#ffd166",
    group: "Secrets",      purpose: "Encrypted vault for AI agent and integration secrets." },
  { id: "telegram-setup",  label: "Telegram Setup",  Icon: MessageSquare, tint: "#3ad6ff",
    group: "Integrations", purpose: "BotFather configuration checklist and member outreach." },
  { id: "telegram-test",   label: "Telegram Test",   Icon: Send,          tint: "#7dd3fc",
    group: "Integrations", purpose: "Live-send test messages and bot health diagnostics." },
  { id: "domain-denylist", label: "Domain Denylist", Icon: Ban,           tint: "#ff5577",
    group: "Safety",       purpose: "Block domains sitewide — links, embeds, and text." },
  { id: "denylist-audit",  label: "Denylist Audit",  Icon: ScrollText,    tint: "#a78bfa",
    group: "Safety",       purpose: "Scan for blocked-domain leaks across DB and pages." },
  { id: "og-bot-memory",   label: "OG Bot Memory",   Icon: Brain,         tint: "#00e08a",
    group: "Brain",        purpose: "View and edit persistent facts OG Bot remembers." },
  { id: "settings",        label: "Settings",        Icon: Settings,      tint: "#94a3b8",
    group: "Platform",     purpose: "Tunable platform values like signup bonus credits." },
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
          Infrastructure
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          The wiring behind the syndicate — <span className="text-white/80">Secrets</span>,
          <span className="text-white/80"> Integrations</span>,
          <span className="text-white/80"> Safety</span> filters,
          OG Bot <span className="text-white/80">Brain</span>,
          and <span className="text-white/80">Platform</span> tunables.
        </p>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) => navigate({ to: "/boss/infrastructure", hash: v, replace: false })}
      >
        <ResponsiveTabsList
          items={TABS}
          value={active}
          onChange={(v) => navigate({ to: "/boss/infrastructure", hash: v, replace: false })}
        />

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-5 space-y-4">
            <BossTabIntro icon={t.Icon} label={t.label} purpose={t.purpose} tint={t.tint} group={t.group} />
            {t.id === "agent-keys"      && <ApiKeysPage />}
            {t.id === "telegram-setup"  && <TelegramSetupPage />}
            {t.id === "telegram-test"   && <TelegramTestPage />}
            {t.id === "domain-denylist" && <DomainDenylistPage />}
            {t.id === "denylist-audit"  && <DenylistAuditPage />}
            {t.id === "og-bot-memory"   && <OGBotMemoryPage />}
            {t.id === "settings"        && <SettingsPage />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
