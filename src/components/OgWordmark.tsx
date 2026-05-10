import { TrackingEye } from "./TrackingEye";

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
  eyeClassName = "w-[1.1em] h-[1.1em] shrink-0",
  pupilRatio = 0.5,
  travelRatio = 0.18,
}: {
  suffix?: string;
  className?: string;
  eyeClassName?: string;
  pupilRatio?: number;
  travelRatio?: number;
}) {
  const rest = `G${suffix}`;
  return (
    <span className={`inline-flex items-center text-eye-ice leading-none ${className}`}>
      <span className="relative inline-block align-middle leading-none">
        {/* keep "0" width so the eye sits exactly where the digit would */}
        <span aria-hidden className="invisible">0</span>
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <TrackingEye
            className={eyeClassName}
            pupilRatio={pupilRatio}
            travelRatio={travelRatio}
          />
        </span>
      </span>
      {Array.from(rest).map((ch, i) => (
        <span key={i} style={i === 0 ? { fontWeight: 900, letterSpacing: "-0.04em" } : undefined}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export default OgWordmark;