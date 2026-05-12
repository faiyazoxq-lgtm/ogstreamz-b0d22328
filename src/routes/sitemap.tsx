import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Music, Laugh, TrendingUp, Wrench, Swords, Radio, Rocket,
  DoorOpen, Store, ShoppingBag, Crown, Map as MapIcon, Home,
  Sparkles, Receipt, Send, UserCircle, History, LayoutDashboard,
  Settings, LogIn, Coins,
} from "lucide-react";

/**
 * Human-readable sitemap. Mirrors the XML sitemap but grouped by intent
 * so any visitor can find every public corner of 0G-PORTAL in one place.
 */
export const Route = createFileRoute("/sitemap")({
  head: () => ({
    meta: [
      { title: "Sitemap — 0G-PORTAL" },
      { name: "description", content: "Every public page on 0G-PORTAL — hubs, portals, store, and account links in one tidy index." },
      { property: "og:title", content: "Sitemap — 0G-PORTAL" },
      { property: "og:description", content: "Every public page on 0G-PORTAL in one tidy index." },
    ],
  }),
  component: SitemapPage,
});

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; desc?: string };
type Group = { title: string; icon: React.ComponentType<{ className?: string }>; items: ReadonlyArray<Item> };

const GROUPS: ReadonlyArray<Group> = [
  {
    title: "Hubs",
    icon: Rocket,
    items: [
      { to: "/music",     label: "MusicHUB",   icon: Music,      desc: "AI lyrics + Suno tracks" },
      { to: "/jokes",     label: "JokesHUB",   icon: Laugh,      desc: "Live comedy generator" },
      { to: "/jokes/portal", label: "Jokes Portal", icon: Laugh, desc: "Featured jokes" },
      { to: "/trade",     label: "TradeHUB",   icon: TrendingUp, desc: "Quant signals & whale flows" },
      { to: "/battle",    label: "BattleHUB",  icon: Swords,     desc: "Pick a side, eat the loss" },
      { to: "/battlehub", label: "Battle Lobby", icon: Swords,   desc: "Open battles" },
      { to: "/syndicate", label: "Syndicate",  icon: Radio,      desc: "Live frequency & rooms" },
      { to: "/tools",     label: "ToolHUB",    icon: Wrench,     desc: "Spawn calculators & utilities" },
    ],
  },
  {
    title: "Portals & VIP",
    icon: DoorOpen,
    items: [
      { to: "/",            label: "Home",            icon: Home,      desc: "Landing & spotlight" },
      { to: "/portals",     label: "Browse Portals",  icon: Sparkles,  desc: "Directory of every portal" },
      { to: "/vip",         label: "Real OG",         icon: Crown,     desc: "VIP membership" },
      { to: "/noticeboard", label: "VIP Noticeboard", icon: Crown,     desc: "Member-only updates" },
    ],
  },
  {
    title: "Store",
    icon: Store,
    items: [
      { to: "/store",           label: "Credit Store", icon: ShoppingBag, desc: "Top up credits & VIP" },
      { to: "/store/catalog",   label: "Catalog",      icon: ShoppingBag, desc: "All products" },
      { to: "/checkout/return", label: "Last Receipt", icon: Receipt,     desc: "Recent purchase status" },
    ],
  },
  {
    title: "Account",
    icon: UserCircle,
    items: [
      { to: "/auth",              label: "Sign in / Join", icon: LogIn,           desc: "Create or access your account" },
      { to: "/profile",           label: "Vault & Profile", icon: UserCircle,     desc: "Your identity & vault" },
      { to: "/dashboard",         label: "Dashboard",      icon: LayoutDashboard, desc: "Activity at a glance" },
      { to: "/wallet",            label: "Wallet",         icon: Coins,           desc: "Coins & balances" },
      { to: "/history",           label: "Portal History", icon: History,         desc: "Your past portals" },
      { to: "/connect-telegram",  label: "Telegram Inbox", icon: Send,            desc: "Link Telegram for alerts" },
      { to: "/settings",          label: "Settings",       icon: Settings,        desc: "Preferences" },
    ],
  },
];

function SitemapPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-8 py-10">
      <header className="mb-10 text-center">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.35em] text-gold">
          <MapIcon className="h-3.5 w-3.5" aria-hidden />
          Sitemap
        </p>
        <h1 className="mt-3 font-[Montserrat] font-extralight text-metallic"
            style={{ fontSize: "clamp(1.875rem, 1.4rem + 2.4vw, 3.25rem)", letterSpacing: "0.04em", lineHeight: 1.05 }}>
          Every page, one place
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          A complete map of 0G-PORTAL. Pick any hub, portal, or account page below.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        {GROUPS.map((g) => {
          const HeaderIcon = g.icon;
          return (
            <section
              key={g.title}
              className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm"
            >
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-gold">
                <HeaderIcon className="h-4 w-4" aria-hidden />
                {g.title}
              </h2>
              <ul className="mt-4 grid gap-1.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        className="group flex items-start gap-3 rounded-lg border border-transparent px-2.5 py-2 hover:border-gold/30 hover:bg-gold/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-gold/80 group-hover:text-gold ring-1 ring-white/5">
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground group-hover:text-gold">
                            {it.label}
                          </span>
                          {it.desc && (
                            <span className="block text-[12px] text-muted-foreground">{it.desc}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        Looking for the machine-readable version? <a className="text-gold hover:underline" href="/sitemap.xml">/sitemap.xml</a>
      </p>
    </main>
  );
}