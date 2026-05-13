import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState, useMemo } from "react";
import {
  Boxes, Grid3x3, Users, Globe2, ShieldCheck, Wallet, SlidersHorizontal,
  ChevronRight, Loader2, Search, ExternalLink,
} from "lucide-react";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/control-centre")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Boss Control Centre — All Toggles & Commands" },
      { name: "description", content: "Every boss-only toggle, input and command grouped by category." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BossControlCentre,
});

/**
 * Mega "everything in one page" boss console.
 *
 * Each section lazy-loads the underlying route module on first expand and
 * mounts that module's `Route.options.component` directly — so each panel
 * is the real, fully-functional editor (not a copy). The original routes
 * remain reachable from the rail; this page just stacks them under one
 * scroll for a single-pane workflow.
 *
 * Performance: panels are unmounted while collapsed (Accordion does this
 * by default) so initial cost is just one fetch per opened section.
 */

type Panel = {
  id: string;
  label: string;
  desc: string;
  to: string;
  load: () => Promise<{ default: React.ComponentType<any> }>;
};

type Group = {
  id: string;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  tint: string;
  panels: Panel[];
};

// Helper that turns a route module into a default-export component
// lazy-loadable by React.lazy. Each route registers its UI on
// `Route.options.component`, which is the same render path the live route
// uses, so we get full parity (state, queries, etc).
const lazyRoute = (loader: () => Promise<any>) =>
  lazy(async () => {
    const mod = await loader();
    const Component = mod?.Route?.options?.component;
    if (!Component) {
      return {
        default: () => (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Could not load module — route exposes no component.
          </div>
        ),
      };
    }
    return { default: Component };
  });

const GROUPS: Group[] = [
  {
    id: "hub", label: "Hub controls", desc: "Built-in & custom hubs",
    Icon: Boxes, tint: "#a78bfa",
    panels: [
      { id: "hubs", label: "Hubs roster", desc: "Enable / order / customise hubs", to: "/boss/hubs",
        load: () => import("./boss.hubs") },
      { id: "hubs-new", label: "New hub", desc: "Create a custom hub", to: "/boss/hubs/new",
        load: () => import("./boss.hubs.new") },
    ],
  },
  {
    id: "portal", label: "Portal controls", desc: "Portals, costs, usage",
    Icon: Grid3x3, tint: "#3ad6ff",
    panels: [
      { id: "portals", label: "Portals", desc: "Manage individual portals", to: "/boss/portals",
        load: () => import("./boss.portals") },
      { id: "portal-costs", label: "Coin costs", desc: "Per-hub & per-portal pricing", to: "/boss/portal-costs",
        load: () => import("./boss.portal-costs") },
      { id: "portal-usage", label: "Usage stats", desc: "Live portal traffic & spend", to: "/boss/portal-usage",
        load: () => import("./boss.portal-usage") },
      { id: "stream-queue", label: "Stream queue", desc: "Pending stream verifications", to: "/boss/stream-queue",
        load: () => import("./boss.stream-queue") },
    ],
  },
  {
    id: "user", label: "User controls", desc: "Roster, ranks, contacts, moderation",
    Icon: Users, tint: "#00e08a",
    panels: [
      { id: "users", label: "Roster", desc: "Ranks, credits, bans, OG passes", to: "/boss/users",
        load: () => import("./boss.users") },
      { id: "contacts", label: "Contacts", desc: "Phone numbers & spares", to: "/boss/contacts",
        load: () => import("./boss.contacts") },
      { id: "civility", label: "Civility", desc: "Default tone for the site", to: "/boss/civility",
        load: () => import("./boss.civility") },
      { id: "lexicon", label: "Lexicon", desc: "Allow / deny word lists", to: "/boss/lexicon",
        load: () => import("./boss.lexicon") },
      { id: "domain-denylist", label: "Domain denylist", desc: "Block sign-up domains", to: "/boss/domain-denylist",
        load: () => import("./boss.domain-denylist") },
      { id: "denylist-audit", label: "Denylist audit", desc: "Recent denylist hits", to: "/boss/denylist-audit",
        load: () => import("./boss.denylist-audit") },
      { id: "telegram-setup", label: "Telegram setup", desc: "Wire user link bot", to: "/boss/telegram-setup",
        load: () => import("./boss.telegram-setup") },
      { id: "telegram-test", label: "Telegram test", desc: "Send test messages", to: "/boss/telegram-test",
        load: () => import("./boss.telegram-test") },
    ],
  },
  {
    id: "site", label: "Site & money", desc: "Pricing, promos, alerts, publish",
    Icon: Globe2, tint: "#ffd166",
    panels: [
      { id: "overview", label: "Power bar", desc: "Master toggles & reverse tool", to: "/boss/overview",
        load: () => import("./boss.overview") },
      { id: "power", label: "Power detail", desc: "Detailed kill switches", to: "/boss/power",
        load: () => import("./boss.power") },
      { id: "settings", label: "Site settings", desc: "Tunables", to: "/boss/settings",
        load: () => import("./boss.settings") },
      { id: "pricing", label: "Pricing", desc: "Coin packs & products", to: "/boss/pricing",
        load: () => import("./boss.pricing") },
      { id: "promotions", label: "Promotions", desc: "Sign-up bonus & promos", to: "/boss/promotions",
        load: () => import("./boss.promotions") },
      { id: "alerts", label: "Alerts", desc: "Live incident inbox", to: "/boss/alerts",
        load: () => import("./boss.alerts") },
      { id: "publish-check", label: "Publish check", desc: "Pre-publish validation", to: "/boss/publish-check",
        load: () => import("./boss.publish-check") },
      { id: "analytics", label: "Analytics", desc: "Portal & site metrics", to: "/boss/analytics",
        load: () => import("./boss.analytics") },
      { id: "analytics-setup", label: "Analytics setup", desc: "GA / events config", to: "/boss/analytics-setup",
        load: () => import("./boss.analytics-setup") },
      { id: "todo", label: "Boss todo", desc: "Full notepad board", to: "/boss/todo",
        load: () => import("./boss.todo") },
    ],
  },
  {
    id: "security", label: "Security & secrets", desc: "Keys, grants, audit",
    Icon: ShieldCheck, tint: "#ff5577",
    panels: [
      { id: "api-keys", label: "Agent keys", desc: "Encrypted API key vault", to: "/boss/api-keys",
        load: () => import("./boss.api-keys") },
      { id: "secrets-inventory", label: "Secrets inventory", desc: "Platform secrets list", to: "/boss/secrets-inventory",
        load: () => import("./boss.secrets-inventory") },
      { id: "function-audit", label: "Function audit", desc: "Exposed DB functions", to: "/boss/function-audit",
        load: () => import("./boss.function-audit") },
      { id: "function-grants", label: "Function grants", desc: "Revoke EXECUTE w/ restore log", to: "/boss/function-grants",
        load: () => import("./boss.function-grants") },
      { id: "function-ideas", label: "Function ideas", desc: "Plug-in & feature backlog", to: "/boss/function-ideas",
        load: () => import("./boss.function-ideas") },
      { id: "realtime-denials", label: "Realtime denials", desc: "Audit denied subscriptions", to: "/boss/realtime-denials",
        load: () => import("./boss.realtime-denials") },
      { id: "security-events", label: "Security events", desc: "Recent flagged events", to: "/boss/security-events",
        load: () => import("./boss.security-events") },
    ],
  },
];

function BossControlCentre() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string[]>([]);

  const filteredGroups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return GROUPS;
    return GROUPS
      .map((g) => ({
        ...g,
        panels: g.panels.filter(
          (p) =>
            p.label.toLowerCase().includes(needle) ||
            p.desc.toLowerCase().includes(needle) ||
            g.label.toLowerCase().includes(needle),
        ),
      }))
      .filter((g) => g.panels.length > 0);
  }, [q]);

  const totalPanels = GROUPS.reduce((n, g) => n + g.panels.length, 0);

  function expandAll() {
    setOpen(filteredGroups.flatMap((g) => g.panels.map((p) => `${g.id}:${p.id}`)));
  }

  function collapseAll() {
    setOpen([]);
  }

  return (
    <div className="space-y-5 py-4">
      <header className="space-y-2">
        <h1 className="syndicate-header text-2xl text-foreground">Control Centre</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Every boss toggle, input and command on one page. {totalPanels} panels grouped into {GROUPS.length} categories.
          Each section mounts the live editor when expanded, so changes here are identical to opening the full page.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter panels (e.g. 'pricing', 'telegram')…"
              className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/40"
            />
          </div>
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-secondary/80"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-secondary/80"
          >
            Collapse all
          </button>
        </div>
      </header>

      {filteredGroups.length === 0 && (
        <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No panels match "{q}".
        </div>
      )}

      {filteredGroups.map((group) => (
        <section
          key={group.id}
          className="rounded-xl border border-border bg-card/40 backdrop-blur"
          style={{ boxShadow: `0 0 24px -18px ${group.tint}` }}
        >
          <header
            className="flex items-center gap-2 border-b border-border px-4 py-2.5"
            style={{ borderColor: `${group.tint}33` }}
          >
            <group.Icon className="h-4 w-4" style={{ color: group.tint }} />
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-foreground">
              {group.label}
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {group.desc} · {group.panels.length} panels
            </span>
          </header>

          <Accordion
            type="multiple"
            value={open}
            onValueChange={setOpen}
            className="divide-y divide-border"
          >
            {group.panels.map((panel) => {
              const value = `${group.id}:${panel.id}`;
              const isOpen = open.includes(value);
              return (
                <AccordionItem key={value} value={value} className="border-0">
                  <div className="flex items-center gap-2 px-2 sm:px-4">
                    <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 text-left">
                        <ChevronRight
                          className="h-3.5 w-3.5 text-muted-foreground transition-transform"
                          style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                        />
                        <div>
                          <div className="text-sm font-bold text-foreground">{panel.label}</div>
                          <div className="text-[11px] text-muted-foreground">{panel.desc}</div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <Link
                      to={panel.to}
                      className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Open as standalone page"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <AccordionContent className="px-2 sm:px-4 pb-4">
                    <div className="rounded-lg border border-border/60 bg-background/40 p-2 sm:p-3">
                      <Suspense
                        fallback={
                          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading {panel.label}…
                          </div>
                        }
                      >
                        <PanelMount loader={panel.load} />
                      </Suspense>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      ))}
    </div>
  );
}

/**
 * Tiny wrapper that defers React.lazy() construction until the first
 * render — important because creating lazy() at module scope would fire
 * the dynamic import the moment this file is parsed, defeating the
 * collapsed-by-default optimisation.
 */
function PanelMount({ loader }: { loader: () => Promise<any> }) {
  const Cmp = useMemo(() => lazyRoute(loader), [loader]);
  return <Cmp />;
}