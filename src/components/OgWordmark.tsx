import { useEffect, useRef, useState } from "react";
import { TrackingPupil } from "./TrackingPupil";
import { EyeLightning } from "./EyeLightning";
import ogEvilEye from "@/assets/og-evil-eye.jpg";
import {
  getBreakpoint,
  readOffsets,
  subscribePupilOffsets,
  type PupilOffsetMap,
} from "@/lib/pupil-calibration";

// Module-level mount counter so only the FIRST live OgWordmark renders the
// global lightning overlay. Every other instance still gets the tracking
// pupil, but only one fixed-position SVG layer exists at a time.
let LIGHTNING_OWNER = 0;

/**
 * Single source of truth for TrackingEye sizing across the brand surface.
 * Em-based so the eye scales 1:1 with whatever font-size its parent sets —
 * navbar wordmark and homepage hero wordmark both inherit this exact formula.
 *
 * The eye is intentionally *taller than wide* so its `rounded-full` shape
 * becomes an upright ellipse — reading as the letter "O" inside the
 * wordmark instead of a perfect circle disc. Tuned against JetBrains Mono
 * cap height so it sits flush with the adjacent "G".
 */
export const EYE_SCALE_CLASS = "w-[0.82em] h-[1em] shrink-0";

/**
 * Shared brand wordmark: a TrackingEye standing in for the leading "0"/"O",
 * followed by a thick "G" and the rest of the word. Use anywhere the brand
 * lockup "0G-PORTAL", "0G-VAULT", "0G-STREAMZ" etc. appears as visible text.
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
  // Artwork "OG" lockup. The painted iris (dark ring around the orange slit)
  // is centered at roughly x=30%, y=49% of the 1920×1047 source, with a
  // diameter ≈19% of art width / 34% of art height. The hotspot below frames
  // exactly that disc so the tracking pupil can travel inside the iris.
  const ART_ASPECT = 1920 / 1047;
  const IRIS_W_PCT = 19;
  const IRIS_H_PCT = 34;
  const IRIS_CENTER_X_PCT = 30;
  const IRIS_CENTER_Y_PCT = 49;

  const irisRef = useRef<HTMLElement>(null);
  const [ownsLightning, setOwnsLightning] = useState(false);
  const [offsets, setOffsets] = useState<PupilOffsetMap>(() => readOffsets());
  const [bp, setBp] = useState(() =>
    typeof window === "undefined" ? "desktop" : getBreakpoint(window.innerWidth),
  );

  useEffect(() => {
    LIGHTNING_OWNER += 1;
    const isOwner = LIGHTNING_OWNER === 1;
    setOwnsLightning(isOwner);
    return () => {
      LIGHTNING_OWNER -= 1;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setBp(getBreakpoint(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    const unsub = subscribePupilOffsets(setOffsets);
    return () => {
      window.removeEventListener("resize", onResize);
      unsub();
    };
  }, []);

  const off = offsets[bp];
  const IRIS_LEFT_PCT = IRIS_CENTER_X_PCT + off.x - IRIS_W_PCT / 2;
  const IRIS_TOP_PCT = IRIS_CENTER_Y_PCT + off.y - IRIS_H_PCT / 2;

  return (
    <span
      className={`inline-flex items-center text-eye-ice leading-none tracking-[-0.02em] ${className}`}
      style={style}
    >
      <span
        className="relative inline-block align-middle leading-none"
        style={{
          // Match cap-height of the surrounding text so the lockup sits on the
          // same baseline as the suffix. Width follows the artwork's aspect.
          height: "1.2em",
          width: `calc(1.2em * ${ART_ASPECT})`,
          marginRight: "0.04em",
          marginLeft: "-0.05em",
        }}
      >
        <img
          src={ogEvilEye}
          alt="0G"
          draggable={false}
          className="block w-full h-full select-none"
          style={{
            // Drop the JPEG's black background on dark surfaces — `screen`
            // turns near-black to transparent so the artwork sits cleanly on
            // the navbar, hero, footer, and login chrome alike.
            mixBlendMode: "screen",
            objectFit: "contain",
          }}
        />
        {/* Iris hotspot — a relative box positioned over the painted iris.
            TrackingPupil renders an absolutely-centered slit inside it that
            translates with the cursor. */}
        <span
          ref={irisRef}
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: `${IRIS_LEFT_PCT}%`,
            top: `${IRIS_TOP_PCT}%`,
            width: `${IRIS_W_PCT}%`,
            height: `${IRIS_H_PCT}%`,
          }}
        >
          <TrackingPupil pupilRatio={0.16} travelRatio={0.22} />
        </span>
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