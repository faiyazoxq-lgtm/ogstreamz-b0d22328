import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, ShoppingBag, Crown, BadgeCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { createCheckoutSession } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

// Replace with the real preview MP3 once mastered.
const PREVIEW_URL = "https://cdn.pixabay.com/audio/2024/02/04/audio_3a3f4def0f.mp3";
const PRICE_ID = "featured_nasheed_2usd";

type PlayState = "idle" | "loading" | "playing" | "paused";
type BuyState = "idle" | "opening" | "open";

export function FeaturedNasheedCard() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [progress, setProgress] = useState(0);

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
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

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
      // Wait until the browser confirms playback has started.
      await a.play();
      setPlayState("playing");
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
      className="relative mt-8 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#0b1220] via-[#0a0f1a] to-[#04060c] p-5 sm:p-7 shadow-[0_0_80px_-20px_rgba(255,209,102,0.4)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #ffd166 0%, transparent 70%)" }}
      />

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-gold">
        <BadgeCheck className="h-3.5 w-3.5" />
        Featured · Nasheed
      </div>
      <h2 className="mt-2 font-[Montserrat] text-2xl sm:text-3xl font-black tracking-tight text-white">
        Midnight Madinah
      </h2>
      <p className="mt-1 text-sm text-white/70">
        Devotional vocals, no instruments — recorded in a quiet hour.
      </p>

      <audio ref={audioRef} src={PREVIEW_URL} preload="metadata" />

      {/* Progress */}
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full transition-[width] duration-200 ease-linear"
          style={{
            width: `${progress * 100}%`,
            background: "linear-gradient(90deg, #ffd166, #ffe7a3)",
          }}
        />
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
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
                : "Play preview"
          }
          className="flex-1 min-h-12 bg-white/5 border border-gold/40 text-gold hover:bg-gold/10 hover:text-gold font-bold tracking-wide transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {playState === "loading" ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading preview…</>
          ) : playState === "playing" ? (
            <><Pause className="h-4 w-4 mr-2" />Pause preview</>
          ) : (
            <><Play className="h-4 w-4 mr-2" />{playState === "paused" ? "Resume preview" : "Play preview"}</>
          )}
        </Button>

        <Button
          type="button"
          onClick={onBuy}
          disabled={buyState !== "idle"}
          aria-busy={buyState !== "idle"}
          className="flex-1 min-h-12 bg-gold text-black hover:bg-gold/90 font-black tracking-wide transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

      <p className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-white/50">
        <Crown className="h-3 w-3 text-gold" />
        VIP members own every track — checkout secured by Stripe
      </p>

      {buyState === "open" && clientSecret && (
        <div className="mt-5 rounded-2xl bg-white overflow-hidden border border-gold/30">
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