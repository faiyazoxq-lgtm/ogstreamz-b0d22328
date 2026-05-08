import { useEffect, useRef, useState } from "react";
import { Play, Pause, Lock, Download, Loader2, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createTrackUnlockCheckout, getTrackDownloadUrl } from "@/lib/tracks.functions";
import { useAuth } from "@/hooks/use-auth";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const PREVIEW_SECS = 30;

type Props = {
  trackId: string;
  title: string;
  previewUrl: string | null;
  priceCents: number;
  owned: boolean;
  accent: string;
  secondary: string;
  onUnlocked: () => void;
};

export function TrackPlayer({ trackId, title, previewUrl, priceCents, owned, accent, secondary, onUnlocked }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [previewEnded, setPreviewEnded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { user } = useAuth();
  const checkoutFn = useServerFn(createTrackUnlockCheckout);
  const downloadFn = useServerFn(getTrackDownloadUrl);
  const [unlocking, setUnlocking] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tick = () => {
      const t = a.currentTime;
      setProgress(Math.min(1, t / PREVIEW_SECS));
      if (!owned && t >= PREVIEW_SECS) {
        a.pause();
        a.currentTime = 0;
        setPlaying(false);
        setPreviewEnded(true);
      }
    };
    const onEnd = () => { setPlaying(false); };
    a.addEventListener("timeupdate", tick);
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", tick); a.removeEventListener("ended", onEnd); };
  }, [owned]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => toast.error("Couldn't play preview")); }
  };

  const startUnlock = async () => {
    if (!user) return toast.error("Sign in to unlock");
    setUnlocking(true);
    try {
      const env = getStripeEnvironment();
      const cs = await checkoutFn({
        data: {
          trackId,
          environment: env,
          customerEmail: user.email,
          returnUrl: `${window.location.href.split("?")[0]}?unlocked=${trackId}&session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      setClientSecret(cs);
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
    } finally {
      setUnlocking(false);
    }
  };

  const onDownload = async () => {
    setDownloading(true);
    try {
      const r = await downloadFn({ data: { trackId } });
      window.location.href = r.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Download unavailable");
    } finally {
      setDownloading(false);
    }
  };

  const price = `$${(priceCents / 100).toFixed(2)}`;

  return (
    <div
      className="rounded-2xl border p-5 mb-4 relative overflow-hidden"
      style={{ borderColor: `${accent}55`, background: `linear-gradient(135deg, ${accent}10, ${secondary}08)` }}
    >
      {/* Watermark */}
      <div
        className="absolute top-2 right-2 text-[9px] uppercase tracking-[0.3em] flex items-center gap-1 px-2 py-0.5 rounded-full border"
        style={{ color: accent, borderColor: `${accent}66`, background: "rgba(0,0,0,0.4)" }}
      >
        <BadgeCheck className="h-3 w-3" /> Licensed by 0G-PORTAL
      </div>

      <h3 className="text-lg font-bold pr-32 mb-3" style={{ color: "#fff" }}>{title}</h3>

      {previewUrl ? <audio ref={audioRef} src={previewUrl} preload="metadata" /> : null}

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={!previewUrl || (previewEnded && !owned)}
          className="h-12 w-12 rounded-full flex items-center justify-center border-2 transition disabled:opacity-40"
          style={{ borderColor: accent, background: `${accent}25`, color: accent, boxShadow: `0 0 30px ${accent}55` }}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <div className="flex-1">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${accent}, ${secondary})`,
                opacity: previewEnded && !owned ? 0.3 : 1,
              }}
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] mt-1.5 opacity-60">
            {owned ? "Full Track Unlocked" : `${PREVIEW_SECS}s Preview`}
          </p>
        </div>
      </div>

      {!owned && (previewEnded || progress > 0.95) && !clientSecret && (
        <div
          className="mt-4 rounded-xl border-2 p-4 text-center animate-fade-in"
          style={{
            borderColor: accent,
            background: `linear-gradient(135deg, ${accent}25, ${secondary}15)`,
            boxShadow: `0 0 50px ${accent}88, inset 0 0 20px ${accent}22`,
          }}
        >
          <p className="text-xs uppercase tracking-[0.3em] mb-2 opacity-80">Preview Ended</p>
          <Button
            onClick={startUnlock}
            disabled={unlocking}
            className="h-12 w-full text-xs uppercase tracking-[0.3em] font-black border-2"
            style={{ background: accent, color: "#000", borderColor: accent, boxShadow: `0 0 40px ${accent}` }}
          >
            {unlocking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : <><Lock className="h-4 w-4 mr-2" />Unlock Full HQ Track · {price}</>}
          </Button>
        </div>
      )}

      {owned && (
        <Button
          onClick={onDownload}
          disabled={downloading}
          className="mt-4 h-12 w-full text-xs uppercase tracking-[0.3em] font-bold"
          style={{ background: accent, color: "#000" }}
        >
          {downloading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing...</> : <><Download className="h-4 w-4 mr-2" />Download HQ MP3</>}
        </Button>
      )}

      {clientSecret && (
        <EmbeddedCheckoutModal
          clientSecret={clientSecret}
          onClose={() => setClientSecret(null)}
          onSuccess={() => { setClientSecret(null); onUnlocked(); }}
        />
      )}
    </div>
  );
}

function EmbeddedCheckoutModal({ clientSecret, onClose, onSuccess }: { clientSecret: string; onClose: () => void; onSuccess: () => void }) {
  // Poll the URL for ?unlocked=... after Stripe redirects within the iframe — or just rely on user closing.
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end p-2">
          <button className="text-sm text-gray-500 px-3 py-1" onClick={() => { onClose(); onSuccess(); }}>Done</button>
        </div>
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}