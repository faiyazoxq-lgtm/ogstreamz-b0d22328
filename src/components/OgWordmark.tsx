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
  // Mobile gets a touch shorter to avoid line-wrap; desktop scales up.
  const height = fit
    ? `${maxFontSize}px`
    : "clamp(1.35em, 1.2em + 0.6vw, 1.7em)";
  // Metallic, darker halo: deep black contrast ring with a tight burnished
  // gold accent. Reads as polished metal under a warm spotlight rather than
  // a soft glow — keeps brand gold but dials saturation down for cinema.
  const glow = [
    "drop-shadow(0 1px 0 rgba(0,0,0,0.85))",
    "drop-shadow(0 0 4px rgba(0,0,0,0.85))",
    "drop-shadow(0 0 10px rgba(0,0,0,0.7))",
    "drop-shadow(0 0 18px oklch(0.55 0.14 72 / 0.65))",
    "drop-shadow(0 0 34px oklch(0.42 0.10 70 / 0.55))",
    "drop-shadow(0 0 70px oklch(0.30 0.06 60 / 0.45))",
  ].join(" ");
  return (
    <span
      className={`inline-flex items-center align-middle leading-none px-[0.15em] ${className}`}
      style={style}
    >
      <img
        src={ogPortalLogo}
        alt="OG PORTAL"
        draggable={false}
        decoding="async"
        loading="eager"
        width={992}
        height={1058}
        sizes="(max-width: 640px) 5em, 8em"
        className="block w-auto select-none pointer-events-none rounded-md [image-rendering:auto] [-webkit-backface-visibility:hidden] [transform:translateZ(0)]"
        style={{
          height,
          filter: glow,
        }}
      />
    </span>
  );
}

export const EYE_SCALE_CLASS = "w-[0.82em] h-[1em] shrink-0";

export default OgWordmark;
