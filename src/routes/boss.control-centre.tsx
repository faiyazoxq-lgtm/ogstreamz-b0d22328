import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useCallback } from "react";
import {
  Boxes, Grid3x3, Users, Globe2, ShieldCheck, ChevronRight, Search,
} from "lucide-react";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/control-centre")({
  beforeLoad: requireBoss,
  // URL-backed UI state so refreshing or sharing the link restores the
  // exact same set of expanded panels and the active search filter.
  //   ?open=hub:hubs,site:overview   – which accordion items are open
  //   ?q=pricing                     – panel search filter
  // URL-backed UI state: a search filter that survives refresh / share.
  //   ?q=pricing
  validateSearch: (raw: Record<string, unknown>) => ({
    q: typeof raw.q === "string" ? raw.q.slice(0, 80) : "",
  }),
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
};

type Group = {
  id: string;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
  panels: Panel[];
};

const GROUPS: Group[] = [
  {
    id: "hub", label: "Hub controls", desc: "Built-in & custom hubs",
    Icon: Boxes, tint: "#a78bfa",
    panels: [
      { id: "hubs", label: "Hubs roster", desc: "Enable / order / customise hubs", to: "/boss/hubs" },
      { id: "hubs-new", label: "New hub", desc: "Create a custom hub", to: "/boss/hubs/new" },
    ],
  },
  {
    id: "portal", label: "Portal controls", desc: "Portals, costs, usage",
    Icon: Grid3x3, tint: "#3ad6ff",
    panels: [
      { id: "portals", label: "Portals", desc: "Manage individual portals", to: "/boss/portals" },
      { id: "portal-costs", label: "Coin costs", desc: "Per-hub & per-portal pricing", to: "/boss/portal-costs" },
      { id: "portal-usage", label: "Usage stats", desc: "Live portal traffic & spend", to: "/boss/portal-usage" },
      { id: "stream-queue", label: "Stream queue", desc: "Pending stream verifications", to: "/boss/stream-queue" },
    ],
  },
  {
    id: "user", label: "User controls", desc: "Roster, ranks, contacts, moderation",
    Icon: Users, tint: "#00e08a",
    panels: [
      { id: "users", label: "Roster", desc: "Ranks, credits, bans, OG passes", to: "/boss/users" },
      { id: "contacts", label: "Contacts", desc: "Phone numbers & spares", to: "/boss/contacts" },
      { id: "civility", label: "Civility", desc: "Default tone for the site", to: "/boss/civility" },
      { id: "lexicon", label: "Lexicon", desc: "Allow / deny word lists", to: "/boss/lexicon" },
      { id: "domain-denylist", label: "Domain denylist", desc: "Block sign-up domains", to: "/boss/domain-denylist" },
      { id: "denylist-audit", label: "Denylist audit", desc: "Recent denylist hits", to: "/boss/denylist-audit" },
      { id: "telegram-setup", label: "Telegram setup", desc: "Wire user link bot", to: "/boss/telegram-setup" },
      { id: "telegram-test", label: "Telegram test", desc: "Send test messages", to: "/boss/telegram-test" },
    ],
  },
  {
    id: "site", label: "Site & money", desc: "Pricing, promos, alerts, publish",
    Icon: Globe2, tint: "#ffd166",
    panels: [
      { id: "overview", label: "Power bar", desc: "Master toggles & reverse tool", to: "/boss/overview" },
      { id: "power", label: "Power detail", desc: "Detailed kill switches", to: "/boss/power" },
      { id: "settings", label: "Site settings", desc: "Tunables", to: "/boss/settings" },
      { id: "pricing", label: "Pricing", desc: "Coin packs & products", to: "/boss/pricing" },
      { id: "promotions", label: "Promotions", desc: "Sign-up bonus & promos", to: "/boss/promotions" },
      { id: "alerts", label: "Alerts", desc: "Live incident inbox", to: "/boss/alerts" },
      { id: "publish-check", label: "Publish check", desc: "Pre-publish validation", to: "/boss/publish-check" },
      { id: "analytics", label: "Analytics", desc: "Portal & site metrics", to: "/boss/analytics" },
      { id: "analytics-setup", label: "Analytics setup", desc: "GA / events config", to: "/boss/analytics-setup" },
      { id: "todo", label: "Boss todo", desc: "Full notepad board", to: "/boss/todo" },
    ],
  },
  {
    id: "security", label: "Security & secrets", desc: "Keys, grants, audit",
    Icon: ShieldCheck, tint: "#ff5577",
    panels: [
      { id: "api-keys", label: "Agent keys", desc: "Encrypted API key vault", to: "/boss/api-keys" },
      { id: "secrets-inventory", label: "Secrets inventory", desc: "Platform secrets list", to: "/boss/secrets-inventory" },
      { id: "function-audit", label: "Function audit", desc: "Exposed DB functions", to: "/boss/function-audit" },
      { id: "function-grants", label: "Function grants", desc: "Revoke EXECUTE w/ restore log", to: "/boss/function-grants" },
      { id: "function-ideas", label: "Function ideas", desc: "Plug-in & feature backlog", to: "/boss/function-ideas" },
      { id: "realtime-denials", label: "Realtime denials", desc: "Audit denied subscriptions", to: "/boss/realtime-denials" },
      { id: "security-events", label: "Security events", desc: "Recent flagged events", to: "/boss/security-events" },
    ],
  },
];

function BossControlCentre() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setQ = useCallback(
    (value: string) => {
      navigate({
        search: (prev: any) => ({ ...prev, q: value }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

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
  const totalShown = filteredGroups.reduce((n, g) => n + g.panels.length, 0);

  return (
    <div className="space-y-5 py-4">
      <header className="space-y-2">
        <h1 className="syndicate-header text-2xl text-foreground">Control Centre</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Every boss toggle, input and command in one directory. {totalPanels} controls grouped into {GROUPS.length} categories.
          Click any tile to open the live editor.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter controls (e.g. 'pricing', 'telegram')…"
              className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/40"
            />
          </div>
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-secondary/80"
            >
              Clear
            </button>
          )}
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {totalShown} / {totalPanels}
          </span>
        </div>
        {/* Quick-jump pills — anchor to each group section below. */}
        <nav className="flex flex-wrap gap-1.5 pt-1" aria-label="Jump to category">
          {filteredGroups.map((g) => (
            <a
              key={g.id}
              href={`#cc-${g.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary"
              style={{ borderColor: `${g.tint}55` }}
            >
              <g.Icon className="h-3 w-3" style={{ color: g.tint }} />
              {g.label}
              <span className="text-[9px] opacity-70">{g.panels.length}</span>
            </a>
          ))}
        </nav>
      </header>

      {filteredGroups.length === 0 && (
        <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No controls match "{q}".
        </div>
      )}

      {filteredGroups.map((group) => (
        <section
          key={group.id}
          id={`cc-${group.id}`}
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
              {group.desc} · {group.panels.length} controls
            </span>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {group.panels.map((panel) => (
              <Link
                key={panel.id}
                to={panel.to}
                className="group flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 hover:bg-secondary hover:border-border transition"
                style={{ borderColor: `${group.tint}22` }}
              >
                <ChevronRight
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  style={{ color: group.tint }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{panel.label}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2">{panel.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}