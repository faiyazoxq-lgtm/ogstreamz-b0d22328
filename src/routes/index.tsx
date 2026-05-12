import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { SyndicateGallery } from "@/components/SyndicateGallery";
import { OgWordmark } from "@/components/OgWordmark";
import {
  Music2, Smile, Wrench, ArrowUpRight, TrendingUp, Rocket, Swords,
  Sparkles, Radio, Bot, Brain, Zap, Star, Megaphone, Disc3, Satellite, Radar,
  UserPlus, LogIn, Gift, ShieldCheck, Coins,
  LayoutDashboard, Store, Crown, Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TiltCard } from "@/components/TiltCard";
import { WelcomeAuthPrompt } from "@/components/WelcomeAuthPrompt";
import { QuickJumpDrawer } from "@/components/QuickJumpDrawer";
import { useAuth } from "@/hooks/use-auth";
import { RealOgPromoCard } from "@/components/RealOgPromoCard";
import { CoinsBulkPromoCard } from "@/components/CoinsBulkPromoCard";
import { RealOgBundlesCard } from "@/components/RealOgBundlesCard";
import { VaultLoginModal } from "@/components/VaultLoginModal";
import { StreamLinkCard } from "@/components/StreamLinkCard";
import { VerifyStreamAccessCard } from "@/components/VerifyStreamAccessCard";
import { StreamStatusWidget } from "@/components/StreamStatusWidget";
import { Flame } from "lucide-react";
import { TrackingEye } from "@/components/TrackingEye";
import { VipPortalExplorer } from "@/components/VipPortalExplorer";
import { OgVaultAccessSection } from "@/components/OgVaultAccessSection";
import { usePortalCount } from "@/hooks/use-portal-count";
import { TelegramConnectBanner } from "@/components/TelegramConnectBanner";

const ICONS: Record<string, any> = {
  Music2, Smile, Wrench, TrendingUp, Rocket, Sparkles, Radio, Bot, Brain,
  Zap, Star, Megaphone, Disc3, Satellite, Radar,
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "0G-PORTAL — The Hub" },
      { name: "description", content: "Enter the 0G-PORTAL universe: MusicHUB, JokesHUB, and ToolHUB." },
    ],
  }),
  component: Index,
});

const portals = [
  { to: "/music" as const,   title: "MusicHUB",   desc: "Stream. Own. Repeat.",          Icon: Music2 },
  { to: "/jokes" as const,   title: "JokesHUB",   desc: "Fast wit. Zero filler.",        Icon: Smile },
  { to: "/trade" as const,   title: "TradeHUB",   desc: "Live signals. Bias meters.",    Icon: TrendingUp },
  { to: "/connect" as const, title: "ConnectHUB", desc: "Scout. Enrich. Outreach.",      Icon: Rocket },
  { to: "/battle" as const,  title: "BattleHUB",  desc: "Every choice is a loss.",       Icon: Swords },
  { to: "/tools" as const,   title: "ToolHUB",    desc: "Sharp utilities, fast.",        Icon: Wrench },
];

function Index() {
  const [customHubs, setCustomHubs] = useState<any[]>([]);
  const { user, profile, isAdmin } = useAuth();
  const { total: totalPortals, label: portalsLabel } = usePortalCount(portals, customHubs);
  const rank = profile?.rank;
  const streamLinked = rank === "stream_user" || rank === "vip" || rank === "boss";
  // VIPs (and the boss) already own the perks these promos are pitching —
  // hide the upsell so the welcome page stays clean for them.
  const isBoss = isAdmin;
  const isVipMember = rank === "vip" || rank === "boss" || profile?.status === "vip" || isBoss;
  const showStreamConnect = !!user && !streamLinked;
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const isNavigating = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  });
  useEffect(() => {
    if (!isNavigating && pendingTo) setPendingTo(null);
  }, [isNavigating, pendingTo]);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { data } = await supabase
        .from("custom_hubs")
        .select("id,title,tagline,href,icon,accent,sort_order,published")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (!cancelled) setCustomHubs(data ?? []);
    };
    void refresh();
    // Live-update the portal count when hubs are added/edited/removed.
    const channel = supabase
      .channel("custom_hubs:index")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_hubs" },
        () => { void refresh(); },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main className="relative">
      {user && (
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-4">
          <TelegramConnectBanner userId={user.id} />
        </div>
      )}
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-[radial-gradient(closest-side,oklch(0.72_0.22_245_/_0.28),transparent)]" />
        <div className="absolute top-1/2 left-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(closest-side,oklch(0.55_0.24_255_/_0.15),transparent)]" />
      </div>

      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-16 text-center">
        <p className="text-xs sm:text-sm tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          Street · Static · Stream
        </p>
        <h1 className="mt-6 text-5xl sm:text-7xl md:text-8xl leading-[0.95] flex justify-center">
          <OgWordmark suffix="-PORTAL" className="animate-glitch" />
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-muted-foreground text-base sm:text-lg">
          One frequency. {portalsLabel}. Pick your channel.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to="/portals"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-[11px] uppercase tracking-[0.3em] font-bold backdrop-blur-xl hover:border-[oklch(0.72_0.22_245/0.7)]"
            style={{ color: "var(--mood-accent, #ffd166)" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            All Spawned Portals
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Best bulk-buy Coins deal — shown above the VIP pass on welcome page */}
      <CoinsBulkPromoCard />

      {/* Real OG one-off pass — hidden for existing VIPs */}
      {!isVipMember && <RealOgPromoCard />}

      {/* VIP Bundles — Real OG + Coins at a discounted total. Hidden for VIPs. */}
      {!isVipMember && <RealOgBundlesCard />}

      {showStreamConnect && (
        <section className="relative max-w-3xl mx-auto px-5 sm:px-8 -mt-2 pb-6">
          <StreamLinkCard />
        </section>
      )}

      {user && (
        <section className="relative max-w-3xl mx-auto px-5 sm:px-8 -mt-2 pb-6 space-y-4">
          <StreamStatusWidget />
          <VerifyStreamAccessCard signedIn={!!user} />
        </section>
      )}

      {/* Intro / promo strip — free signup CTA for guests, members entrance for signed-in users */}
      <section className="relative max-w-5xl mx-auto px-5 sm:px-8 -mt-4 pb-10">
        <div className="relative overflow-hidden rounded-3xl border border-[oklch(0.72_0.22_245/0.35)] bg-card/60 backdrop-blur-xl p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.72_0.22_245/0.35),transparent)]" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.55_0.24_300/0.25),transparent)]" />

          <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: "var(--neon-blue-bright)" }}>
            {user ? "Members entrance" : "Welcome to the Syndicate"}
          </p>
          <h2 className="mt-2 font-[Montserrat] font-black text-2xl sm:text-3xl md:text-4xl tracking-tight text-metallic">
            {user
              ? `Back at the decks${profile?.display_name ? `, ${profile.display_name}` : ""}.`
              : `One frequency. ${portalsLabel}. Yours, free.`}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl">
            {user
              ? (() => {
                  const c = profile?.credits ?? 0;
                  if (c <= 0) return `You're out of credits. Top up to keep spinning the ${portalsLabel} — or jump into the free hubs below.`;
                  if (c < 5) return `Only ${c} credit${c === 1 ? "" : "s"} left in the tank — ${portalsLabel} waiting, make 'em count.`;
                  return `You've got ${c} credits loaded and all ${portalsLabel} are warm. Pick a hub or hit the dashboard.`;
                })()
              : (<><OgWordmark suffix="-PORTAL" /> fuses {portalsLabel} — music, jokes, trade signals, outreach, battles, tools and more — into one streetwise hub. Free sign-up — keep your credits, lyrics, scans and chats forever. No card, no nonsense.</>)}
          </p>

          {user && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-[12px] font-bold text-amber-200">
              <Coins className="h-3.5 w-3.5" />
              <span className="tabular-nums">{profile?.credits ?? 0}</span>
              <span className="uppercase tracking-[0.2em] text-[10px] text-amber-200/80">credits</span>
            </div>
          )}

          {!user && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-3 text-[12px] text-white/80">
              <li className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2">
                <Gift className="h-3.5 w-3.5 text-[oklch(0.72_0.22_245)]" />
                5 free credits at signup
              </li>
              <li className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                No card. Cancel any time.
              </li>
              <li className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                All {portalsLabel} unlocked
              </li>
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="btn-glass-blue inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] font-bold text-white"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  My dashboard
                </Link>
                <Link
                  to="/portals"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] font-bold text-white/90 hover:border-[oklch(0.72_0.22_245/0.7)]"
                >
                  Browse portals
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "signup" } as never}
                  className="btn-glass-blue inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] font-bold text-white"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Create free account
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] font-bold text-white/90 hover:border-[oklch(0.72_0.22_245/0.7)]"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Members enter
                </Link>
              </>
            )}
          </div>

          <QuickJumpMenu user={!!user} />
        </div>
      </section>

      {isVipMember && <OgVaultAccessSection isBoss={isBoss} />}
      {isVipMember && <VipPortalExplorer customHubs={customHubs} />}

      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-28 grid gap-6 md:gap-8 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {portals.map(({ to, title, desc, Icon }) => {
          const thisPending = pendingTo === to;
          const dimmed = pendingTo !== null && !thisPending;
          return (
          <TiltCard
            key={to}
            className={`group relative overflow-hidden rounded-2xl transition-opacity duration-200 ${dimmed ? "opacity-40 pointer-events-none" : ""}`}
          >
          <Link
            to={to}
            onClick={() => setPendingTo(to)}
            aria-busy={thisPending || undefined}
            className={`block relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-10 transition-all duration-500 animate-pulse-gold hover:-translate-y-1 hover:shadow-[0_0_80px_-10px_oklch(0.72_0.22_245_/_0.8)] hover:border-[oklch(0.72_0.22_245/0.7)] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-[oklch(0.72_0.22_245)] focus-visible:-translate-y-1 focus-visible:border-[oklch(0.72_0.22_245/0.7)] focus-visible:shadow-[0_0_80px_-10px_oklch(0.72_0.22_245_/_0.8)] active:translate-y-0 active:scale-[0.98] active:shadow-[0_0_40px_-10px_oklch(0.72_0.22_245_/_0.6)] ${thisPending ? "border-[oklch(0.72_0.22_245/0.8)] shadow-[0_0_60px_-10px_oklch(0.72_0.22_245/0.8)] animate-pulse" : ""}`}
            style={{ transform: "translateZ(40px)" }}
          >
            <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: "radial-gradient(500px circle at 50% 0%, oklch(0.72 0.22 245 / 0.28), transparent 60%)" }}
            />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center transition-colors group-hover:shadow-[0_0_25px_oklch(0.72_0.22_245/0.7)]">
                <Icon className="h-6 w-6 neon-icon" />
              </div>
              <ArrowUpRight className="h-5 w-5 neon-icon" />
            </div>
            <h2 className="mt-10 font-[Montserrat] font-black text-3xl sm:text-4xl tracking-tight text-metallic">
              {title}
            </h2>
            <p className="mt-3 text-base sm:text-base font-semibold text-foreground/95 leading-relaxed">{desc}</p>
            <div
              className="mt-8 btn-glass-blue btn-magnetic inline-flex items-center gap-2 px-4 sm:px-5 py-3 rounded-lg uppercase font-bold text-white whitespace-nowrap max-w-full"
              style={{
                fontSize: "clamp(0.62rem, 2.4vw, 0.75rem)",
                lineHeight: 1,
                letterSpacing: "clamp(0.08em, 0.6vw, 0.25em)",
              }}
            >
              {thisPending ? (
                "Opening…"
              ) : (
                <span className="inline-flex items-center whitespace-nowrap leading-none">
                  <span className="inline-flex items-center leading-none">
                    <TrackingEye
                      variant="ice"
                      bloodshot
                      pupilRatio={0.5}
                      travelRatio={0.22}
                      className="w-[0.78em] h-[0.78em] shrink-0 -mt-px"
                    />
                    <span className="leading-none">pen</span>
                  </span>
                  <span aria-hidden>&nbsp;</span>
                  <span className="inline-flex items-center leading-none">
                    <span className="leading-none">P</span>
                    <TrackingEye
                      variant="ice"
                      bloodshot
                      pupilRatio={0.5}
                      travelRatio={0.22}
                      className="w-[0.78em] h-[0.78em] shrink-0 -mt-px"
                    />
                    <span className="leading-none">rtal</span>
                  </span>
                </span>
              )}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>
          </TiltCard>
          );
        })}
        {customHubs.map((h) => {
          const Icon = ICONS[h.icon] ?? Sparkles;
          const accent = h.accent || "#3ad6ff";
          const isExternal = /^https?:\/\//i.test(h.href);
          const cardCls =
            "group relative overflow-hidden rounded-2xl border bg-card p-8 sm:p-10 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_60px_-10px_var(--hub-accent)] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-[var(--hub-accent)] focus-visible:-translate-y-1 focus-visible:shadow-[0_0_60px_-10px_var(--hub-accent)] active:translate-y-0 active:scale-[0.98]";
          const inner = (
            <>
              <div
                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(500px circle at 50% 0%, ${accent}44, transparent 60%)` }}
              />
              <div className="flex items-center justify-between">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${accent}1f`, color: accent }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="mt-10 font-[Montserrat] font-black text-3xl sm:text-4xl tracking-tight text-metallic">
                {h.title}
              </h2>
              <p className="mt-3 text-base sm:text-base font-semibold text-foreground/95 leading-relaxed">{h.tagline}</p>
              <div className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-lg text-xs uppercase tracking-[0.25em] font-bold text-white"
                style={{ background: `${accent}26`, border: `1px solid ${accent}66` }}>
                Open Hub
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </>
          );
          return isExternal ? (
            <a key={h.id} href={h.href} target="_blank" rel="noopener noreferrer"
              className={cardCls} style={{ borderColor: `${accent}55`, ["--hub-accent" as any]: accent }}>
              {inner}
            </a>
          ) : (
            <Link key={h.id} to={h.href as any} className={cardCls} style={{ borderColor: `${accent}55`, ["--hub-accent" as any]: accent }}>
              {inner}
            </Link>
          );
        })}
      </section>

      <SyndicateGallery />
      <WelcomeAuthPrompt />
      <QuickJumpDrawer user={!!user} />

      <button
        type="button"
        onClick={() => setVaultOpen(true)}
        className="fixed bottom-3 left-3 z-50 inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.72_0.22_245/0.4)] bg-black/60 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 backdrop-blur-md hover:text-white hover:border-[oklch(0.72_0.22_245/0.8)] hover:shadow-[0_0_18px_-4px_oklch(0.72_0.22_245/0.8)]"
        aria-label="Open vault login"
      >
        <Flame className="h-3 w-3" style={{ color: "var(--neon-blue-bright)" }} />
        vault log in
      </button>
      <VaultLoginModal open={vaultOpen} onClose={() => setVaultOpen(false)} />
    </main>
  );
}

type QuickItem = {
  to: string;
  title: string;
  desc: string;
  Icon: typeof Music2;
  tint: string;
  badge?: string;
};

const PORTAL_ITEMS: QuickItem[] = [
  { to: "/music",   title: "MusicHUB",   desc: "Stream & spawn",   Icon: Music2,      tint: "oklch(0.72 0.22 245)" },
  { to: "/jokes",   title: "JokesHUB",   desc: "Fast wit",         Icon: Smile,       tint: "oklch(0.78 0.18 85)" },
  { to: "/trade",   title: "TradeHUB",   desc: "Live signals",     Icon: TrendingUp,  tint: "oklch(0.70 0.20 145)" },
  { to: "/connect", title: "ConnectHUB", desc: "Scout & reach",    Icon: Rocket,      tint: "oklch(0.65 0.22 295)" },
  { to: "/battle",  title: "BattleHUB",  desc: "Pick a side",      Icon: Swords,      tint: "oklch(0.65 0.24 25)" },
  { to: "/tools",   title: "ToolHUB",    desc: "Sharp utilities",  Icon: Wrench,      tint: "oklch(0.70 0.18 180)" },
];

const MEMBER_ITEMS: QuickItem[] = [
  { to: "/dashboard", title: "Dashboard", desc: "Your control deck", Icon: LayoutDashboard, tint: "oklch(0.72 0.22 245)" },
  { to: "/store",     title: "Top up",    desc: "Add credits",       Icon: Store,           tint: "oklch(0.78 0.18 85)", badge: "Buy" },
  { to: "/vip",       title: "VIP",       desc: "Unlock perks",      Icon: Crown,           tint: "oklch(0.78 0.18 85)" },
  { to: "/syndicate", title: "Syndicate", desc: "Live frequency",    Icon: Users,           tint: "oklch(0.70 0.18 180)" },
];

function QuickJumpMenu({ user }: { user: boolean }) {
  const [tab, setTab] = useState<"portals" | "member">("portals");
  const items = tab === "portals" ? PORTAL_ITEMS : MEMBER_ITEMS;
  return (
    <nav aria-labelledby="quick-jump-label" className="mt-5 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2
          id="quick-jump-label"
          className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold"
        >
          Quick jump
        </h2>
        {user && (
          <div role="tablist" aria-label="Quick jump category" className="inline-flex rounded-full border border-white/10 bg-black/40 p-0.5 text-[10px] font-bold uppercase tracking-[0.2em]">
            {(["portals", "member"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full transition-colors ${tab === t ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}
              >
                {t === "portals" ? "Portals" : "Members"}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul role="list" className="grid grid-cols-2 sm:grid-cols-3 gap-2 list-none p-0 m-0">
        {items.map(({ to, title, desc, Icon, tint, badge }) => (
          <li key={to} className="contents">
            <Link
              to={to as never}
              aria-label={`${title} — ${desc}`}
              className="group relative flex items-center gap-2.5 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:bg-white/5 hover:border-[var(--ql-tint)] hover:shadow-[0_0_24px_-6px_var(--ql-tint)] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ql-tint)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ ["--ql-tint" as any]: tint }}
              activeProps={{
                "aria-current": "page",
                className:
                  "group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all border-[var(--ql-tint)] bg-[color-mix(in_oklab,var(--ql-tint)_15%,transparent)] shadow-[0_0_20px_-4px_var(--ql-tint)] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ql-tint)] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              }}
            >
              <span
                className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in oklab, ${tint} 18%, transparent)`, color: tint }}
              >
                <Icon aria-hidden="true" focusable="false" className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-[0.15em] text-white truncate">
                  {title}
                </span>
                <span className="block text-[10px] font-semibold text-white/60 truncate">
                  {desc}
                </span>
              </span>
              {badge ? (
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: `color-mix(in oklab, ${tint} 25%, transparent)`, color: tint }}
                >
                  {badge}
                </span>
              ) : (
                <ArrowUpRight aria-hidden="true" focusable="false" className="h-3.5 w-3.5 text-white/40 group-hover:text-white transition-colors" />
              )}
            </Link>
          </li>
        ))}
        {!user && (
          <li className="contents">
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              aria-label="Create a free account — 5 credits on signup"
              className="group relative flex items-center gap-2.5 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:bg-amber-300/20 hover:shadow-[0_0_24px_-6px_oklch(0.78_0.18_85)] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <span className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center bg-amber-300/20 text-amber-200">
                <Gift aria-hidden="true" focusable="false" className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-[0.15em] text-amber-100 truncate">
                  Free signup
                </span>
                <span className="block text-[10px] font-semibold text-amber-200/80 truncate">
                  +5 credits, no card
                </span>
              </span>
              <ArrowUpRight aria-hidden="true" focusable="false" className="h-3.5 w-3.5 text-amber-200" />
            </Link>
          </li>
        )}
        {!user && (
          <li className="contents">
            <Link
              to="/auth"
              aria-label="Sign in to your account"
              className="group relative flex items-center gap-2.5 rounded-xl border border-[oklch(0.72_0.22_245/0.4)] bg-[oklch(0.72_0.22_245/0.1)] px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:bg-[oklch(0.72_0.22_245/0.2)] hover:shadow-[0_0_24px_-6px_oklch(0.72_0.22_245)] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.22_245)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <span className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center bg-[oklch(0.72_0.22_245/0.2)] text-[oklch(0.85_0.15_245)]">
                <LogIn aria-hidden="true" focusable="false" className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-[0.15em] text-white truncate">
                  Sign in
                </span>
                <span className="block text-[10px] font-semibold text-white/70 truncate">
                  Members entrance
                </span>
              </span>
              <ArrowUpRight aria-hidden="true" focusable="false" className="h-3.5 w-3.5 text-[oklch(0.85_0.15_245)]" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

