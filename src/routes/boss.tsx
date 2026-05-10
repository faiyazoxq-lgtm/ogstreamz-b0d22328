import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, LayoutDashboard, ShieldCheck, BarChart3, Skull, Users, ChevronLeft, Menu, X, ShieldAlert, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/boss")({
  component: BossLayout,
});

type NavItem = { to: string; label: string; Icon: React.ComponentType<{ className?: string }>; exact?: boolean };

const NAV: NavItem[] = [
  { to: "/boss/overview",   label: "Overview",      Icon: Crown, exact: true },
  { to: "/admin",           label: "Admin Console", Icon: Users },
  { to: "/boss/civility",   label: "Civility",      Icon: ShieldCheck },
  { to: "/boss/analytics",  label: "Analytics",     Icon: BarChart3 },
  { to: "/boss/lexicon",    label: "Swear Lexicon", Icon: Skull },
  { to: "/syndicate-overlord", label: "Overlord Deck", Icon: LayoutDashboard },
];

function BossLayout() {
  const { user, isAdmin, profile, loading } = useAuth();
  const isBoss = profile?.rank === "boss" || isAdmin;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

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
              <Link to="/login" className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-bold text-gold hover:bg-gold/15">
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

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const active = isActive(n);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={[
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors outline-none",
              "hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-gold/10 text-gold ring-1 ring-inset ring-gold/40"
                : "text-foreground/80",
            ].join(" ")}
          >
            <n.Icon className={`h-4 w-4 shrink-0 ${active ? "text-gold drop-shadow-[0_0_6px_rgba(255,209,102,0.6)]" : "text-gold/70"}`} />
            <span className="truncate">{n.label}</span>
          </Link>
        );
      })}
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

      {drawerOpen && (
        <div className="md:hidden mb-3 rounded-2xl border border-border bg-card p-3">
          <NavList onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="hidden md:block">
          <div className="sticky top-24 rounded-2xl border border-border bg-card/60 p-3">
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <Crown className="h-4 w-4 text-gold" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-gold font-bold">Boss</span>
            </div>
            <NavList />
            <Link
              to="/"
              className="mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Exit to site
            </Link>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
