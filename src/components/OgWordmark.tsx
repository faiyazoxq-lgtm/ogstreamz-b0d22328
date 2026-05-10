import { TrackingEye } from "./TrackingEye";

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
  eyeClassName = EYE_SCALE_CLASS,
  pupilRatio = 0.5,
  travelRatio = 0.18,
  style,
}: {
  suffix?: string;
  className?: string;
  eyeClassName?: string;
  pupilRatio?: number;
  travelRatio?: number;
  style?: React.CSSProperties;
}) {
  const rest = `G${suffix}`;
  return (
    <span
      className={`inline-flex items-center text-eye-ice leading-none tracking-[-0.02em] ${className}`}
      style={style}
    >
      {/* Eye stands in for the leading "O". Sized to the wordmark's own
          cap height (em-based) and shaped as an upright ellipse so it
          reads as a letter, not a disc. */}
      <span className="relative inline-flex items-center justify-center align-middle leading-none w-[0.82em] h-[1em]">
        <TrackingEye
          className={eyeClassName}
          pupilRatio={pupilRatio}
          travelRatio={travelRatio}
        />
      </span>
      {Array.from(rest).map((ch, i) => (
        <span
          key={i}
          style={
            i === 0
              ? {
                  // Pull the G flush against the egg-eye on every breakpoint.
                  // Negative margin closes the optical gap left by the
                  // ellipse's curved right edge; tighter letter-spacing keeps
                  // the rest of "-PORTAL" from drifting away.
                  fontWeight: 900,
                  letterSpacing: "-0.06em",
                  marginLeft: "-0.12em",
                }
              : undefined
          }
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export default OgWordmark;