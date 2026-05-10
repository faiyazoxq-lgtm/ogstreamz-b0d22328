import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Pause, Loader2, ShoppingBag, Crown, BadgeCheck, Moon, Volume2, VolumeX,
  Shuffle, Sparkles, ArrowRight, Music2, Heart,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { effectiveSwearing } from "@/lib/swearing";
import { createCheckoutSession } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

/** Static curated drops. Add more as we ship them. */
type StaticDrop = {
  id: string;
  kind: "static";
  badge: string;
  title: string;
  subtitle: string;
  fontFamily?: string;
  /** Background gradient for the card */
  background: string;
  /** Glow color for the outer shadow */
  glow: string;
  /** Border color (CSS color/var). */
  border: string;
  /** Accent color used for the play button text + chips. */
  accent: string;
  /** Optional preview audio URL — when present, render audio + play button. */
  audioUrl?: string;
  /** Optional Stripe price id for an inline buy button. */
  priceId?: string;
  /** Optional ornamental icon (top right). */
  ornament?: "moon" | "sparkles" | "music";
  /** Religious / devotional drop — switches off the Boss-style hum easter egg. */
  reverent?: boolean;
  /** Genre prompt to pre-tap when user clicks "Use this style". */
  stylePhrase?: string;
};

type DynamicDrop = {
  id: string;
  kind: "dynamic";
  slug: string;
  name: string;
  style: string | null;
  language: string | null;
  vibe: string | null;
};

type Drop = StaticDrop | DynamicDrop;

const STATIC_DROPS: StaticDrop[] = [
  {
    id: "midnight-madinah",
    kind: "static",
    badge: "Featured · Nasheed · بِسْمِ ٱللَّٰهِ",
    title: "Midnight Madinah · مَدِينَة",
    subtitle: "Vocals-only devotional · no instruments · soft humming drone beneath.",
    fontFamily: "'Amiri', 'Scheherazade New', 'Montserrat', serif",
    background:
      "radial-gradient(120% 100% at 0% 0%, #0a3322 0%, #06231a 35%, #04140f 70%, #02080a 100%)",
    glow: "rgba(255,209,102,0.55)",
    border: "hsl(45 85% 60% / 0.45)",
    accent: "hsl(45 85% 70%)",
    audioUrl: "https://cdn.pixabay.com/audio/2024/02/04/audio_3a3f4def0f.mp3",
    priceId: "featured_nasheed_2usd",
    ornament: "moon",
    reverent: true,
    stylePhrase: "nasheed, devotional vocals, no instruments",
  },
  {
    id: "neon-lagos",
    kind: "static",
    badge: "Featured · Afrobeat · Lagos at 2am",
    title: "Neon Lagos",
    subtitle: "Log-drum afrobeat groove · sun-soaked, percussive, dancefloor-ready.",
    background:
      "radial-gradient(120% 100% at 100% 0%, #2a0d3a 0%, #3a0e2a 35%, #1a0420 70%, #0a0210 100%)",
    glow: "rgba(255, 96, 162, 0.45)",
    border: "hsl(330 80% 60% / 0.45)",
    accent: "hsl(330 90% 75%)",
    ornament: "sparkles",
    stylePhrase: "afrobeat groove, log drums, sun-soaked",
  },
  {
    id: "drill-after-dark",
    kind: "static",
    badge: "Featured · UK Drill · 808 menace",
    title: "Drill After Dark",
    subtitle: "Sliding 808s, dark menace, rapid hi-hat triplets — opp-block ready.",
    background:
      "radial-gradient(120% 100% at 0% 100%, #0a1d3a 0%, #0a0f24 40%, #04060f 75%, #02030a 100%)",
    glow: "rgba(96, 165, 250, 0.45)",
    border: "hsl(215 80% 55% / 0.45)",
    accent: "hsl(215 90% 75%)",
    ornament: "music",
    stylePhrase: "UK drill, sliding 808s, dark menace",
  },
  {
    id: "3am-lofi",
    kind: "static",
    badge: "Featured · Lo-Fi · 3am study room",
    title: "3am Lo-Fi",
    subtitle: "Vinyl crackle, jazzy keys, late-night brain-on-snooze textures.",
    background:
      "radial-gradient(120% 100% at 50% 0%, #1a2a2f 0%, #0e181c 40%, #060c0e 75%, #02060a 100%)",
    glow: "rgba(125, 211, 252, 0.40)",
    border: "hsl(195 60% 60% / 0.45)",
    accent: "hsl(195 80% 78%)",
    ornament: "sparkles",
    stylePhrase: "lo-fi, vinyl crackle, jazzy keys, late-night",
  },
];

type PlayState = "idle" | "loading" | "playing" | "paused";
type BuyState = "idle" | "opening" | "open";

export function FeaturedDropCard() {
  const { user, profile } = useAuth();
  // Heart icon = Safe Mode (swearing agent off). Surface inline on reverent drops.
  const safeMode = !effectiveSwearing(profile);
  const [dynamicDrops, setDynamicDrops] = useState<DynamicDrop[]>([]);
  const [index, setIndex] = useState(0);

  // Fetch a small pool of recent music portals to rotate alongside the curated drops.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("portals")
        .select("id, slug, name, style, language, vibe")
        .eq("kind", "music")
        .order("created_at", { ascending: false })
        .limit(8);
      if (cancelled || !data) return;
      setDynamicDrops(
        data.map((r: any) => ({
          id: `dyn-${r.id}`,
          kind: "dynamic" as const,
          slug: r.slug,
          name: r.name,
          style: r.style ?? null,
          language: r.language ?? null,
          vibe: r.vibe ?? null,
        })),
      );
    })();
    return () => { cancelled = true; };
  }, []);

  const drops: Drop[] = useMemo(() => {
    // Interleave static + dynamic so the same nasheed isn't the only thing on first load.
    const all: Drop[] = [...STATIC_DROPS, ...dynamicDrops];
    // Stable shuffle anchored on a per-mount seed so "Next" is deterministic in this session.
    const seed = Math.floor(Math.random() * 1000);
    return all
      .map((d, i) => ({ d, k: ((i * 1103515245 + seed) >>> 0) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.d);
  }, [dynamicDrops]);

  // Reset to a random starting position whenever the rotation set changes.
  useEffect(() => {
    if (drops.length === 0) return;
    setIndex(Math.floor(Math.random() * drops.length));
  }, [drops.length]);

  const drop = drops[index] ?? STATIC_DROPS[0];
  const next = () => setIndex((i) => (drops.length ? (i + 1) % drops.length : 0));

  // Audio + buy + hum state — only meaningful for static drops with media.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [progress, setProgress] = useState(0);
  const [canPlay, setCanPlay] = useState(false);
  const humCtxRef = useRef<AudioContext | null>(null);
  const humGainRef = useRef<GainNode | null>(null);
  const [humOn, setHumOn] = useState(false);
  const [buyState, setBuyState] = useState<BuyState>("idle");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const checkoutFn = useServerFn(createCheckoutSession);

  // Reset media state whenever the drop changes.
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      try { a.pause(); } catch { /* noop */ }
      a.currentTime = 0;
    }
    setPlayState("idle");
    setProgress(0);
    setCanPlay(false);
    setBuyState("idle");
    setClientSecret(null);
    if (humOn) stopHum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drop.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => { if (a.duration) setProgress(a.currentTime / a.duration); };
    const onEnded = () => { setPlayState("idle"); setProgress(0); };
    const onReady = () => setCanPlay(true);
    const onWaiting = () => setCanPlay(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("canplay", onReady);
    a.addEventListener("loadeddata", onReady);
    a.addEventListener("waiting", onWaiting);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("canplay", onReady);
      a.removeEventListener("loadeddata", onReady);
      a.removeEventListener("waiting", onWaiting);
    };
  }, [drop.id]);

  useEffect(() => () => {
    try { humCtxRef.current?.close(); } catch { /* noop */ }
    humCtxRef.current = null;
    humGainRef.current = null;
  }, []);

  function startHum() {
    if (humCtxRef.current) {
      humGainRef.current?.gain.setTargetAtTime(0.06, humCtxRef.current.currentTime, 0.6);
      setHumOn(true);
      return;
    }
    const Ctx: typeof AudioContext | undefined =
      (window.AudioContext as any) || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    filter.Q.value = 1.2;
    master.connect(filter).connect(ctx.destination);
    const freqs = [146.83, 220.0, 293.66];
    const gains = [0.5, 0.3, 0.2];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.5 + i * 0.3;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1.6;
      lfo.connect(lfoGain).connect(osc.frequency);
      const oscGain = ctx.createGain();
      oscGain.gain.value = gains[i];
      osc.connect(oscGain).connect(master);
      osc.start();
      lfo.start();
    });
    master.gain.setTargetAtTime(0.06, ctx.currentTime, 0.8);
    humCtxRef.current = ctx;
    humGainRef.current = master;
    setHumOn(true);
  }
  function stopHum() {
    const ctx = humCtxRef.current;
    const g = humGainRef.current;
    if (ctx && g) g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setHumOn(false);
  }
  const toggleHum = () => (humOn ? stopHum() : startHum());

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playState === "playing") { a.pause(); setPlayState("paused"); return; }
    setPlayState("loading");
    try {
      if (a.readyState < 2) {
        await new Promise<void>((resolve, reject) => {
          const ok = () => { cleanup(); resolve(); };
          const err = () => { cleanup(); reject(new Error("audio error")); };
          const cleanup = () => {
            a.removeEventListener("canplay", ok);
            a.removeEventListener("error", err);
          };
          a.addEventListener("canplay", ok, { once: true });
          a.addEventListener("error", err, { once: true });
          try { a.load(); } catch { /* noop */ }
        });
      }
      await a.play();
      setPlayState("playing");
      if (humOn && humCtxRef.current && humGainRef.current) {
        humGainRef.current.gain.setTargetAtTime(0.025, humCtxRef.current.currentTime, 0.4);
      }
    } catch {
      setPlayState("idle");
      toast.error("Couldn't start the preview");
    }
  };

  const onBuy = async (priceId: string) => {
    if (!user) { toast.error("Sign in to buy this drop"); return; }
    if (buyState !== "idle") return;
    setBuyState("opening");
    try {
      const cs = await checkoutFn({
        data: {
          priceId,
          environment: getStripeEnvironment(),
          customerEmail: user.email,
          userId: user.id,
          returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      if (!cs) throw new Error("No client secret returned");
      setClientSecret(cs);
      setBuyState("open");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Checkout failed";
      toast.error(msg);
      setBuyState("idle");
    }
  };
  const closeCheckout = () => { setBuyState("idle"); setClientSecret(null); };

  // ────── Render ──────

  // Theme tokens for the active drop.
  const isStatic = drop.kind === "static";
  const sd: StaticDrop | null = isStatic ? (drop as StaticDrop) : null;

  // Dynamic drops get a generic neutral palette.
  const background = sd?.background ?? "radial-gradient(120% 100% at 0% 0%, hsl(220 30% 14%) 0%, hsl(220 35% 8%) 60%, hsl(220 40% 4%) 100%)";
  const glow = sd?.glow ?? "rgba(125, 211, 252, 0.35)";
  const border = sd?.border ?? "hsl(220 50% 60% / 0.35)";
  const accent = sd?.accent ?? "hsl(45 85% 70%)";

  const Ornament = sd?.ornament === "moon" ? Moon : sd?.ornament === "music" ? Music2 : Sparkles;

  return (
    <section
      aria-label="Featured music drop"
      className="relative mt-8 overflow-hidden rounded-3xl p-5 sm:p-7"
      style={{
        background,
        border: `1px solid ${border}`,
        boxShadow: `0 0 120px -30px ${glow}`,
      }}
    >
      {/* Geometric tile (kept for nasheed; subtle for others) */}
      {sd?.reverent && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="islamic-star" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="#f5d27a" strokeWidth="1">
                <polygon points="32,4 39,25 60,25 43,38 50,60 32,46 14,60 21,38 4,25 25,25" />
                <circle cx="32" cy="32" r="20" />
                <rect x="6" y="6" width="52" height="52" transform="rotate(45 32 32)" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#islamic-star)" />
        </svg>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
      />
      <Ornament
        aria-hidden
        className="pointer-events-none absolute top-6 right-7 h-7 w-7 -rotate-[20deg] drop-shadow-[0_0_12px_rgba(255,209,102,0.6)]"
        style={{ color: accent }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em]" style={{ color: accent }}>
            <BadgeCheck className="h-3.5 w-3.5" />
            {sd ? sd.badge : "Featured · Community Studio"}
          </div>
          {sd?.reverent && safeMode && (
            <div
              role="status"
              aria-label="Safe Mode active"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-200 shadow-[0_0_12px_-2px_rgba(16,185,129,0.5)]"
            >
              <Heart aria-hidden className="h-3 w-3 fill-emerald-400 text-emerald-400" />
              Safe Mode active
            </div>
          )}
          <h2
            className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white truncate"
            style={{ fontFamily: sd?.fontFamily ?? "'Montserrat', system-ui, sans-serif" }}
          >
            {sd ? sd.title : (drop as DynamicDrop).name}
          </h2>
          <p className="mt-1 text-sm text-white/75 line-clamp-2">
            {sd
              ? sd.subtitle
              : [
                  (drop as DynamicDrop).style,
                  (drop as DynamicDrop).language,
                  (drop as DynamicDrop).vibe,
                ].filter(Boolean).join(" · ")}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={next}
          disabled={drops.length < 2}
          aria-label="Show next featured drop"
          className="shrink-0 h-9 px-3 text-[11px] uppercase tracking-[0.25em] text-white/70 hover:text-white hover:bg-white/10"
        >
          <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Next
        </Button>
      </div>

      {/* Static drops with audio */}
      {sd?.audioUrl && (
        <>
          <audio ref={audioRef} src={sd.audioUrl} preload="metadata" />
          <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full transition-[width] duration-200 ease-linear"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${border}, ${accent}, white)`,
              }}
            />
          </div>
        </>
      )}

      <div className="relative mt-4 flex flex-col sm:flex-row gap-2">
        {sd?.audioUrl ? (
          <Button
            type="button"
            onClick={togglePlay}
            disabled={playState === "loading"}
            aria-busy={playState === "loading"}
            className="flex-1 min-h-12 bg-white/5 border text-[hsl(45_85%_72%)] hover:bg-white/10 hover:text-white font-bold tracking-wide transition-all active:scale-[0.98]"
            style={{ borderColor: border, color: accent }}
          >
            {playState === "loading" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Tuning…</>
            ) : playState === "playing" ? (
              <><Pause className="h-4 w-4 mr-2" />Pause preview</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />{playState === "paused" ? "Resume" : "Play preview"}{!canPlay && playState === "idle" ? " (buffering)" : ""}</>
            )}
          </Button>
        ) : (
          // Non-audio drops: link to the relevant studio (dynamic) or Music hub.
          <Button
            asChild
            type="button"
            className="flex-1 min-h-12 bg-white/5 border text-white/85 hover:bg-white/10 hover:text-white font-bold tracking-wide"
            style={{ borderColor: border, color: accent }}
          >
            {drop.kind === "dynamic" ? (
              <Link to="/m/$slug" params={{ slug: drop.slug }}>
                <Music2 className="h-4 w-4 mr-2" /> Open studio <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            ) : (
              <Link to="/music">
                <Sparkles className="h-4 w-4 mr-2" /> Use this style <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            )}
          </Button>
        )}

        {/* Hum is only meaningful for the reverent vocals-only drop */}
        {sd?.reverent && sd.audioUrl && (
          <Button
            type="button"
            onClick={toggleHum}
            aria-pressed={humOn}
            aria-label={humOn ? "Mute background humming" : "Play background humming"}
            variant="outline"
            className="sm:w-40 min-h-12 border bg-white/5 text-[hsl(155_60%_75%)] hover:bg-[hsl(155_55%_30%/0.25)] hover:text-white font-semibold tracking-wide"
            style={{ borderColor: "hsl(155 45% 55% / 0.5)" }}
          >
            {humOn ? <><Volume2 className="h-4 w-4 mr-2" />Hum on</> : <><VolumeX className="h-4 w-4 mr-2" />Hum off</>}
          </Button>
        )}

        {sd?.priceId ? (
          <Button
            type="button"
            onClick={() => onBuy(sd.priceId!)}
            disabled={buyState !== "idle"}
            aria-busy={buyState !== "idle"}
            className="flex-1 min-h-12 font-black tracking-wide transition-all active:scale-[0.98] text-black"
            style={{ backgroundColor: accent }}
          >
            {buyState === "opening" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opening…</>
            ) : buyState === "open" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checkout open</>
            ) : (
              <><ShoppingBag className="h-4 w-4 mr-2" />Buy for $2</>
            )}
          </Button>
        ) : (
          <Button
            asChild
            type="button"
            variant="outline"
            className="sm:w-44 min-h-12 border bg-white/5 text-white/85 hover:bg-white/10 hover:text-white font-semibold tracking-wide"
            style={{ borderColor: border }}
          >
            <Link to="/music">
              <Sparkles className="h-4 w-4 mr-2" /> Spawn one
            </Link>
          </Button>
        )}
      </div>

      <p className="relative mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-white/55">
        <Crown className="h-3 w-3" style={{ color: accent }} />
        {drops.length > 1
          ? `${index + 1} / ${drops.length} · Tap “Next” to spotlight another studio`
          : "VIP members own every track — checkout secured by Stripe"}
      </p>

      {sd?.priceId && buyState === "open" && clientSecret && (
        <div className="relative mt-5 rounded-2xl bg-white overflow-hidden border" style={{ borderColor: border }}>
          <EmbeddedCheckoutProvider
            stripe={getStripe()}
            options={{ fetchClientSecret: async () => clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
          <button
            type="button"
            onClick={closeCheckout}
            className="block w-full py-2 text-[10px] uppercase tracking-[0.3em] text-black/60 hover:text-black bg-white border-t border-black/10"
          >
            Close checkout
          </button>
        </div>
      )}
    </section>
  );
}