import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Lock, Download, Loader2, BadgeCheck, Crown, Unlock, RotateCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getTrackDownloadUrl } from "@/lib/tracks.functions";
import { useRetryWithBackoff } from "@/hooks/use-retry-with-backoff";
import { PreparationProgress } from "@/components/PreparationProgress";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrackUnlockCheckout } from "@/components/TrackUnlockCheckout";

const PREVIEW_SECS = 60;

type Props = {
  trackId: string;
  title: string;
  previewUrl: string | null;
  priceCents: number;
  owned: boolean;
  isVip?: boolean;
  accent: string;
  secondary: string;
  onUnlocked: () => void;
};

export function TrackPlayer({ trackId, title, previewUrl, priceCents, owned, isVip = false, accent, secondary, onUnlocked }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [previewEnded, setPreviewEnded] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { user } = useAuth();
  const downloadFn = useServerFn(getTrackDownloadUrl);

  const unlocked = owned || isVip;
  const coinPrice = Math.max(1, Math.round(priceCents / 100));
  const buyLabel = `Buy for ${coinPrice} 🪙`;
  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?unlocked=${trackId}&session_id={CHECKOUT_SESSION_ID}`
      : "";

  const onUnlock = () => {
    if (!user) return toast.error("Sign in to unlock this track");
    setCheckoutOpen(true);
  };

  // When checkout completes, Stripe redirects to returnUrl. If the user closes the
  // dialog after a successful purchase (or webhook lands while open), refresh.
  const closeAndRefresh = () => {
    setCheckoutOpen(false);
    onUnlocked();
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tick = () => {
      const t = a.currentTime;
      setProgress(Math.min(1, t / PREVIEW_SECS));
      if (!unlocked && t >= PREVIEW_SECS) {
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
  }, [unlocked]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => toast.error("Couldn't play preview")); }
  };

  // Wrap download in a backoff helper so transient UNAVAILABLE / INTERNAL
  // errors retry automatically before surfacing to the user.
  const callDownload = useCallback(
    () => downloadFn({ data: { trackId } }),
    [downloadFn, trackId],
  );
  const downloadRetry = useRetryWithBackoff(callDownload, {
    maxAttempts: 3,
    baseDelayMs: 800,
    maxDelayMs: 6000,
  });

  useEffect(() => {
    if (downloadRetry.status === "success" && downloadRetry.data?.url) {
      window.location.href = downloadRetry.data.url;
      downloadRetry.reset();
    } else if (downloadRetry.status === "error") {
      const code = downloadRetry.errorCode;
      if (code === "UNAUTHENTICATED") toast.error("Sign in to download");
      else if (code === "NOT_UNLOCKED") toast.error("Unlock this track to download");
      // UNAVAILABLE / INTERNAL surface inline below with a Retry button.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadRetry.status]);

  const onDownload = () => {
    if (!user) return toast.error("Sign in to download");
    downloadRetry.run();
  };

  const downloading =
    downloadRetry.status === "loading" || downloadRetry.status === "retrying";
  const downloadError =
    downloadRetry.status === "error" &&
    (downloadRetry.errorCode === "UNAVAILABLE" ||
      downloadRetry.errorCode === "INTERNAL" ||
      downloadRetry.errorCode === "RATE_LIMITED");

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
          disabled={!previewUrl || (previewEnded && !unlocked)}
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
                opacity: previewEnded && !unlocked ? 0.3 : 1,
              }}
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] mt-1.5 opacity-60">
            {unlocked ? (isVip && !owned ? "VIP · Full Track" : "Full Track Unlocked") : `${PREVIEW_SECS}s Preview`}
          </p>
        </div>
      </div>

      {!unlocked && (previewEnded || progress > 0.95) && (
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
            onClick={onUnlock}
            className="h-12 w-full text-xs uppercase tracking-[0.3em] font-black border-2 mb-2"
            style={{ background: accent, color: "#000", borderColor: accent, boxShadow: `0 0 40px ${accent}` }}
          >
            <Unlock className="h-4 w-4 mr-2" /> {buyLabel}
          </Button>
          <Link to="/vip">
            <Button
              variant="outline"
              className="h-10 w-full text-[10px] uppercase tracking-[0.3em] font-bold border"
              style={{ borderColor: `${accent}66`, color: accent, background: "transparent" }}
            >
              <Crown className="h-3.5 w-3.5 mr-2" /> Or Unlock Everything · Go VIP
            </Button>
          </Link>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] opacity-60">
            <Lock className="h-3 w-3 inline mr-1" /> One sub · every track · every portal
          </p>
        </div>
      )}

      {unlocked && (
        <>
          <Button
            onClick={onDownload}
            disabled={downloading}
            className="mt-4 h-12 w-full text-xs uppercase tracking-[0.3em] font-bold"
            style={{ background: accent, color: "#000" }}
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {downloadRetry.status === "retrying"
                  ? `Retrying (attempt ${downloadRetry.attempt + 1})...`
                  : "Preparing..."}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download HQ MP3
              </>
            )}
          </Button>
          <PreparationProgress
            retry={downloadRetry}
            accent={accent}
            secondary={secondary}
            label="Preparing download…"
          />
          {downloadError && (
            <div
              className="mt-3 rounded-xl border p-3 text-[11px]"
              style={{ borderColor: "#ff6b6b66", color: "#ffb4b4", background: "rgba(80,0,0,0.25)" }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{downloadRetry.errorMessage ?? "Download unavailable"}</span>
              </div>
              <p className="text-center opacity-70 mb-2">
                Tried {downloadRetry.attempt} of 3 automatic retries.
              </p>
              <Button
                onClick={() => downloadRetry.retry()}
                variant="outline"
                className="h-9 w-full text-[10px] uppercase tracking-[0.3em] font-bold border"
                style={{ borderColor: `${accent}66`, color: accent, background: "transparent" }}
              >
                <RotateCw className="h-3.5 w-3.5 mr-2" /> Try again
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={checkoutOpen} onOpenChange={(o) => (o ? setCheckoutOpen(true) : closeAndRefresh())}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-sm uppercase tracking-[0.3em]">
              Unlock {title} — {buyLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="p-2">
            {checkoutOpen && (
              <TrackUnlockCheckout
                trackId={trackId}
                customerEmail={user?.email ?? undefined}
                returnUrl={returnUrl}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}