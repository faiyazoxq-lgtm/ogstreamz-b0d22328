import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Crown, LayoutDashboard, ShieldCheck, BarChart3, Skull, Users, ChevronLeft, Menu, X, ShieldAlert, LogIn, ChevronRight, Home, Tv, Tags, Bell, ChevronDown, ShoppingBag, Sparkles, Settings, Boxes, Grid3x3, Coins } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BossSearch } from "@/components/BossSearch";
import { requireBoss } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/boss")({
  beforeLoad: requireBoss,
  component: BossLayout,
});

type NavItem = {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  desc?: string;
};
type NavGroup = { id: string; label: string; Icon: React.ComponentType<{ className?: string }>; items: NavItem[] };

const TOP: NavItem = { to: "/boss/overview", label: "Overview", Icon: Crown, exact: true, desc: "Daily snapshot" };

const GROUPS: NavGroup[] = [
  {
    id: "members",
    label: "Members",
    Icon: Users,
    items: [
      { to: "/boss/users", label: "User Roster", Icon: Users, desc: "Rank, credits, bans, swearing" },
      { to: "/boss/stream-queue", label: "Stream Queue", Icon: Tv, desc: "Pending stream verifications" },
    ],
  },
  {
    id: "commerce",
    label: "Commerce",
    Icon: ShoppingBag,
    items: [
      { to: "/boss/pricing", label: "Pricing", Icon: Tags, desc: "Coin packs & store products" },
      { to: "/admin", label: "Admin Console", Icon: Sparkles, desc: "Top-ups, passes, vault" },
      { to: "/boss/settings", label: "Settings", Icon: Settings, desc: "Signup bonus & tunables" },
    ],
  },
  {
    id: "moderation",
    label: "Moderation",
    Icon: ShieldCheck,
    items: [
      { to: "/boss/alerts", label: "System Alerts", Icon: Bell, desc: "Live incidents", },
      { to: "/boss/civility", label: "Civility", Icon: ShieldCheck, desc: "Default tone" },
      { to: "/boss/lexicon", label: "Swear Lexicon", Icon: Skull, desc: "Word lists" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    Icon: BarChart3,
    items: [
      { to: "/boss/analytics", label: "Analytics", Icon: BarChart3, desc: "Portal & spend metrics" },
      { to: "/syndicate-overlord", label: "Overlord Deck", Icon: LayoutDashboard, desc: "Syndicate command" },
    ],
  },
  {
    id: "content",
    label: "Content",
    Icon: Boxes,
    items: [
      { to: "/boss/hubs", label: "Hubs", Icon: Boxes, desc: "Manage built-in & custom hubs" },
      { to: "/boss/portals", label: "Portals", Icon: Grid3x3, desc: "Manage all portals" },
      { to: "/boss/portal-costs", label: "Coin Costs", Icon: Coins, desc: "Per-hub create & per-portal use costs" },
    ],
  },
];

const ALL_NAV: NavItem[] = [TOP, ...GROUPS.flatMap((g) => g.items)];

function BossLayout() {
  const { user, isAdmin, profile, loading } = useAuth();
  const isBoss = profile?.rank === "boss" || isAdmin;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [alertsUnread, setAlertsUnread] = useState(0);

  useEffect(() => {
    if (!isBoss) return;
    let cancelled = false;
    const refresh = async () => {
      const { count } = await supabase
        .from("system_alerts")
        .select("*", { count: "exact", head: true })
        .is("acknowledged_at", null);
      if (!cancelled) setAlertsUnread(count ?? 0);
    };
    refresh();
    const ch = supabase
      .channel("system_alerts_badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, refresh)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [isBoss]);

  // Close drawer on route change.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  if (loading) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  if (!user || !isBoss) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20">
        <div role="alert" aria-live="polite" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-destructive/50 bg-destructive/15">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="syndicate-header text-xl text-foreground">403 — Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user
              ? "Your account doesn't have Boss clearance. Ask an existing Boss to grant you access."
              : "You need to sign in with a Boss-tier account to view this area."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary/80">
              <ChevronLeft className="h-4 w-4" /> Back to site
            </Link>
            {!user && (
              <Link to="/auth" className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-bold text-gold hover:bg-gold/15">
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  const isActive = (n: NavItem) =>
    n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
  const groupActive = (g: NavGroup) => g.items.some(isActive);

  const NavLeaf = ({ n, onClick, compact }: { n: NavItem; onClick?: () => void; compact?: boolean }) => {
    const active = isActive(n);
    const showBadge = n.to === "/boss/alerts" && alertsUnread > 0;
    return (
      <Link
        to={n.to}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={[
          "relative flex items-start gap-3 rounded-md pl-3 pr-3 py-2 text-sm transition-colors outline-none tracking-[0.005em]",
          "hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary",
          active
            ? "bg-gold/10 text-gold ring-1 ring-inset ring-gold/40"
            : "text-foreground/85",
        ].join(" ")}
      >
        <n.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-gold" : "text-gold/70"}`} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight">{n.label}</span>
          {!compact && n.desc && (
            <span className="block text-[11px] text-muted-foreground/80 leading-tight mt-0.5">{n.desc}</span>
          )}
        </span>
        {showBadge && (
          <span
            className="self-center inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/50"
            aria-label={`${alertsUnread} unread alerts`}
          >
            {alertsUnread > 99 ? "99+" : alertsUnread}
          </span>
        )}
      </Link>
    );
  };

  // Desktop nav: top item + groups with hover/focus dropdown
  const DesktopNav = () => (
    <nav className="space-y-1.5 font-sans" aria-label="Boss navigation">
      <NavLeaf n={TOP} compact />
      {GROUPS.map((g) => (
        <DesktopGroup
          key={g.id}
          g={g}
          active={groupActive(g)}
          alertsUnread={alertsUnread}
          NavLeaf={NavLeaf}
        />
      ))}
    </nav>
  );

  // Mobile drawer: flat with section labels (no hover on touch)
  const MobileNav = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-3 font-sans">
      <div className="space-y-0.5"><NavLeaf n={TOP} onClick={onClick} compact /></div>
      {GROUPS.map((g) => (
        <div key={g.id}>
          <p className="px-3 mb-1 text-[10px] uppercase tracking-[0.3em] text-gold/80 font-bold flex items-center gap-1.5">
            <g.Icon className="h-3 w-3" /> {g.label}
          </p>
          <div className="space-y-0.5">
            {g.items.map((n) => <NavLeaf key={n.to} n={n} onClick={onClick} compact />)}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pt-4 pb-28 md:pb-12">
      {/* Mobile bar */}
      <div className="md:hidden sticky top-16 z-30 -mx-3 mb-3 flex items-center justify-between gap-2 px-3 py-2 backdrop-blur-xl bg-background/80 border-b border-border">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Exit Boss
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Toggle Boss menu"
          className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-bold text-gold"
        >
          {drawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Boss menu
        </button>
      </div>

      <div className="md:hidden mb-3">
        <BossSearch />
      </div>

      {drawerOpen && (
        <div className="md:hidden mb-3 rounded-2xl border border-border bg-card p-3">
          <MobileNav onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="hidden md:block">
          <div className="sticky top-24 rounded-2xl border border-border bg-gradient-to-b from-gold/5 to-card/60 p-3 shadow-[0_0_40px_-20px_rgba(255,209,102,0.4)]">
            <div className="flex items-center gap-2 px-2 py-2 mb-2 border-b border-gold/10 pb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gold/10 ring-1 ring-gold/30">
                <Crown className="h-4 w-4 text-gold" />
              </span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-gold font-bold">Boss Console</span>
            </div>
            <div className="px-1 pb-3">
              <BossSearch />
            </div>
            <DesktopNav />
            <Link
              to="/"
              className="mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Exit to site
            </Link>
          </div>
        </aside>

        <main className="min-w-0">
          <BossBreadcrumbs pathname={pathname} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

type DesktopGroupProps = {
  g: NavGroup;
  active: boolean;
  alertsUnread: number;
  NavLeaf: React.ComponentType<{ n: NavItem; onClick?: () => void; compact?: boolean }>;
};

function DesktopGroup({ g, active, alertsUnread, NavLeaf }: DesktopGroupProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const hasAlert = g.id === "moderation" && alertsUnread > 0;

  // Auto-open when this group contains the active route, so highlight is obvious.
  useEffect(() => { if (active) setOpen(true); }, [active]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const focusItem = (i: number) => {
    const list = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    if (!list.length) return;
    const idx = (i + list.length) % list.length;
    list[idx]?.focus();
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(-1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    const current = list.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(-1);
    } else if (e.key === "Escape" || e.key === "ArrowLeft") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!active) setOpen(false); }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        className={[
          "w-full flex items-center gap-3 rounded-md pl-3 pr-2 py-2 text-sm font-semibold transition-colors outline-none tracking-[0.01em]",
          "hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary",
          active
            ? "bg-gold/10 text-gold ring-1 ring-inset ring-gold/40"
            : open ? "bg-secondary text-foreground" : "text-foreground/85",
        ].join(" ")}
      >
        <g.Icon className={`h-4 w-4 shrink-0 ${active ? "text-gold" : "text-gold/70"}`} />
        <span className="truncate flex-1 text-left">{g.label}</span>
        {hasAlert && (
          <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/50">
            {alertsUnread > 99 ? "99+" : alertsUnread}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        role="menu"
        aria-label={g.label}
        onKeyDown={onMenuKey}
        className={[
          open
            ? "visible opacity-100 translate-x-0 pointer-events-auto"
            : "invisible opacity-0 translate-x-1 pointer-events-none",
          "absolute left-full top-0 ml-2 z-40 w-64 transition-all duration-150",
        ].join(" ")}
      >
        <div className="rounded-xl border border-gold/30 bg-card/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/40">
          <div className="px-2 py-1.5 mb-1 border-b border-border/60">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold font-bold">{g.label}</p>
          </div>
          <div className="space-y-0.5">
            {g.items.map((n, i) => (
              <div key={n.to} ref={(el) => { itemRefs.current[i] = el?.querySelector("a") ?? null; }}>
                <NavLeaf n={n} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BossBreadcrumbs({ pathname }: { pathname: string }) {
  const match = ALL_NAV.find((n) =>
    n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/"),
  );
  const currentLabel = match?.label
    ?? (pathname === "/boss" ? "Overview" : pathname.replace("/boss/", "").replace(/[-/]/g, " ").trim() || "Boss");
  const onOverview = pathname === "/boss" || pathname === "/boss/overview";

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center flex-wrap gap-1.5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <li>
          <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="h-3 w-3" />
            <span>Home</span>
          </Link>
        </li>
        <li aria-hidden="true"><ChevronRight className="h-3 w-3 opacity-50" /></li>
        <li>
          {onOverview ? (
            <span className="inline-flex items-center gap-1 text-gold" aria-current="page">
              <Crown className="h-3 w-3" /> Boss
            </span>
          ) : (
            <Link to="/boss/overview" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
              <Crown className="h-3 w-3" /> Boss
            </Link>
          )}
        </li>
        {!onOverview && (
          <>
            <li aria-hidden="true"><ChevronRight className="h-3 w-3 opacity-50" /></li>
            <li>
              <span className="text-gold font-bold" aria-current="page">{currentLabel}</span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
