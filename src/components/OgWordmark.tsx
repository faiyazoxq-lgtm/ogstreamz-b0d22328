import ogPortalLogo from "@/assets/og-portal-logo.jpg";

/**
 * Brand lockup: the OG PORTAL artwork (vault + skull) rendered as an image.
 * Replaces the previous animated 0G wordmark. The `suffix` prop is ignored —
 * kept for API compatibility with existing call sites.
 */
export function OgWordmark({
  className = "",
  style,
  fit = false,
  maxFontSize = 96,
  minFontSize: _minFontSize = 18,
}: {
  suffix?: string;
  className?: string;
  eyeClassName?: string;
  pupilRatio?: number;
  travelRatio?: number;
  bloodshot?: boolean;
  evil?: boolean;
  style?: React.CSSProperties;
  fit?: boolean;
  maxFontSize?: number;
  minFontSize?: number;
}) {
  // Height tracks the surrounding font-size so the lockup keeps drop-in
  // parity with the old wordmark. `fit` callers get the max height.
  const height = fit ? `${maxFontSize}px` : "1.6em";
  return (
    <span
      className={`inline-flex items-center align-middle leading-none ${className}`}
      style={style}
    >
      <img
        src={ogPortalLogo}
        alt="OG PORTAL"
        draggable={false}
        className="block w-auto select-none pointer-events-none rounded-md"
        style={{
          height,
          filter: "drop-shadow(0 0 14px oklch(0.72 0.22 245 / 0.55))",
        }}
      />
    </span>
  );
}

export const EYE_SCALE_CLASS = "w-[0.82em] h-[1em] shrink-0";

export default OgWordmark;
