import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lock, Loader2, Radio, BadgeCheck, Send, Crown } from "lucide-react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { createPortalUnlockCheckout, getPortalUnlockStatus } from "@/lib/portals.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { TVStaticLogo } from "@/components/TVStaticLogo";

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
  vip: boolean;
  price_cents: number;
  theme_config: ThemeConfig;
  scout_meta: { sources?: string[]; headlines?: string[] };
  telegram_config: {
    groupLink?: string | null;
    vipLink?: string | null;
    botUsername?: string | null;
    brand?: { brandName?: string; logoEmoji?: string };
  } | null;
};

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("portals")
      .select("id, slug, name, niche, language, vibe, theme, jokes, vip, price_cents, theme_config, scout_meta, telegram_config")
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
    <main className="min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-3xl font-bold">Portal not found</h1>
        <Link to="/" className="text-sm underline mt-3 inline-block">Back to 0G-PORTAL</Link>
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

function mergeTheme(portal: Portal): Required<ThemeConfig> {
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
  const T = useMemo(() => mergeTheme(portal), [portal]);
  const { user, profile } = useAuth();
  const isVipMember = profile?.rank === "vip" || profile?.rank === "boss";
  const tg = portal.telegram_config ?? {};
  const groupLink = tg.groupLink || (tg.botUsername ? `https://t.me/${tg.botUsername}` : null);
  const vipLink = tg.vipLink || null;
  const checkoutFn = useServerFn(createPortalUnlockCheckout);
  const statusFn = useServerFn(getPortalUnlockStatus);

  const [idx, setIdx] = useState(0);
  const [hits, setHits] = useState(0);
  const [owned, setOwned] = useState<boolean>(!portal.vip);
  const [unlocking, setUnlocking] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const controls = useAnimationControls();
  const jokes = portal.jokes?.length ? portal.jokes : ["No jokes loaded yet."];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSnippet = (portal as any).audio_snippet_url as string | null | undefined;

  // Lead tracking: increment view counter on mount
  useEffect(() => {
    supabase.rpc("increment_portal_view", { _slug: portal.slug }).then(() => {});
  }, [portal.slug]);

  useEffect(() => {
    if (!portal.vip) { setOwned(true); return; }
    if (!user) { setOwned(false); return; }
    statusFn({ data: { portalId: portal.id } })
      .then((r) => setOwned(r.owned))
      .catch(() => setOwned(false));
  }, [portal.id, portal.vip, user, statusFn]);

  const hit = async () => {
    if (!owned) {
      startUnlock();
      return;
    }
    setIdx((i) => (i + 1) % jokes.length);
    setHits((h) => h + 1);
    controls.start(HIT_ANIMS[T.animation] ?? HIT_ANIMS.pulse);
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
    <div style={{ background: T.bgGradient, color: T.text, minHeight: "100vh" }} className="relative flex flex-col overflow-hidden">
      {/* Gritty texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
           style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/></svg>\")" }} />

      {/* Logo corner */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <TVStaticLogo className="h-8 w-8" />
        <span className="text-[10px] uppercase tracking-[0.4em] opacity-70" style={{ color: T.accent }}>0G</span>
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
              <p className="text-sm opacity-70 mt-1">Unlock for ${(portal.price_cents / 100).toFixed(2)}</p>
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
        <motion.div whileTap={{ scale: 0.95 }} className="mt-10 w-full max-w-md">
          <Button
            onClick={hit}
            disabled={unlocking}
            className="h-20 w-full text-2xl uppercase tracking-[0.4em] font-black border-4 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${T.accent}, ${T.secondary})`,
              color: "#000",
              borderColor: T.accent,
              fontFamily: T.fontFamily,
              boxShadow: `0 0 80px ${T.accent}99, inset 0 0 30px rgba(255,255,255,0.25)`,
            }}
          >
            {unlocking ? <><Loader2 className="h-6 w-6 mr-2 animate-spin" />…</> : (!owned && portal.vip ? `UNLOCK · $${(portal.price_cents/100).toFixed(2)}` : T.hitButton)}
          </Button>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] opacity-60">
            {owned ? `${hits} hits · ${idx + 1}/${jokes.length}` : "Tap to unlock"}
          </p>
        </motion.div>

        {(groupLink || (isVipMember && vipLink)) && (
          <div className="mt-8 w-full max-w-md flex flex-col gap-3">
            {groupLink && (
              <a href={groupLink} target="_blank" rel="noreferrer" className="group">
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
              <a href={vipLink} target="_blank" rel="noreferrer">
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
          <span style={{ color: T.accent }}>▣</span> Powered by 0G-PORTAL
        </Link>
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
