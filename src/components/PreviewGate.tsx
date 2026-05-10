import { useEffect, useRef, useState, type RefObject } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Crown, Lock, Loader2, Play, X } from "lucide-react";
import {
  peekPortalDownload,
  claimPortalDownload,
  type DownloadPeek,
} from "@/lib/portal-downloads.functions";
import { InsufficientBalanceModal } from "@/components/InsufficientBalanceModal";

const PREVIEW_SECONDS = 30;

type Props = {
  portalId: string;
  /** Credits charged for the full download (default 2). */
  cost?: number;
  /** Friendly name shown in the paywall ("Stream", "Track", etc). */
  itemLabel?: string;
  /** Called after the user has been charged (or used VIP free) and is allowed to download. */
  onUnlock: (meta: { mode: "vip_free" | "paid"; cost: number; balance: number }) => void;
  /** Render-prop for the trigger. `start` opens the preview countdown + paywall. */
  children: (api: { start: () => void; busy: boolean; locked: boolean }) => React.ReactNode;
  /**
   * Optional ref to an HTMLMediaElement (audio/video) playing the preview.
   * When the 30-second timer expires, the element is paused, its currentTime
   * is clamped to the cutoff, and `controls`/seeking is locked until the user
   * pays. This enforces the cutoff at the media layer, not just in the UI.
   */
  mediaRef?: RefObject<HTMLMediaElement | null>;
  /**
   * When true (default), automatically charge / burn a VIP pass the moment the
   * 30-second preview ends — no extra confirmation tap. If the balance is too
   * low we swap in the friendly InsufficientBalanceModal instead.
   */
  autoCharge?: boolean;
  /** Optional handler routed to the InsufficientBalanceModal "Top up" button. */
  onTopUp?: () => void;
};

export function PreviewGate({
  portalId,
  cost = 2,
  itemLabel = "download",
  onUnlock,
  children,
  autoCharge = true,
  onTopUp,
  mediaRef,
}: Props) {
  const peek = useServerFn(peekPortalDownload);
  const claim = useServerFn(claimPortalDownload);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"preview" | "paywall" | "charging">("preview");
  const [secondsLeft, setSecondsLeft] = useState(PREVIEW_SECONDS);
  const [info, setInfo] = useState<DownloadPeek | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const tickRef = useRef<number | null>(null);
  const cutoffEnforcedRef = useRef(false);

  // Hard-cutoff enforcement on the media element: pause, clamp time, block seek.
  const enforceCutoff = () => {
    const el = mediaRef?.current;
    if (!el) return;
    cutoffEnforcedRef.current = true;
    try {
      el.pause();
      if (Number.isFinite(el.duration) && el.currentTime > PREVIEW_SECONDS) {
        el.currentTime = PREVIEW_SECONDS;
      }
    } catch {
      /* ignore — element might not be ready */
    }
  };

  // While the preview is running, also clamp playback if the user fast-forwards
  // past the 30s mark, and re-pause if they hit play after the cutoff.
  useEffect(() => {
    const el = mediaRef?.current;
    if (!el) return;
    const onTimeUpdate = () => {
      if (unlocked) return;
      if (el.currentTime >= PREVIEW_SECONDS) {
        enforceCutoff();
      }
    };
    const onPlay = () => {
      if (unlocked) return;
      if (cutoffEnforcedRef.current || el.currentTime >= PREVIEW_SECONDS) {
        el.pause();
      }
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("play", onPlay);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("play", onPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaRef?.current, unlocked]);

  const stopTick = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
  };

  const start = async () => {
    if (unlocked) return; // already paid this session
    setOpen(true);
    setPhase("preview");
    setSecondsLeft(PREVIEW_SECONDS);
    setError(null);
    cutoffEnforcedRef.current = false;
    try {
      const i = await peek({ data: { portalId, cost } });
      setInfo(i);
    } catch (e: any) {
      setError(e?.message || "Couldn't check download status");
    }
    stopTick();
    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopTick();
          enforceCutoff();
          if (autoCharge) {
            // Fire and forget — confirm() handles its own state transitions.
            void confirm();
          } else {
            setPhase("paywall");
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => () => stopTick(), []);

  const close = () => { stopTick(); setOpen(false); };

  const confirm = async () => {
    setBusy(true); setError(null); setPhase("charging");
    try {
      const res = await claim({ data: { portalId, cost } });
      if (!res.ok) {
        if (res.error === "insufficient") {
          // Hand off to the dedicated insufficient-balance flow.
          stopTick();
          setOpen(false);
          setInsufficientOpen(true);
          return;
        }
        setError(res.message || "Couldn't process payment.");
        setPhase("paywall");
        return;
      }
      setUnlocked(true);
      setOpen(false);
      onUnlock({ mode: res.mode, cost: res.cost, balance: res.balance });
    } catch (e: any) {
      const message = String(e?.message || "Couldn't process payment.");
      if (message.toLowerCase().includes("insufficient")) {
        stopTick();
        setOpen(false);
        setInsufficientOpen(true);
      } else {
        setError(message);
        setPhase("paywall");
      }
    } finally { setBusy(false); }
  };

  return (
    <>
      {children({ start, busy, locked: !unlocked })}
      <InsufficientBalanceModal
        open={insufficientOpen}
        cost={cost}
        balance={info?.balance ?? null}
        itemLabel={itemLabel}
        onClose={() => setInsufficientOpen(false)}
        onTopUp={onTopUp}
      />
      {open && (
        <div role="dialog" aria-modal className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <button onClick={close} aria-label="Close" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            {phase === "preview" ? (
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Play className="h-3.5 w-3.5" /> Free preview
                </div>
                <h3 className="mt-2 text-lg font-bold">Sampling this {itemLabel}…</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You get a free 30-second taste. After that, unlock the full {itemLabel}.
                </p>
                <div className="mt-4 flex items-baseline justify-between rounded-md bg-secondary/40 border border-border px-3 py-2">
                  <span className="text-xs text-muted-foreground">Time remaining</span>
                  <span className="font-mono text-2xl font-bold">{secondsLeft}s</span>
                </div>
                <button
                  onClick={() => { stopTick(); setPhase("paywall"); setSecondsLeft(0); }}
                  className="mt-4 w-full rounded-md bg-secondary text-foreground px-3 py-2 text-sm hover:opacity-90"
                >
                  Skip preview &amp; unlock now
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Preview ended
                </div>
                <h3 className="mt-2 text-lg font-bold">Unlock the full {itemLabel}</h3>

                {info?.vip_free_available ? (
                  <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 p-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                      <Crown className="h-4 w-4" /> VIP free pass available
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You haven't used today's free pass for this portal yet — unlock without spending credits.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-border bg-secondary/40 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Coins className="h-4 w-4" /> Cost
                      </span>
                      <span className="font-bold">{cost} credits</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Your balance</span>
                      <span className="font-mono">{info?.balance ?? "—"}</span>
                    </div>
                    {info?.is_real_og && (
                      <p className="mt-2 text-[11px] text-amber-300/80">
                        VIP free pass for this portal already used today — extra unlocks cost {cost} credits each.
                      </p>
                    )}
                  </div>
                )}

                {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

                <div className="mt-4 flex items-center gap-2">
                  <button onClick={close} className="flex-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/40">
                    Cancel
                  </button>
                  <button
                    onClick={confirm}
                    disabled={busy || phase === "charging" || (!info?.vip_free_available && !(info?.can_pay))}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : info?.vip_free_available ? <Crown className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                    {info?.vip_free_available ? "Use VIP pass" : `Spend ${cost} credits`}
                  </button>
                </div>
                {!info?.vip_free_available && info && !info.can_pay && (
                  <p className="mt-2 text-[11px] text-destructive">
                    Not enough credits — top up to unlock.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}