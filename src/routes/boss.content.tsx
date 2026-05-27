import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Grid3x3, Boxes, Tags, Coins, BarChart3, ShieldCheck, Skull } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
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
  { id: "portals",     label: "Portals",      Icon: Grid3x3,     tint: "#3ad6ff" },
  { id: "hubs",        label: "Hubs",         Icon: Boxes,       tint: "#a78bfa" },
  { id: "pricing",     label: "Pricing",      Icon: Tags,        tint: "#00e08a" },
  { id: "coin-costs",  label: "Coin Costs",   Icon: Coins,       tint: "#ffd166" },
  { id: "usage",       label: "Portal Usage", Icon: BarChart3,   tint: "#7dd3fc" },
  { id: "civility",    label: "Civility",     Icon: ShieldCheck, tint: "#ff5577" },
  { id: "lexicon",     label: "Swear Lexicon", Icon: Skull,      tint: "#ff7a1a" },
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
          Content Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Portals, hubs, pricing, coin costs, usage and moderation in one place.
        </p>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) => navigate({ to: "/boss/content", hash: v, replace: false })}
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

        <TabsContent value="portals" className="mt-5"><PortalsPanel /></TabsContent>
        <TabsContent value="hubs" className="mt-5"><HubsPanel /></TabsContent>
        <TabsContent value="pricing" className="mt-5"><PricingPanel /></TabsContent>
        <TabsContent value="coin-costs" className="mt-5"><PortalCostsPanel /></TabsContent>
        <TabsContent value="usage" className="mt-5"><PortalUsagePanel /></TabsContent>
        <TabsContent value="civility" className="mt-5"><CivilityPanel /></TabsContent>
        <TabsContent value="lexicon" className="mt-5"><LexiconPanel /></TabsContent>
      </Tabs>
    </div>
  );
}