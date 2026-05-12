import { useEffect, useRef, useState } from "react";
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
}) {
  const ART_ASPECT = 1280 / 720;

  const irisRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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
  // nudge it on mount.
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.play().catch(() => {});
    }
  }, []);

  return (
    <span
      className={`inline-flex items-center text-eye-ice leading-none tracking-[-0.02em] ${className}`}
      style={style}
    >
      <span
        ref={irisRef}
        className="relative inline-block align-middle leading-none"
        style={{
          height: "1.2em",
          width: `calc(1.2em * ${ART_ASPECT})`,
          marginRight: "0.04em",
          marginLeft: "-0.05em",
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
