import { TrackingPupil } from "./TrackingPupil";
import ogEvilEye from "@/assets/og-evil-eye.jpg";

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
  // Artwork "OG" lockup. The painted iris sits at roughly x=34%, y=50% of the
  // 1920×1047 source; the iris itself is ~22% of the image width. Those ratios
  // place the tracking-pupil overlay exactly on top of the painted iris so the
  // eye reads as if it's tracking — same behavior as the previous stylized eye.
  const ART_ASPECT = 1920 / 1047;
  // Iris hotspot inside the artwork (left/top/size as % of the image box).
  const IRIS_LEFT_PCT = 23.4; // left edge of iris bounding box
  const IRIS_TOP_PCT = 39;
  const IRIS_SIZE_PCT = 22; // iris is roughly square

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
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: `${IRIS_LEFT_PCT}%`,
            top: `${IRIS_TOP_PCT}%`,
            width: `${IRIS_SIZE_PCT}%`,
            height: `${IRIS_SIZE_PCT * ART_ASPECT}%`,
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
    </span>
  );
}

export default OgWordmark;