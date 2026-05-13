import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EyeLightning } from "./EyeLightning";

// Module-level mount counter so only the FIRST live OgWordmark renders the
// global lightning overlay.
let LIGHTNING_OWNER = 0;

export const EYE_SCALE_CLASS = "w-[0.82em] h-[1em] shrink-0";

/**
 * Shared brand wordmark: an animated "0G" lockup video standing in for the
 * leading "0"/"O" + "G", followed by an optional text suffix.
 *
 *   <OgWordmark suffix="-PORTAL" />
 *   <OgWordmark suffix="-VAULT" className="text-3xl" />
 */
export function OgWordmark({
  suffix = "-PORTAL",
  className = "",
  style,
  fit = false,
  maxFontSize = 96,
  minFontSize = 18,
}: {
  suffix?: string;
  className?: string;
  /** @deprecated kept for API compatibility — ignored by the artwork lockup. */
  eyeClassName?: string;
  /** @deprecated */ pupilRatio?: number;
  /** @deprecated */ travelRatio?: number;
  /** @deprecated */ bloodshot?: boolean;
  /** @deprecated */ evil?: boolean;
  style?: React.CSSProperties;
  /** When true, the wordmark auto-scales its font-size to fill the parent
   *  container width (clamped between min/maxFontSize). */
  fit?: boolean;
  maxFontSize?: number;
  minFontSize?: number;
}) {
  const ART_ASPECT = 1280 / 720;

  const irisRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [fitFontPx, setFitFontPx] = useState<number | null>(null);
  const [ownsLightning, setOwnsLightning] = useState(false);

  useEffect(() => {
    LIGHTNING_OWNER += 1;
    const isOwner = LIGHTNING_OWNER === 1;
    setOwnsLightning(isOwner);
    return () => {
      LIGHTNING_OWNER -= 1;
    };
  }, []);

  // Some mobile browsers ignore autoPlay until the element is in the DOM —
  // nudge it on mount and slow the playback slightly for a smoother loop.
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      try { v.playbackRate = 0.85; } catch {}
      v.play().catch(() => {});
    }
  }, []);

  // Auto-fit: measure parent width and choose a font-size so the wordmark
  // fills it without wrapping. Uses a ResizeObserver so it stays in sync
  // with viewport / container changes.
  useLayoutEffect(() => {
    if (!fit) return;
    const el = wrapRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    // Approx width factor: the lockup is roughly (ART_ASPECT * 1.2) for the
    // mark + (suffix length * 0.55) ems for the suffix at black weight.
    const suffixEms = (suffix?.length ?? 0) * 0.56;
    const totalEms = ART_ASPECT * 1.2 + 0.08 + suffixEms;

    const compute = () => {
      const w = parent.clientWidth;
      if (!w) return;
      const px = Math.max(minFontSize, Math.min(maxFontSize, w / totalEms));
      setFitFontPx(px);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(parent);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [fit, suffix, ART_ASPECT, minFontSize, maxFontSize]);

  return (
    <span
      ref={wrapRef}
      className={`inline-flex items-center text-eye-ice leading-none tracking-[-0.02em] ${className}`}
      style={{
        ...(fitFontPx ? { fontSize: `${fitFontPx}px` } : null),
        ...style,
      }}
    >
      <span
        ref={irisRef}
        className="relative inline-block align-middle leading-none"
        style={{
          height: "1.2em",
          width: `calc(1.2em * ${ART_ASPECT})`,
          marginRight: "0.04em",
          marginLeft: "-0.05em",
          // Promote to its own GPU layer for crisper sampling and smoother
          // playback, and remove sub-pixel shimmer.
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          willChange: "transform, filter",
          // Safari only honors mix-blend-mode reliably when the parent
          // creates its own stacking / isolation context. Without this,
          // `screen` is silently dropped on <video> in WebKit and the
          // artwork shows its black source background.
          isolation: "isolate",
          backgroundColor: "transparent",
        }}
      >
        <video
          ref={videoRef}
          aria-label="0G"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          draggable={false}
          className="block w-full h-full select-none pointer-events-none"
          style={{
            // Drop the source's black background on dark surfaces — `screen`
            // turns near-black to transparent so the artwork sits cleanly on
            // the navbar, hero, footer, and login chrome alike.
            mixBlendMode: "screen",
            objectFit: "contain",
            // Crispen the source video without changing its character: a
            // touch more contrast + saturation kills mid-grey haze around
            // the artwork, and a high-quality upscale filter avoids the
            // soft bilinear default browsers fall back to.
            filter:
              "contrast(1.18) saturate(1.18) brightness(1.05) drop-shadow(0 0 6px oklch(0.72 0.22 245 / 0.55))",
            imageRendering: "auto" as React.CSSProperties["imageRendering"],
            transform: "translateZ(0)",
            // Some Safari versions render <video> with an opaque default
            // background that defeats `screen` blending — force transparency.
            backgroundColor: "transparent",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <source src="/brand/og-blink.webm" type="video/webm" />
          <source src="/brand/og-blink.mp4" type="video/mp4" />
        </video>
      </span>
      {suffix && (
        <span
          style={{
            fontWeight: 900,
            letterSpacing: "-0.045em",
            marginLeft: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          {suffix}
        </span>
      )}
      {ownsLightning && <EyeLightning originRef={irisRef} />}
    </span>
  );
}

export default OgWordmark;
