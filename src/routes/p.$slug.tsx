import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lock, Loader2, Radio, BadgeCheck, Send, Crown, Satellite, RefreshCw, ExternalLink, Gauge, TrendingUp, TrendingDown, Activity, Calculator, Sparkles, Mail, Copy, Share2, X } from "lucide-react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { createPortalUnlockCheckout, getPortalUnlockStatus } from "@/lib/portals.functions";
import { chargePortalUse } from "@/lib/portal-use.functions";
import { refreshNewsScout, type NewsScoutMeta, type NewsArticle } from "@/lib/news.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { TVStaticLogo } from "@/components/TVStaticLogo";
import { PortalMascot } from "@/components/PortalMascot";
import { OgWordmark } from "@/components/OgWordmark";
import { TradingViewChart, TradingViewTickerTape } from "@/components/TradingViewWidgets";
import { LiveDataIcon } from "@/components/LiveDataIcon";
import { SwearChatPanel } from "@/components/SwearChatPanel";

type ThemeConfig = {
  bgGradient?: string;
  accent?: string;
  secondary?: string;
  text?: string;
  fontFamily?: string;
  ornament?: string;
  label?: string;
  animation?: "shake" | "pulse" | "explode" | "glow";
  hitButton?: string;
  fontPair?: { heading?: string; body?: string };
  vibeLabel?: string;
  particleColors?: string[];
};

type Portal = {
  id: string;
  slug: string;
  name: string;
  niche: string;
  language: string;
  vibe: string | null;
  theme: string;
  jokes: string[];
  music_hooks: string[];
  trade_briefs: string[];
  connect_openers: string[];
  tool_ideas: string[];
  vip: boolean;
  price_cents: number;
  theme_config: ThemeConfig;
  kind: string;
  scout_meta: { sources?: string[]; headlines?: string[] };
  use_credit_cost?: number;
  telegram_config: {
    groupLink?: string | null;
    vipLink?: string | null;
    botUsername?: string | null;
    brand?: { brandName?: string; logoEmoji?: string };
  } | null;
  bg_video_url?: string | null;
  bg_video_aspect?: string | null;
  swear_chat_enabled?: boolean;
};

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("portals")
      .select("id, slug, name, niche, language, vibe, theme, jokes, music_hooks, trade_briefs, connect_openers, tool_ideas, vip, price_cents, theme_config, scout_meta, telegram_config, kind, audio_snippet_url, bg_video_url, bg_video_aspect, swear_chat_enabled, use_credit_cost")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();
    return { portal: data as unknown as Portal };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.portal
      ? [
          { title: `${loaderData.portal.name} · 0G-PORTAL` },
          { name: "description", content: loaderData.portal.niche.slice(0, 160) },
        ]
      : [],
  }),
  component: PortalPage,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">Portal failed to load</h1>
        <p className="text-muted-foreground text-sm">{error.message}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #0a1530 0%, #050810 60%, #000 100%)" }}
    >
      <div className="tv-static-overlay opacity-40" />
      <div className="scan-overlay" />
      <div className="relative z-10 max-w-xl w-full text-center electric-border rounded-2xl p-10 bg-black/60 backdrop-blur-sm">
        <div className="text-[10px] tracking-[0.5em] text-cyan-300/70 mb-3 inline-flex items-center gap-1">// <OgWordmark suffix="-PORTAL" /> DIAGNOSTIC</div>
        <h1 className="font-mono text-5xl md:text-6xl font-black tracking-tight text-cyan-200 animate-glitch" style={{ textShadow: "0 0 24px rgba(120,200,255,0.55)" }}>
          404
        </h1>
        <div className="mt-2 text-xl md:text-2xl font-bold uppercase tracking-[0.3em] text-white">Signal Lost</div>
        <p className="mt-5 text-sm text-cyan-100/60 leading-relaxed">
          The transmission you requested is not broadcasting on this frequency.<br />
          The portal may have been re-routed, decommissioned, or never existed.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="px-5 py-2.5 rounded-md bg-cyan-400 text-black text-xs font-bold tracking-widest uppercase hover:bg-cyan-300 transition-colors"
          >
            Return to Mainframe
          </Link>
        </div>
        <div className="mt-6 text-[10px] font-mono text-cyan-400/40">ERR_PORTAL_NOT_FOUND · 0G://void</div>
      </div>
    </main>
  ),
});

const PRESETS: Record<string, ThemeConfig> = {
  street:         { bgGradient: "linear-gradient(180deg, #0a0a0a, #1a1a1a)", accent: "#ff3b3b", secondary: "#ffb800", text: "#fff",    fontFamily: "'Bebas Neue', Impact, sans-serif", ornament: "🚧", label: "STREET CODE",  animation: "shake",   hitButton: "HIT ME" },
  "ancient-china":{ bgGradient: "linear-gradient(180deg, #2a0a0a, #4a1a0a)", accent: "#d4af37", secondary: "#ff5544", text: "#fdf6e3", fontFamily: "'Noto Serif SC', serif",            ornament: "龍",  label: "古卷",         animation: "glow",    hitButton: "出招" },
  cyber:          { bgGradient: "linear-gradient(180deg, #050018, #1a0033)", accent: "#00ffea", secondary: "#ff00aa", text: "#e0f7ff", fontFamily: "'Orbitron', sans-serif",            ornament: "◆",   label: "// NODE",      animation: "pulse",   hitButton: "EXECUTE" },
  desert:         { bgGradient: "linear-gradient(180deg, #2a1a05, #5a3a15)", accent: "#e8c468", secondary: "#ff8844", text: "#fff5dd", fontFamily: "'Amiri', serif",                    ornament: "☾",   label: "حكاية",        animation: "glow",    hitButton: "اضرب" },
  norse:          { bgGradient: "linear-gradient(180deg, #0a1014, #1a2530)", accent: "#a8c8e0", secondary: "#88ddff", text: "#e8f0f8", fontFamily: "'Cinzel', serif",                   ornament: "ᚱ",   label: "SAGA",         animation: "explode", hitButton: "STRIKE" },
  jungle:         { bgGradient: "linear-gradient(180deg, #0a2010, #1a4525)", accent: "#ffd54f", secondary: "#88ff88", text: "#f0fff0", fontFamily: "'Fredoka', sans-serif",             ornament: "🌿",  label: "TRIBE",        animation: "pulse",   hitButton: "GO" },
};

function mergeTheme(portal: Portal): Required<Omit<ThemeConfig, "fontPair" | "vibeLabel" | "particleColors">> {
  const base = PRESETS[portal.theme] ?? PRESETS.street;
  const cfg = portal.theme_config ?? {};
  return {
    bgGradient:  cfg.bgGradient  || base.bgGradient!,
    accent:      cfg.accent      || base.accent!,
    secondary:   cfg.secondary   || base.secondary!,
    text:        cfg.text        || base.text!,
    fontFamily:  cfg.fontFamily  || base.fontFamily!,
    ornament:    cfg.ornament    || base.ornament!,
    label:       cfg.label       || base.label!,
    animation:   (cfg.animation as any) || base.animation!,
    hitButton:   cfg.hitButton   || base.hitButton!,
  };
}

const HIT_ANIMS: Record<string, any> = {
  shake:   { x: [0, -8, 8, -6, 6, 0],            transition: { duration: 0.4 } },
  pulse:   { scale: [1, 1.18, 1],                transition: { duration: 0.35 } },
  glow:    { filter: ["brightness(1)", "brightness(1.6)", "brightness(1)"], transition: { duration: 0.6 } },
  explode: { scale: [1, 1.3, 0.95, 1.05, 1], rotate: [0, -5, 5, 0],         transition: { duration: 0.55 } },
};

function PortalPage() {
  const { portal } = Route.useLoaderData();
  if (portal.kind === "news") return <NewsHubView portal={portal} />;
  const T = useMemo(() => mergeTheme(portal), [portal]);
  const fontPair = portal.theme_config?.fontPair;
  const bodyFont = fontPair?.body || "Inter";
  const headingFont = fontPair?.heading;
  const particleColors = portal.theme_config?.particleColors?.length
    ? portal.theme_config.particleColors
    : [T.accent, T.secondary];

  // Inject Google Fonts dynamically based on Style Dictionary
  useEffect(() => {
    if (!headingFont && !bodyFont) return;
    const families = [headingFont, bodyFont].filter(Boolean) as string[];
    const familyParam = families
      .map((f) => `family=${encodeURIComponent(f)}:wght@400;700;900`)
      .join("&");
    const id = `gf-${portal.slug}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${familyParam}&display=swap`;
    document.head.appendChild(link);
  }, [headingFont, bodyFont, portal.slug]);

  const { user, profile } = useAuth();
  const isVipMember = profile?.rank === "vip" || profile?.rank === "boss";
  const tg = portal.telegram_config ?? {};
  const groupLink = tg.groupLink || (tg.botUsername ? `https://t.me/${tg.botUsername}` : null);
  const vipLink = tg.vipLink || null;
  const checkoutFn = useServerFn(createPortalUnlockCheckout);
  const statusFn = useServerFn(getPortalUnlockStatus);
  const chargeUseFn = useServerFn(chargePortalUse);
  const navigate = useNavigate();

  const [idx, setIdx] = useState(0);
  const [hits, setHits] = useState(0);
  const [owned, setOwned] = useState<boolean>(!portal.vip);
  const [unlocking, setUnlocking] = useState(false);
  const [charging, setCharging] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sharedIdea, setSharedIdea] = useState<string | null>(null);
  const controls = useAnimationControls();
  const seedsByKind: Record<string, string[] | undefined> = {
    music: portal.music_hooks,
    trade: portal.trade_briefs,
    connect: portal.connect_openers,
    tools: portal.tool_ideas,
  };
  const kindSeeds = seedsByKind[portal.kind];
  const seeds = (kindSeeds && kindSeeds.length ? kindSeeds : portal.jokes) ?? [];
  const jokes = seeds.length ? seeds : ["No content loaded yet."];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSnippet = (portal as any).audio_snippet_url as string | null | undefined;
  const hitContainerRef = useRef<HTMLDivElement | null>(null);

  // Lead tracking: increment view counter on mount
  useEffect(() => {
    supabase.rpc("increment_portal_view", { _slug: portal.slug }).then(() => {});
    import("@/lib/track-view").then((m) => m.trackPortalView("portal", portal.slug));
  }, [portal.slug]);

  useEffect(() => {
    if (!portal.vip) { setOwned(true); return; }
    if (!user) { setOwned(false); return; }
    statusFn({ data: { portalId: portal.id } })
      .then((r) => setOwned(r.owned))
      .catch(() => setOwned(false));
  }, [portal.id, portal.vip, user, statusFn]);

  const spawnParticles = (origin: { x: number; y: number }) => {
    const host = hitContainerRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const x = origin.x - rect.left;
    const y = origin.y - rect.top;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("span");
      const color = particleColors[i % particleColors.length];
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 90;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:8px;height:8px;border-radius:9999px;background:${color};box-shadow:0 0 14px ${color};pointer-events:none;transform:translate(-50%,-50%);transition:transform 700ms cubic-bezier(.2,.7,.3,1),opacity 700ms ease-out;opacity:1;z-index:30;`;
      host.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
        p.style.opacity = "0";
      });
      setTimeout(() => p.remove(), 750);
    }
  };

  const useCost = Math.max(0, Math.floor(Number(portal.use_credit_cost) || 0));

  const hit = async (e?: React.MouseEvent) => {
    if (!owned) {
      startUnlock();
      return;
    }
    // Charge per-action coin cost if configured. Anonymous users are sent to
    // sign in; insufficient balance redirects to the credits top-up page.
    if (useCost > 0) {
      if (!user) { toast.error("Sign in to use this portal"); return; }
      if (charging) return;
      const captured = e ? { x: e.clientX, y: e.clientY } : null;
      setCharging(true);
      try {
        const r = await chargeUseFn({ data: { slug: portal.slug } });
        if (!r.ok) {
          if (r.error === "insufficient") {
            toast.error(`Need ${useCost} 🪙 to use this portal — top up to continue`);
            navigate({ to: "/wallet" });
          } else {
            toast.error(r.error || "Could not charge credits");
          }
          return;
        }
        setIdx((i) => (i + 1) % jokes.length);
        setHits((h) => h + 1);
        controls.start(HIT_ANIMS[T.animation] ?? HIT_ANIMS.pulse);
        if (captured) spawnParticles(captured);
      } finally {
        setCharging(false);
      }
      return;
    }
    setIdx((i) => (i + 1) % jokes.length);
    setHits((h) => h + 1);
    controls.start(HIT_ANIMS[T.animation] ?? HIT_ANIMS.pulse);
    if (e) spawnParticles({ x: e.clientX, y: e.clientY });
  };

  const startUnlock = async () => {
    if (!user) { toast.error("Sign in to unlock"); return; }
    setUnlocking(true);
    try {
      const cs = await checkoutFn({
        data: {
          portalId: portal.id,
          environment: getStripeEnvironment(),
          customerEmail: user.email,
          returnUrl: `${window.location.href.split("?")[0]}?unlocked=1&session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      setClientSecret(cs);
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div
      style={{ background: T.bgGradient, color: T.text, minHeight: "100vh", fontFamily: `'${bodyFont}', system-ui, sans-serif` }}
      className="relative flex flex-col overflow-hidden"
    >
      {/* Gritty texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
           style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/></svg>\")" }} />

      {/* Logo corner */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <PortalMascot kind={portal.kind} accent={T.accent} secondary={T.secondary} className="h-10 w-10" />
        <span className="text-[10px] uppercase tracking-[0.4em] opacity-70" style={{ color: T.accent }}>
          0G{portal.theme_config?.vibeLabel ? ` · ${portal.theme_config.vibeLabel}` : ""}
        </span>
      </div>

      {/* Live status */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
           style={{ borderColor: `${T.accent}66`, background: "rgba(0,0,0,0.45)" }}>
        <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <Radio className="h-3 w-3" style={{ color: T.accent }} />
        </motion.span>
        <span className="text-[9px] uppercase tracking-[0.35em]" style={{ color: T.accent }}>
          LIVE · 0G-AI Agent
        </span>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-5 py-24 max-w-3xl mx-auto w-full">
        <Link to="/" className="absolute top-20 left-5 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.5em] opacity-70" style={{ color: T.accent }}>
            {T.label} · {portal.language}
          </p>
          <h1
            className="mt-3 text-4xl sm:text-6xl font-black leading-tight"
            style={{ fontFamily: T.fontFamily, textShadow: `0 0 40px ${T.accent}88` }}
          >
            <span className="mr-3" style={{ color: T.accent }}>{T.ornament}</span>
            {portal.name}
            <span className="ml-3" style={{ color: T.accent }}>{T.ornament}</span>
          </h1>
          <p className="mt-3 text-sm opacity-70 max-w-xl mx-auto">{portal.niche}</p>
          {portal.vip && (
            <p className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] px-2 py-0.5 rounded-full border" style={{ color: T.accent, borderColor: `${T.accent}77` }}>
              <BadgeCheck className="h-3 w-3" /> VIP Portal
            </p>
          )}
        </div>

        {/* Joke card */}
        <motion.div
          animate={controls}
          className="w-full rounded-2xl p-8 sm:p-12 border min-h-[220px] flex items-center justify-center relative"
          style={{
            background: `linear-gradient(135deg, ${T.accent}10, ${T.secondary}08)`,
            borderColor: `${T.accent}55`,
            boxShadow: `0 0 80px ${T.accent}33, inset 0 0 40px ${T.accent}11`,
          }}
        >
          {!owned && portal.vip ? (
            <div className="text-center">
              <Lock className="h-8 w-8 mx-auto mb-3" style={{ color: T.accent }} />
              <p className="text-lg font-bold" style={{ fontFamily: T.fontFamily }}>VIP Portal Locked</p>
              <p className="text-sm opacity-70 mt-1">Unlock for £{(portal.price_cents / 100).toFixed(2)} ({Math.round(portal.price_cents / 100)} 🪙)</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.p
                key={idx}
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
                transition={{ duration: 0.35 }}
                className="text-xl sm:text-2xl text-center leading-relaxed"
                style={{ fontFamily: T.fontFamily }}
              >
                {jokes[idx]}
              </motion.p>
            </AnimatePresence>
          )}
        </motion.div>

        {/* HIT ME button */}
        <motion.div whileTap={{ scale: 0.95 }} ref={hitContainerRef} className="mt-10 w-full max-w-md relative">
          <Button
            onClick={hit}
            disabled={unlocking || charging}
            className="h-20 w-full text-2xl uppercase tracking-[0.4em] font-black border-4 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${T.accent}, ${T.secondary})`,
              color: "#000",
              borderColor: T.accent,
              fontFamily: T.fontFamily,
              boxShadow: `0 0 80px ${T.accent}99, inset 0 0 30px rgba(255,255,255,0.25)`,
            }}
          >
            {unlocking || charging ? (
              <><Loader2 className="h-6 w-6 mr-2 animate-spin" />…</>
            ) : !owned && portal.vip ? (
              `UNLOCK · £${(portal.price_cents/100).toFixed(2)} (${Math.round(portal.price_cents/100)} 🪙)`
            ) : useCost > 0 ? (
              `${T.hitButton} · ${useCost} 🪙`
            ) : (
              T.hitButton
            )}
          </Button>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] opacity-60">
            {owned
              ? `${hits} hits · ${idx + 1}/${jokes.length}${useCost > 0 ? ` · ${useCost} 🪙 each` : ""}`
              : "Tap to unlock"}
          </p>
        </motion.div>

        {portal.kind === "tools" && owned && jokes.length > 0 && (
          <section
            className="mt-10 w-full rounded-2xl border p-6 backdrop-blur-sm"
            style={{
              borderColor: `${T.accent}55`,
              background: `linear-gradient(135deg, ${T.accent}10, ${T.secondary}06)`,
              boxShadow: `inset 0 0 30px ${T.accent}11`,
            }}
          >
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4" style={{ color: T.accent }} />
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: T.accent }}>
                  Micro-Calculator Ideas
                </p>
              </div>
              <span
                className="text-[10px] uppercase tracking-[0.3em] px-2 py-0.5 rounded-full border"
                style={{ color: T.accent, borderColor: `${T.accent}55` }}
              >
                {jokes.length} seeds
              </span>
            </header>
            <ol className="space-y-3">
              {jokes.map((idea: string, i: number) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-lg border p-3"
                  style={{ borderColor: `${T.accent}33`, background: "rgba(0,0,0,0.25)" }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                    style={{ background: T.accent, color: "#000" }}
                  >
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm leading-relaxed whitespace-pre-line opacity-90">{idea}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSharedIdea(idea);
                      toast.success("Idea staged for Telegram", { description: "Scroll to the Telegram block to send it." });
                      setTimeout(() => {
                        document.getElementById("telegram-share")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 50);
                    }}
                    className="shrink-0 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] uppercase tracking-[0.25em] font-bold hover:opacity-80"
                    style={{ borderColor: `${T.accent}66`, color: T.accent }}
                    aria-label={`Share idea ${i + 1} to Telegram`}
                  >
                    <Share2 className="h-3 w-3" />
                    Share
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[10px] uppercase tracking-[0.3em] opacity-60 flex items-center gap-2">
              <Sparkles className="h-3 w-3" style={{ color: T.accent }} />
              AI-spawned tool concepts · build the next one in ToolHUB
            </p>
          </section>
        )}

        {portal.kind === "connect" && owned && jokes.length > 0 && (
          <section
            className="mt-10 w-full rounded-2xl border p-6 backdrop-blur-sm"
            style={{
              borderColor: `${T.accent}55`,
              background: `linear-gradient(135deg, ${T.accent}10, ${T.secondary}06)`,
              boxShadow: `inset 0 0 30px ${T.accent}11`,
            }}
          >
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" style={{ color: T.accent }} />
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: T.accent }}>
                  Cold-Outreach Openers
                </p>
              </div>
              <span
                className="text-[10px] uppercase tracking-[0.3em] px-2 py-0.5 rounded-full border"
                style={{ color: T.accent, borderColor: `${T.accent}55` }}
              >
                {jokes.length} lines
              </span>
            </header>
            <ol className="space-y-3">
              {jokes.map((opener: string, i: number) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-lg border p-3"
                  style={{ borderColor: `${T.accent}33`, background: "rgba(0,0,0,0.25)" }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                    style={{ background: T.accent, color: "#000" }}
                  >
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm leading-relaxed whitespace-pre-line opacity-90">{opener}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(opener).then(
                        () => toast.success("Opener copied"),
                        () => toast.error("Copy failed"),
                      );
                    }}
                    className="shrink-0 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] uppercase tracking-[0.25em] font-bold hover:opacity-80"
                    style={{ borderColor: `${T.accent}66`, color: T.accent }}
                    aria-label={`Copy opener ${i + 1}`}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[10px] uppercase tracking-[0.3em] opacity-60 flex items-center gap-2">
              <Sparkles className="h-3 w-3" style={{ color: T.accent }} />
              AI-spawned openers · personalize before you send
            </p>
          </section>
        )}

        {(groupLink || (isVipMember && vipLink)) && (
          <div id="telegram-share" className="mt-8 w-full max-w-md flex flex-col gap-3 scroll-mt-24">
            {sharedIdea && (
              <div
                className="rounded-xl border p-3 flex flex-col gap-2"
                style={{ borderColor: `${T.accent}66`, background: "rgba(0,0,0,0.4)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: T.accent }}>
                    <Share2 className="h-3 w-3" /> Idea staged
                  </span>
                  <button
                    type="button"
                    onClick={() => setSharedIdea(null)}
                    className="opacity-60 hover:opacity-100"
                    aria-label="Clear staged idea"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-line opacity-90">{sharedIdea}</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&text=${encodeURIComponent(`💡 Micro-Calculator Idea from ${portal.name}:\n\n${sharedIdea}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] font-bold"
                    style={{ background: T.accent, color: "#000" }}
                  >
                    <Send className="h-3 w-3" /> Send via Telegram
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sharedIdea).then(
                        () => toast.success("Idea copied"),
                        () => toast.error("Copy failed"),
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] font-bold"
                    style={{ borderColor: `${T.accent}66`, color: T.accent }}
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              </div>
            )}
            {groupLink && (
              <a href={groupLink} target="_blank" rel="noopener noreferrer" className="group">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative overflow-hidden rounded-xl px-5 py-4 flex items-center justify-center gap-3 font-bold uppercase tracking-[0.3em] text-sm border-2"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.55 0.22 245), oklch(0.72 0.22 245))",
                    color: "#fff",
                    borderColor: "oklch(0.85 0.18 245)",
                    boxShadow: "0 0 40px oklch(0.72 0.22 245 / 0.7), inset 0 0 20px oklch(0.95 0.1 245 / 0.3)",
                  }}
                >
                  <motion.span
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "radial-gradient(circle at 50% 120%, oklch(0.95 0.18 245 / 0.5), transparent 60%)" }}
                  />
                  <Send className="h-5 w-5 relative" />
                  <span className="relative">Join the Community</span>
                </motion.div>
              </a>
            )}
            {isVipMember && vipLink && (
              <a href={vipLink} target="_blank" rel="noopener noreferrer">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-xl px-5 py-3 flex items-center justify-center gap-2 font-bold uppercase tracking-[0.3em] text-xs border"
                  style={{
                    background: "linear-gradient(135deg, #0a0a14, #1a1a2e)",
                    color: "oklch(0.9 0.18 245)",
                    borderColor: "oklch(0.72 0.22 245 / 0.6)",
                    boxShadow: "0 0 25px oklch(0.72 0.22 245 / 0.4)",
                  }}
                >
                  <Crown className="h-4 w-4" />
                  Exclusive VIP Telegram
                </motion.div>
              </a>
            )}
            {!isVipMember && vipLink && (
              <p className="text-center text-[10px] uppercase tracking-[0.3em] opacity-50">
                <Crown className="inline h-3 w-3 mr-1" /> VIP / Boss rank required for exclusive Telegram
              </p>
            )}
          </div>
        )}

        <audio ref={audioRef} preload="none" />
      </div>

      {audioSnippet && (
        <div className="relative max-w-3xl mx-auto w-full px-5 pb-8">
          <div
            className="rounded-xl p-3 flex items-center gap-3 border-2 backdrop-blur-sm"
            style={{
              background: `linear-gradient(135deg, #1a1a1a, #2a2a2a)`,
              borderColor: `${T.accent}88`,
              boxShadow: `0 0 30px ${T.accent}44, inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}
          >
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold px-2 py-1 rounded border" style={{ color: T.accent, borderColor: `${T.accent}66` }}>
              30s
            </span>
            <audio
              controls
              src={audioSnippet}
              className="flex-1 h-9"
              style={{ filter: "invert(1) hue-rotate(180deg) saturate(0.6)" }}
            />
          </div>
        </div>
      )}

      <footer className="relative border-t py-6 text-center text-xs uppercase tracking-[0.4em] opacity-60" style={{ borderColor: `${T.accent}33` }}>
        <Link to="/" className="hover:opacity-100 inline-flex items-center gap-2">
          <span style={{ color: T.accent }}>▣</span> Powered by <OgWordmark suffix="-PORTAL" />
        </Link>
      </footer>

      <div className="max-w-3xl mx-auto px-5 pb-8">
        <SwearChatPanel
          enabled={!!portal.swear_chat_enabled}
          table="portals"
          id={portal.id}
          slug={portal.slug}
          accent={T.accent}
        />
      </div>

      {clientSecret && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setClientSecret(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2">
              <button className="text-sm text-gray-500 px-3 py-1" onClick={() => { setClientSecret(null); setOwned(true); }}>Done</button>
            </div>
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// News Intelligence View — /p/[slug] when kind === "news"
// ═══════════════════════════════════════════════════════════════
function NewsHubView({ portal }: { portal: Portal }) {
  const meta = (portal.scout_meta || {}) as Partial<NewsScoutMeta>;
  const bias = (meta.bias as "bad" | "good" | "neutral") || "neutral";
  const T = portal.theme_config as any;
  const accent: string = T?.accent || (bias === "bad" ? "#ff2233" : bias === "good" ? "#00e08a" : "#9aa0ff");
  const secondary: string = T?.secondary || "#ffffff";
  const text: string = T?.text || "#fff";
  const bgGradient: string = T?.bgGradient || "linear-gradient(180deg,#0a0a0e,#050507)";
  const headingFont: string = T?.fontPair?.heading || "Oswald";
  const bodyFont: string = T?.fontPair?.body || "JetBrains Mono";

  const { user, profile } = useAuth();
  const isVip = profile?.rank === "vip" || profile?.rank === "boss";
  const checkoutFn = useServerFn(createPortalUnlockCheckout);
  const statusFn = useServerFn(getPortalUnlockStatus);
  const refreshFn = useServerFn(refreshNewsScout);

  const [data, setData] = useState<Partial<NewsScoutMeta>>(meta);
  const [scanning, setScanning] = useState(false);
  const [owned, setOwned] = useState<boolean>(!portal.vip);
  const [unlocking, setUnlocking] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const articles: NewsArticle[] = (data.articles as NewsArticle[]) ?? [];

  // Inject fonts
  useEffect(() => {
    const id = `gf-news-${portal.slug}`;
    if (document.getElementById(id)) return;
    const families = [headingFont, bodyFont].filter(Boolean) as string[];
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f)}:wght@400;700;900`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }, [headingFont, bodyFont, portal.slug]);

  // View tracking
  useEffect(() => {
    supabase.rpc("increment_portal_view", { _slug: portal.slug }).then(() => {});
    import("@/lib/track-view").then((m) => m.trackPortalView("portal", portal.slug));
  }, [portal.slug]);

  // VIP unlock state
  useEffect(() => {
    if (!portal.vip) { setOwned(true); return; }
    if (!user) { setOwned(false); return; }
    statusFn({ data: { portalId: portal.id } }).then((r) => setOwned(r.owned)).catch(() => setOwned(false));
  }, [portal.id, portal.vip, user, statusFn]);

  // Always-fresh: auto-refresh on every visit
  const runScan = async (silent = false) => {
    if (scanning) return;
    setScanning(true);
    if (!silent) toast.message("Scouting the globe…", { description: "Firecrawl + Perplexity scanning sources." });
    try {
      const r = await refreshFn({ data: { slug: portal.slug } });
      setData(r.meta);
      if (!silent) toast.success(`Updated · ${r.meta.articles.length} articles`);
    } catch (e: any) {
      if (!silent) toast.error(e?.message ?? "Scan failed");
    } finally { setScanning(false); }
  };

  useEffect(() => {
    // Auto refresh once on mount (debounced if just scanned)
    const last = data.scanned_at ? Date.parse(data.scanned_at) : 0;
    if (Date.now() - last > 60_000) {
      runScan(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal.slug]);

  const startUnlock = async () => {
    if (!user) { toast.error("Sign in to unlock VIP analysis"); return; }
    setUnlocking(true);
    try {
      const cs = await checkoutFn({ data: { portalId: portal.id, environment: getStripeEnvironment(), customerEmail: user.email, returnUrl: `${window.location.href.split("?")[0]}?unlocked=1&session_id={CHECKOUT_SESSION_ID}` } });
      setClientSecret(cs);
    } catch (e: any) { toast.error(e?.message ?? "Checkout failed"); }
    finally { setUnlocking(false); }
  };

  const showVip = owned || !portal.vip || isVip;
  const headline = data.headline || `${(data.pair || portal.name).toUpperCase()} INTEL DROP`;
  const tagline = data.tagline || "Live market intelligence stream";
  const overall = typeof data.overall_confidence === "number" ? data.overall_confidence : null;
  const tvSymbol = data.tv_symbol || "TVC:DXY";
  const relatedSymbols = data.related_symbols && data.related_symbols.length ? data.related_symbols : ["SP:SPX","OANDA:XAUUSD","TVC:USOIL"];
  const assetCode = data.asset_code || (data.pair || "SIG").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const bullArticles: NewsArticle[] = (data.bull_articles as NewsArticle[]) ?? (bias === "good" ? articles : []);
  const bearArticles: NewsArticle[] = (data.bear_articles as NewsArticle[]) ?? (bias === "bad" ? articles : []);
  const synthesis = data.synthesis;
  const BULL = "#00e08a";
  const BEAR = "#ff2233";

  // Bull market growth pulse vs. emergency alert
  const alertAnim = bias === "bad"
    ? { x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.6, repeat: Infinity, repeatDelay: 1.6 } }
    : bias === "good"
    ? { y: [0, -4, 0], transition: { duration: 1.4, repeat: Infinity } }
    : { opacity: [0.85, 1, 0.85], transition: { duration: 2, repeat: Infinity } };

  return (
    <div style={{ background: bgGradient, color: text, minHeight: "100vh", fontFamily: `'${bodyFont}', monospace` }} className="relative overflow-hidden">
      {/* 0G-CINEMA · Veo 3.1 cinematic background */}
      {portal.bg_video_url && (
        <>
          <video
            key={portal.bg_video_url}
            src={portal.bg_video_url}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
            style={{ opacity: 0.55 }}
          />
          <div className="absolute inset-0 z-0 pointer-events-none"
            style={{ background: `linear-gradient(180deg, ${bgGradient.includes('#14060a') ? 'rgba(20,6,10,0.55)' : bgGradient.includes('#02150f') ? 'rgba(2,21,15,0.55)' : 'rgba(0,0,0,0.55)'} 0%, rgba(0,0,0,0.75) 100%)` }} />
        </>
      )}
      {/* Grid scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{ backgroundImage: `linear-gradient(${accent}33 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/></svg>\")" }} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 border-b" style={{ borderColor: `${accent}33` }}>
        <Link to="/" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.4em] opacity-70 hover:opacity-100">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <div className="flex items-center gap-3">
          <LiveDataIcon active={scanning} accent={accent} />
          <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ filter: `drop-shadow(0 0 12px ${accent})` }}>
            <Satellite className="h-4 w-4" style={{ color: accent }} />
          </motion.div>
          <span className="text-[10px] uppercase tracking-[0.4em] inline-flex items-center gap-1" style={{ color: accent }}><OgWordmark suffix="-PORTAL" /> · SCOUTING</span>
          <PortalMascot kind="trade" accent={accent} secondary={secondary} className="h-9 w-9" />
        </div>
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-10">
        {/* Asset DNA watermark */}
        <div aria-hidden className="pointer-events-none fixed inset-0 flex items-center justify-center -z-0 select-none"
          style={{ fontFamily: `'${headingFont}', Impact, sans-serif`, color: accent, opacity: 0.04, fontSize: "min(60vw, 50vh)", fontWeight: 900, letterSpacing: "-0.05em" }}>
          {assetCode}
        </div>

        {/* Headline */}
        <motion.div animate={alertAnim} className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.5em]" style={{ color: accent }}>
            {(T?.label as string) || "INTEL FEED"} · {data.pair || ""} · {(data.bias || "neutral").toUpperCase()}
          </p>
          <h1 className="mt-3 font-black leading-[0.95] uppercase" style={{ fontFamily: `'${headingFont}', Impact, sans-serif`, fontSize: "clamp(2.2rem, 6vw, 4.5rem)", textShadow: `0 0 40px ${accent}88`, letterSpacing: "-0.01em" }}>
            <span className="mr-3" style={{ color: accent }}>{(T?.ornament as string) || "⚠"}</span>
            {headline}
          </h1>
          <p className="mt-3 text-sm sm:text-base opacity-80 max-w-2xl">{tagline}</p>
          {data.context && (
            <p className="mt-2 inline-block px-2 py-0.5 rounded border text-[10px] uppercase tracking-[0.3em]" style={{ color: accent, borderColor: `${accent}66` }}>
              CONTEXT · {data.context}
            </p>
          )}
        </motion.div>

        {/* Ticker tape */}
        <div className="mb-6 rounded-xl border overflow-hidden" style={{ borderColor: `${accent}55`, background: "rgba(0,0,0,0.4)" }}>
          <TradingViewTickerTape symbols={[tvSymbol, ...relatedSymbols]} />
        </div>

        {/* Verified Sources — 0G-BRAIN deep_search citations (last hour) */}
        {(data.verified_sources?.length ?? 0) > 0 && (
          <div className="mb-6 rounded-xl border p-3 sm:p-4" style={{ borderColor: `${accent}44`, background: "rgba(0,0,0,0.45)" }}>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5" style={{ color: accent }} />
                <span className="text-[10px] uppercase tracking-[0.4em]" style={{ color: accent }}>
                  Verified Sources · Last Hour · {data.verified_sources!.length}
                </span>
              </div>
              {data.peer_review && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] uppercase tracking-[0.3em]"
                  style={{
                    color: data.peer_review.verdict === "verified" ? "#00e08a" : data.peer_review.verdict === "partial" ? "#ffb020" : "#ff4d4d",
                    borderColor: (data.peer_review.verdict === "verified" ? "#00e08a" : data.peer_review.verdict === "partial" ? "#ffb020" : "#ff4d4d") + "66",
                  }}
                  title={data.peer_review.notes}
                >
                  Peer-Review · {data.peer_review.verdict} · {data.peer_review.confidence}%
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {data.verified_sources!.slice(0, 12).map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.25em] hover:opacity-100 opacity-90 transition"
                  style={{ color: text, borderColor: `${accent}55`, background: `${accent}0d` }}
                >
                  <BadgeCheck className="h-3 w-3" style={{ color: accent }} />
                  {s.source}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Live Pulse — TradingView */}
        <div className="mb-8 rounded-xl border overflow-hidden" style={{ borderColor: `${accent}55`, boxShadow: `0 0 30px ${accent}22` }}>
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: `${accent}33`, background: "rgba(0,0,0,0.6)" }}>
            <span className="text-[10px] uppercase tracking-[0.4em]" style={{ color: accent }}><Activity className="inline h-3 w-3 mr-2" />Live Pulse · {tvSymbol}</span>
            <span className="text-[10px] uppercase tracking-[0.3em] opacity-60">100 / 200 SMA · Dark Theme</span>
          </div>
          <TradingViewChart symbol={tvSymbol} height={460} />
        </div>

        {/* Scan button + last-scan stamp */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <Button onClick={() => runScan(false)} disabled={scanning} className="h-12 px-6 text-sm uppercase tracking-[0.35em] font-black border-2 rounded-xl"
            style={{ background: `linear-gradient(135deg, ${accent}, ${secondary})`, color: "#000", borderColor: accent, boxShadow: `0 0 40px ${accent}88` }}>
            {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />SCANNING…</> : <><RefreshCw className="h-4 w-4 mr-2" />RE-SCAN GLOBAL INTEL</>}
          </Button>
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 flex items-center gap-2">
            {data.scanned_at ? `Last scan · ${new Date(data.scanned_at).toLocaleTimeString()}` : "Awaiting first scan"}
            {showVip && overall !== null && (
              <span className="ml-3 inline-flex items-center gap-1 px-2 py-1 rounded border" style={{ color: accent, borderColor: `${accent}66` }}>
                <Gauge className="h-3 w-3" /> Confidence {overall}/100
              </span>
            )}
          </div>
        </div>

        {/* Conflict Arena — Bull vs Bear dual columns */}
        <div className="grid lg:grid-cols-2 gap-5">
          <ConflictColumn side="bull" articles={bullArticles} headingFont={headingFont} text={text}
            showVip={showVip} startUnlock={startUnlock} unlocking={unlocking} priceCents={portal.price_cents} />
          <ConflictColumn side="bear" articles={bearArticles} headingFont={headingFont} text={text}
            showVip={showVip} startUnlock={startUnlock} unlocking={unlocking} priceCents={portal.price_cents} />
        </div>

        {/* Synthesis — VIP gated */}
        {synthesis && (
          <div className="mt-10 rounded-2xl border p-5 sm:p-7" style={{ borderColor: `${accent}66`, background: "linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.3))", boxShadow: `inset 0 0 40px ${accent}11` }}>
            <div className="flex items-center gap-2 mb-4">
              <Satellite className="h-4 w-4" style={{ color: accent }} />
              <span className="text-[10px] uppercase tracking-[0.5em] font-bold" style={{ color: accent }}>Agent Synthesis · Scenario Matrix</span>
            </div>

            {showVip ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3 mb-5">
                  <div className="rounded-lg border p-4" style={{ borderColor: `${BULL}55`, background: `${BULL}0d` }}>
                    <p className="text-[10px] uppercase tracking-[0.4em] font-bold mb-1" style={{ color: BULL }}>SUPPORT</p>
                    <p className="text-sm leading-relaxed">{synthesis.support}</p>
                  </div>
                  <div className="rounded-lg border p-4" style={{ borderColor: `${BEAR}55`, background: `${BEAR}0d` }}>
                    <p className="text-[10px] uppercase tracking-[0.4em] font-bold mb-1" style={{ color: BEAR }}>RESISTANCE</p>
                    <p className="text-sm leading-relaxed">{synthesis.resistance}</p>
                  </div>
                </div>
                {synthesis.trend_summary && (
                  <div className="mb-5 rounded-lg border p-4 text-sm leading-relaxed" style={{ borderColor: `${accent}44`, background: "rgba(0,0,0,0.4)" }}>
                    <p className="text-[10px] uppercase tracking-[0.4em] font-bold mb-2" style={{ color: accent }}>Trendline Read</p>
                    {synthesis.trend_summary}
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3 mb-5">
                  <div className="rounded-lg border p-4" style={{ borderColor: `${BULL}66` }}>
                    <p className="text-[10px] uppercase tracking-[0.4em] font-bold mb-1 flex items-center gap-1" style={{ color: BULL }}><TrendingUp className="h-3 w-3" /> If Bulls Win</p>
                    <p className="text-sm leading-relaxed">{synthesis.bull_scenario}</p>
                  </div>
                  <div className="rounded-lg border p-4" style={{ borderColor: `${BEAR}66` }}>
                    <p className="text-[10px] uppercase tracking-[0.4em] font-bold mb-1 flex items-center gap-1" style={{ color: BEAR }}><TrendingDown className="h-3 w-3" /> If Bears Win</p>
                    <p className="text-sm leading-relaxed">{synthesis.bear_scenario}</p>
                  </div>
                </div>
                {synthesis.impact_matrix.length > 0 && (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: `${accent}55` }}>
                    <div className="grid grid-cols-2 px-4 py-2 border-b text-[10px] uppercase tracking-[0.4em]" style={{ borderColor: `${accent}33`, background: "rgba(0,0,0,0.6)", color: accent }}>
                      <div>Event</div><div>Predicted Move</div>
                    </div>
                    {synthesis.impact_matrix.map((r, i) => {
                      const isBull = /\+|up|surge|breakout|target|rally|gain/i.test(r.movement);
                      const isBear = /-|down|drop|fall|retreat|crash|loss/i.test(r.movement);
                      const c = isBull ? BULL : isBear ? BEAR : accent;
                      return (
                        <div key={i} className="grid grid-cols-2 px-4 py-2.5 text-sm border-b last:border-b-0" style={{ borderColor: `${accent}22` }}>
                          <div className="font-bold uppercase tracking-wide text-xs">{r.event}</div>
                          <div className="font-mono text-sm" style={{ color: c }}>{r.movement}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-6 flex items-center justify-between gap-4" style={{ borderColor: `${accent}66` }}>
                <div className="flex items-center gap-3">
                  <Lock className="h-6 w-6" style={{ color: accent }} />
                  <div>
                    <p className="font-bold uppercase tracking-[0.2em] text-sm">Professional Alpha Locked</p>
                    <p className="text-xs opacity-80 mt-1">Impact Matrix · Support/Resistance levels · Bull & Bear scenario targets</p>
                  </div>
                </div>
                <Button onClick={startUnlock} disabled={unlocking} className="font-black uppercase tracking-[0.25em]" style={{ background: accent, color: "#000" }}>
                  {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Unlock Alpha · £{(portal.price_cents / 100).toFixed(2)} ({Math.round(portal.price_cents / 100)} 🪙)</>}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t mt-12 py-6 px-5 sm:px-8 text-center" style={{ borderColor: `${accent}33` }}>
        <Link to="/" className="hover:opacity-100 inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] opacity-70">
          <span style={{ color: accent }}>▣</span> Powered by <OgWordmark suffix="-PORTAL" /> · Satellite Recon
        </Link>
        <p className="mt-4 max-w-3xl mx-auto text-[10px] uppercase tracking-[0.25em] opacity-50 leading-relaxed">
          0G-TradeHUB is a sentiment analysis tool. Close to financial advice, but legally NOT financial advice. Your capital is at risk.
        </p>
      </footer>

      {clientSecret && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setClientSecret(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2">
              <button className="text-sm text-gray-500 px-3 py-1" onClick={() => { setClientSecret(null); setOwned(true); }}>Done</button>
            </div>
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      )}
    </div>
  );
}

function ConflictColumn({ side, articles, headingFont, text, showVip, startUnlock, unlocking, priceCents }: {
  side: "bull" | "bear";
  articles: NewsArticle[];
  headingFont: string;
  text: string;
  showVip: boolean;
  startUnlock: () => void;
  unlocking: boolean;
  priceCents: number;
}) {
  const c = side === "bull" ? "#00e08a" : "#ff2233";
  const label = side === "bull" ? "Bullish Catalysts" : "Bearish Risks";
  const zone = side === "bull" ? "GREEN ZONE" : "RED ZONE";
  const Icon = side === "bull" ? TrendingUp : TrendingDown;
  return (
    <section className="rounded-2xl border p-4 sm:p-5 backdrop-blur-sm relative" style={{ borderColor: `${c}66`, background: `linear-gradient(180deg, ${c}10, ${c}03)`, boxShadow: `inset 0 0 40px ${c}11, 0 0 25px ${c}22` }}>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: `${c}33` }}>
        <Icon className="h-5 w-5" style={{ color: c }} />
        <div>
          <p className="text-[9px] uppercase tracking-[0.5em] opacity-70" style={{ color: c }}>{zone}</p>
          <p className="font-black text-base uppercase" style={{ fontFamily: `'${headingFont}', Impact, sans-serif`, color: c }}>{label}</p>
        </div>
      </div>
      {articles.length === 0 ? (
        <div className="text-xs opacity-60 text-center py-8">No {side} catalysts on the tape yet.</div>
      ) : (
        <div className="space-y-3">
          {articles.map((a, i) => (
            <motion.article key={a.url + i} initial={{ opacity: 0, x: side === "bull" ? -10 : 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-lg border p-3" style={{ borderColor: `${c}44`, background: "rgba(0,0,0,0.4)" }}>
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] opacity-70 mb-1">
                <span className="px-1.5 py-0.5 rounded border font-mono" style={{ color: c, borderColor: `${c}66` }}>#{i + 1}</span>
                <span style={{ color: c }}>{a.source}</span>
              </div>
              <h3 className="text-sm font-black leading-snug uppercase" style={{ fontFamily: `'${headingFont}', Impact, sans-serif`, color: text }}>
                {a.title}
              </h3>
              <p className="mt-1.5 text-xs opacity-85 leading-relaxed">{a.snippet}</p>
              {showVip ? (
                <div className="mt-2.5 rounded p-2.5 border text-xs leading-relaxed" style={{ borderColor: `${c}44`, background: "rgba(0,0,0,0.4)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase tracking-[0.4em] font-bold" style={{ color: c }}>▣ AI Spin-off</span>
                    <span className="inline-flex items-center gap-1 text-[9px]" style={{ color: c }}>
                      <Gauge className="h-3 w-3" /> {a.confidence}
                    </span>
                  </div>
                  <p>{a.spinoff}</p>
                </div>
              ) : (
                <div className="mt-2.5 rounded p-2 border border-dashed flex items-center justify-between gap-2 text-[10px]" style={{ borderColor: `${c}66` }}>
                  <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" style={{ color: c }} />VIP analysis locked</span>
                  <Button size="sm" onClick={startUnlock} disabled={unlocking} className="h-6 text-[10px] px-2" style={{ background: c, color: "#000" }}>
                    {unlocking ? <Loader2 className="h-3 w-3 animate-spin" /> : `£${(priceCents / 100).toFixed(2)} (${Math.round(priceCents / 100)} 🪙)`}
                  </Button>
                </div>
              )}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.3em] opacity-70 hover:opacity-100" style={{ color: c }}>
                Source <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}
