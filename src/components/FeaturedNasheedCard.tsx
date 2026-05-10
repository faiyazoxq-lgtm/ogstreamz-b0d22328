import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, ShoppingBag, Crown, BadgeCheck, Moon, Volume2, VolumeX } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { createCheckoutSession } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

// Vocals-only nasheed preview. Swap this with the URL of a Suno-generated
// vocals-only master once your studio job finishes (see music portal page).
const PREVIEW_URL = "https://cdn.pixabay.com/audio/2024/02/04/audio_3a3f4def0f.mp3";
const PRICE_ID = "featured_nasheed_2usd";

type PlayState = "idle" | "loading" | "playing" | "paused";
type BuyState = "idle" | "opening" | "open";

export function FeaturedNasheedCard() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [progress, setProgress] = useState(0);
  const [canPlay, setCanPlay] = useState(false);

  // Background "vocals-only humming" layer — synthesised with Web Audio so it
  // works offline and stays in vibe with the nasheed (no instruments).
  const humCtxRef = useRef<AudioContext | null>(null);
  const humGainRef = useRef<GainNode | null>(null);
  const [humOn, setHumOn] = useState(false);

  const [buyState, setBuyState] = useState<BuyState>("idle");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const checkoutFn = useServerFn(createCheckoutSession);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (a.duration) setProgress(a.currentTime / a.duration);
    };
    const onEnded = () => {
      setPlayState("idle");
      setProgress(0);
    };
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
  }, []);

  // Tear down the hum on unmount.
  useEffect(() => {
    return () => {
      try { humCtxRef.current?.close(); } catch { /* noop */ }
      humCtxRef.current = null;
      humGainRef.current = null;
    };
  }, []);

  const startHum = () => {
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
    // Warm low-pass to approximate a closed-mouth vocal hum.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    filter.Q.value = 1.2;
    master.connect(filter).connect(ctx.destination);

    // A drone built from a fundamental + soft fifth + octave with vibrato.
    const freqs = [146.83 /* D3 */, 220.0 /* A3 */, 293.66 /* D4 */];
    const gains = [0.5, 0.3, 0.2];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.5 + i * 0.3; // gentle vibrato
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
  };

  const stopHum = () => {
    const ctx = humCtxRef.current;
    const g = humGainRef.current;
    if (ctx && g) g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setHumOn(false);
  };

  const toggleHum = () => (humOn ? stopHum() : startHum());

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playState === "playing") {
      a.pause();
      setPlayState("paused");
      return;
    }
    setPlayState("loading");
    try {
      // If metadata isn't ready yet, wait for the first canplay event.
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
      // Wait until the browser confirms playback has started.
      await a.play();
      setPlayState("playing");
      // Soften the hum while the lead vocal plays so it sits behind it.
      if (humOn && humCtxRef.current && humGainRef.current) {
        humGainRef.current.gain.setTargetAtTime(0.025, humCtxRef.current.currentTime, 0.4);
      }
    } catch {
      setPlayState("idle");
      toast.error("Couldn't start the preview");
    }
  };

  const onBuy = async () => {
    if (!user) {
      toast.error("Sign in to buy this nasheed");
      return;
    }
    if (buyState !== "idle") return;
    setBuyState("opening");
    try {
      const cs = await checkoutFn({
        data: {
          priceId: PRICE_ID,
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

  const closeCheckout = () => {
    setBuyState("idle");
    setClientSecret(null);
  };

  return (
    <section
      aria-label="Featured nasheed"
      className="relative mt-8 overflow-hidden rounded-3xl border border-[hsl(45_85%_60%/0.45)] p-5 sm:p-7 shadow-[0_0_120px_-30px_rgba(255,209,102,0.55)]"
      style={{
        background:
          "radial-gradient(120% 100% at 0% 0%, #0a3322 0%, #06231a 35%, #04140f 70%, #02080a 100%)",
      }}
    >
      {/* Islamic geometric pattern — eight-point star tile */}
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

      {/* Crescent moon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #ffd166 0%, #1f6f4d 50%, transparent 75%)" }}
      />
      <Moon
        aria-hidden
        className="pointer-events-none absolute top-6 right-7 h-7 w-7 -rotate-[20deg] text-[hsl(45_85%_70%)] drop-shadow-[0_0_12px_rgba(255,209,102,0.8)]"
      />

      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-[hsl(45_85%_70%)]">
          <BadgeCheck className="h-3.5 w-3.5" />
          Featured · Nasheed · بِسْمِ ٱللَّٰهِ
        </div>
        <h2
          className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white"
          style={{ fontFamily: "'Amiri', 'Scheherazade New', 'Montserrat', serif" }}
        >
          Midnight Madinah · مَدِينَة
        </h2>
        <p className="mt-1 text-sm text-white/75">
          Vocals-only devotional · no instruments · soft humming drone beneath.
        </p>
      </div>

      <audio ref={audioRef} src={PREVIEW_URL} preload="metadata" />

      {/* Progress */}
      <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full transition-[width] duration-200 ease-linear"
          style={{
            width: `${progress * 100}%`,
            background: "linear-gradient(90deg, #1f6f4d, #ffd166, #ffe7a3)",
          }}
        />
      </div>

      <div className="relative mt-4 flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          onClick={togglePlay}
          disabled={playState === "loading"}
          aria-busy={playState === "loading"}
          aria-label={
            playState === "playing"
              ? "Pause preview"
              : playState === "loading"
                ? "Loading preview"
                : canPlay
                  ? "Play preview"
                  : "Buffering preview, tap to play"
          }
          className="flex-1 min-h-12 bg-white/5 border border-[hsl(45_85%_60%/0.5)] text-[hsl(45_85%_72%)] hover:bg-[hsl(45_85%_60%/0.12)] hover:text-[hsl(45_85%_80%)] font-bold tracking-wide transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[hsl(45_85%_60%/0.7)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {playState === "loading" ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Tuning vocals…</>
          ) : playState === "playing" ? (
            <><Pause className="h-4 w-4 mr-2" />Pause nasheed</>
          ) : (
            <><Play className="h-4 w-4 mr-2" />{playState === "paused" ? "Resume nasheed" : "Play nasheed preview"}</>
          )}
        </Button>

        <Button
          type="button"
          onClick={toggleHum}
          aria-pressed={humOn}
          aria-label={humOn ? "Mute background humming" : "Play background humming"}
          variant="outline"
          className="sm:w-40 min-h-12 border border-[hsl(155_45%_55%/0.5)] bg-white/5 text-[hsl(155_60%_75%)] hover:bg-[hsl(155_55%_30%/0.25)] hover:text-white font-semibold tracking-wide focus-visible:ring-2 focus-visible:ring-[hsl(155_55%_55%/0.6)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {humOn ? <><Volume2 className="h-4 w-4 mr-2" />Hum on</> : <><VolumeX className="h-4 w-4 mr-2" />Hum off</>}
        </Button>

        <Button
          type="button"
          onClick={onBuy}
          disabled={buyState !== "idle"}
          aria-busy={buyState !== "idle"}
          className="flex-1 min-h-12 bg-[hsl(45_85%_62%)] text-black hover:bg-[hsl(45_85%_70%)] font-black tracking-wide transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[hsl(45_85%_62%)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {buyState === "opening" ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opening checkout…</>
          ) : buyState === "open" ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checkout open</>
          ) : (
            <><ShoppingBag className="h-4 w-4 mr-2" />Buy for $2</>
          )}
        </Button>
      </div>

      <p className="relative mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-white/55">
        <Crown className="h-3 w-3 text-[hsl(45_85%_70%)]" />
        VIP members own every track — checkout secured by Stripe
      </p>

      {buyState === "open" && clientSecret && (
        <div className="relative mt-5 rounded-2xl bg-white overflow-hidden border border-[hsl(45_85%_60%/0.4)]">
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