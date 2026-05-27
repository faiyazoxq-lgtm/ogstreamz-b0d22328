import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Grid3x3, Boxes, Tags, Coins, BarChart3, ShieldCheck, Skull } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
import { BossTabIntro } from "@/components/boss/tab-intro";
import { PortalsPanel } from "@/components/boss/content/portals";
import { HubsPanel } from "@/components/boss/content/hubs";
import { PricingPanel } from "@/components/boss/content/pricing";
import { PortalCostsPanel } from "@/components/boss/content/portal-costs";
import { PortalUsagePanel } from "@/components/boss/content/portal-usage";
import { LexiconPanel } from "@/components/boss/content/lexicon";
import { CivilityPanel } from "@/components/boss/CivilityPanel";

export const Route = createFileRoute("/boss/content")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Content · Boss · 0G-STREAMZ" },
      { name: "description", content: "Portals, hubs, pricing, coin costs, usage, civility and lexicon — unified content surface." },
    ],
  }),
  component: BossContentPage,
});

const TABS = [
  { id: "portals",    label: "Portals",   Icon: Grid3x3,     tint: "#3ad6ff",
    group: "Build",   purpose: "Create, edit, and organize public portal pages." },
  { id: "hubs",       label: "Hubs",      Icon: Boxes,       tint: "#a78bfa",
    group: "Build",   purpose: "Group portals into hubs and curate their landing pages." },
  { id: "pricing",    label: "Pricing",   Icon: Tags,        tint: "#00e08a",
    group: "Money",   purpose: "Set GBP prices, packs, and tier-level pricing." },
  { id: "coin-costs", label: "Coin Costs", Icon: Coins,      tint: "#ffd166",
    group: "Money",   purpose: "Per-portal coin cost overrides and defaults." },
  { id: "usage",      label: "Usage",     Icon: BarChart3,   tint: "#7dd3fc",
    group: "Review",  purpose: "See which portals members are actually using." },
  { id: "civility",   label: "Civility",  Icon: ShieldCheck, tint: "#ff5577",
    group: "Moderate", purpose: "Default tone, swearing toggle, and moderation policy." },
  { id: "lexicon",    label: "Lexicon",   Icon: Skull,       tint: "#ff7a1a",
    group: "Moderate", purpose: "Custom swear words and severity levels." },
] as const;

type TabId = typeof TABS[number]["id"];

function BossContentPage() {
  const loc = useLocation();
  const navigate = useNavigate();
  const active = useMemo<TabId>(() => {
    const h = (loc.hash || "").replace(/^#/, "");
    return (TABS.find((t) => t.id === h)?.id ?? "portals") as TabId;
  }, [loc.hash]);

  useEffect(() => {
    if (!loc.hash) {
      void navigate({ to: "/boss/content", hash: "portals", replace: true });
    }
  }, [loc.hash, navigate]);

  return (
    <div className="space-y-5">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
          0G · Content
        </p>
        <h1 className="syndicate-header text-2xl md:text-3xl text-white/95 mt-1">
          Content
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Everything members see and pay for — <span className="text-white/80">Build</span> portals
          and hubs, set <span className="text-white/80">Money</span> (pricing &amp; coin costs),
          <span className="text-white/80"> Review</span> usage, and tune
          <span className="text-white/80"> Moderation</span> policy.
        </p>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) => navigate({ to: "/boss/content", hash: v, replace: false })}
      >
        <TabsList className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl h-auto">
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

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-5 space-y-4">
            <BossTabIntro
              icon={t.Icon}
              label={t.label}
              purpose={t.purpose}
              tint={t.tint}
              group={t.group}
            />
            {t.id === "portals"    && <PortalsPanel />}
            {t.id === "hubs"       && <HubsPanel />}
            {t.id === "pricing"    && <PricingPanel />}
            {t.id === "coin-costs" && <PortalCostsPanel />}
            {t.id === "usage"      && <PortalUsagePanel />}
            {t.id === "civility"   && <CivilityPanel />}
            {t.id === "lexicon"    && <LexiconPanel />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}