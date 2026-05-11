import { useEffect, useRef, useState } from "react";
import { Play, Pause, Lock, Loader2, Crown, Unlock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTrackStreamUrl } from "@/lib/tracks.functions";
import { useAuth } from "@/hooks/use-auth";
import { TrackUnlockCheckout } from "@/components/TrackUnlockCheckout";

type Props = {
  trackId: string;
  title: string;
  priceCents: number;
  accent?: string;
  secondary?: string;
  onUnlocked?: () => void;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "paywall"; priceCents: number; title: string }
  | { kind: "auth" }
  | { kind: "error"; message: string };

/**
 * Streaming player that gates playback behind a server-verified purchase.
 * On Play it fetches a signed stream URL from `getTrackStreamUrl`; if access
 * is denied the player swaps to a clear inline paywall with Buy + VIP CTAs.
 */
export function StreamingPlayer({
  trackId,
  title,
  priceCents,
  accent = "#7CF9FF",
  secondary = "#FF6BFF",
  onUnlocked,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { user } = useAuth();
  const streamFn = useServerFn(getTrackStreamUrl);

  const coinPrice = Math.max(1, Math.round(priceCents / 100));
  const buyLabel = `Buy for ${coinPrice} 🪙`;
  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?unlocked=${trackId}&session_id={CHECKOUT_SESSION_ID}`
      : "";

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (a.duration > 0) setProgress(a.currentTime / a.duration);
    };
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [state.kind]);

  const requestStream = async () => {
    if (!user) {
      setState({ kind: "auth" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const r = await streamFn({ data: { trackId } });
      if (r.allowed) {
        setState({ kind: "ready", url: r.url });
        // Auto-play after URL is ready
        requestAnimationFrame(() => {
          audioRef.current?.play().then(() => setPlaying(true)).catch(() => {
            /* user can press play manually */
          });
        });
      } else if (r.reason === "paywall" && r.track) {
        setState({ kind: "paywall", priceCents: r.track.price_cents, title: r.track.title });
      } else if (r.reason === "not_found") {
        setState({ kind: "error", message: "Track not found" });
      } else if (r.reason === "unavailable") {
        setState({ kind: "error", message: "Stream unavailable right now" });
      } else {
        setState({ kind: "error", message: "Couldn't start stream" });
      }
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.toLowerCase().includes("unauthorized")) setState({ kind: "auth" });
      else setState({ kind: "error", message: msg || "Couldn't start stream" });
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => toast.error("Playback failed"));
    }
  };

  const onMainAction = () => {
    if (state.kind === "ready") togglePlay();
    else requestStream();
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    onUnlocked?.();
    // Re-attempt stream after purchase
    requestStream();
  };

  return (
    <div
      className="rounded-2xl border p-5 relative overflow-hidden"
      style={{
        borderColor: `${accent}55`,
        background: `linear-gradient(135deg, ${accent}10, ${secondary}08)`,
      }}
    >
      <h3 className="text-lg font-bold mb-3" style={{ color: "#fff" }}>{title}</h3>

      {state.kind === "ready" && (
        <audio ref={audioRef} src={state.url} preload="auto" />
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onMainAction}
          disabled={state.kind === "loading"}
          aria-label={playing ? "Pause" : "Play"}
          className="h-12 w-12 rounded-full flex items-center justify-center border-2 transition disabled:opacity-50"
          style={{
            borderColor: accent,
            background: `${accent}25`,
            color: accent,
            boxShadow: `0 0 30px ${accent}55`,
          }}
        >
          {state.kind === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : state.kind === "paywall" || state.kind === "auth" ? (
            <Lock className="h-5 w-5" />
          ) : playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </button>

        <div className="flex-1">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${accent}, ${secondary})`,
              }}
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] mt-1.5 opacity-60">
            {state.kind === "ready"
              ? "Streaming · Full Track"
              : state.kind === "loading"
              ? "Verifying access…"
              : state.kind === "paywall"
              ? "Locked · Purchase required"
              : state.kind === "auth"
              ? "Sign in to stream"
              : state.kind === "error"
              ? "Unavailable"
              : "Tap play to stream"}
          </p>
        </div>
      </div>

      {state.kind === "paywall" && (
        <div
          className="mt-4 rounded-xl border-2 p-4 text-center animate-fade-in"
          style={{
            borderColor: accent,
            background: `linear-gradient(135deg, ${accent}25, ${secondary}15)`,
            boxShadow: `0 0 50px ${accent}88, inset 0 0 20px ${accent}22`,
          }}
        >
          <p className="text-xs uppercase tracking-[0.3em] mb-1 opacity-90 flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5" /> Access Denied
          </p>
          <p className="text-[11px] opacity-70 mb-3">
            You don't own this track yet. Unlock to stream the full version.
          </p>
          <Button
            onClick={() => setCheckoutOpen(true)}
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
        </div>
      )}

      {state.kind === "auth" && (
        <div
          className="mt-4 rounded-xl border p-4 text-center"
          style={{ borderColor: `${accent}66`, background: "rgba(0,0,0,0.4)" }}
        >
          <p className="text-xs uppercase tracking-[0.3em] mb-3 opacity-80 flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5" /> Sign in required
          </p>
          <Link to="/auth">
            <Button
              className="h-11 w-full text-xs uppercase tracking-[0.3em] font-bold"
              style={{ background: accent, color: "#000" }}
            >
              Sign in to stream
            </Button>
          </Link>
        </div>
      )}

      {state.kind === "error" && (
        <div
          className="mt-4 rounded-xl border p-3 text-center text-[11px] flex items-center justify-center gap-2"
          style={{ borderColor: "#ff6b6b66", color: "#ffb4b4", background: "rgba(80,0,0,0.25)" }}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> {state.message}
          <button onClick={requestStream} className="underline ml-2 opacity-80 hover:opacity-100">
            Retry
          </button>
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={(o) => (o ? setCheckoutOpen(true) : closeCheckout())}>
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