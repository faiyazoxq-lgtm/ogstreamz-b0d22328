import { Link } from "@tanstack/react-router";
import {
  Music, Laugh, TrendingUp, Wrench, Swords, Radio, Rocket,
  DoorOpen, Store, ShoppingBag, Crown, Map, Home, Sparkles, Receipt,
} from "lucide-react";
import { OgWordmark } from "@/components/OgWordmark";

/**
 * Public footer — gives every visitor (signed in or not) a clear,
 * keyboard-accessible map of the site grouped by purpose. Sits below
 * the page content on every route.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const groups = [
    {
      title: "Hubs",
      icon: Rocket,
      items: [
        { to: "/music", label: "MusicHUB", icon: Music },
        { to: "/jokes", label: "JokesHUB", icon: Laugh },
        { to: "/trade", label: "TradeHUB", icon: TrendingUp },
        { to: "/battle", label: "BattleHUB", icon: Swords },
        { to: "/syndicate", label: "Syndicate", icon: Radio },
        { to: "/tools", label: "ToolHUB", icon: Wrench },
      ],
    },
    {
      title: "Discover",
      icon: DoorOpen,
      items: [
        { to: "/", label: "Home", icon: Home },
        { to: "/portals", label: "Browse Portals", icon: Sparkles },
        { to: "/noticeboard", label: "VIP Noticeboard", icon: Crown },
        { to: "/vip", label: "Real OG", icon: Crown },
      ],
    },
    {
      title: "Store",
      icon: Store,
      items: [
        { to: "/store", label: "Credit Store", icon: ShoppingBag },
        { to: "/store/catalog", label: "Catalog", icon: ShoppingBag },
        { to: "/checkout/return", label: "Last Receipt", icon: Receipt },
      ],
    },
    {
      title: "Site",
      icon: Map,
      items: [
        { to: "/sitemap", label: "Sitemap", icon: Map },
      ],
    },
  ] as const;

  return (
    <footer
      role="contentinfo"
      className="relative z-10 mt-16 border-t border-white/10 bg-black/40 backdrop-blur-md print:hidden"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 pb-24 md:pb-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g) => {
            const HeaderIcon = g.icon;
            return (
              <nav key={g.title} aria-label={g.title}>
                <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-gold/85">
                  <HeaderIcon className="h-3.5 w-3.5" aria-hidden />
                  {g.title}
                </h2>
                <ul className="mt-3 space-y-1.5">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <li key={it.to}>
                        <Link
                          to={it.to}
                          className="group inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-foreground/75 hover:text-gold hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <Icon className="h-3.5 w-3.5 text-gold/70 group-hover:text-gold" aria-hidden />
                          <span>{it.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            );
          })}
        </div>
        <div className="mt-10 flex flex-col-reverse gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            © {year} 0G-PORTAL · Luxury Street Hub
          </p>
          <Link
            to="/"
            aria-label="0G-PORTAL — home"
            className="inline-flex items-center self-start sm:self-auto rounded-lg px-2 py-1 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <OgWordmark suffix="-PORTAL" className="text-base" />
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;