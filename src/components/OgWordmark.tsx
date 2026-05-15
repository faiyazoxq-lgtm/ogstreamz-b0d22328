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
  // Metallic, darker halo. Blur radii are driven by --og-glow so the same
  // lockup reads consistently from 360px phones up to 1920px desktops
  // without the halo overpowering small screens or going faint on big ones.
  const glowScale = "clamp(0.55, 0.45 + 0.35vw, 1.15)";
  const glow = [
    "drop-shadow(0 1px 0 var(--og-metal-ink))",
    "drop-shadow(0 0 calc(4px * var(--og-glow)) var(--og-metal-ink))",
    "drop-shadow(0 0 calc(10px * var(--og-glow)) color-mix(in oklab, var(--og-metal-ink) 82%, transparent))",
    "drop-shadow(0 0 calc(18px * var(--og-glow)) color-mix(in oklab, var(--og-gold-warm) 65%, transparent))",
    "drop-shadow(0 0 calc(34px * var(--og-glow)) color-mix(in oklab, var(--og-gold-deep) 55%, transparent))",
    "drop-shadow(0 0 calc(70px * var(--og-glow)) color-mix(in oklab, var(--og-gold-shadow) 45%, transparent))",
  ].join(" ");
  return (
    <span
      className={`inline-flex items-center align-middle leading-none px-[0.15em] overflow-hidden ${className}`}
      style={{ ["--og-glow" as any]: glowScale, maxHeight: height, ...style }}
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
        className="block w-auto max-w-full select-none pointer-events-none rounded-md object-contain [image-rendering:auto] [-webkit-backface-visibility:hidden] [transform:translateZ(0)]"
        style={{
          height,
          maxHeight: "100%",
          objectFit: "contain",
          filter: glow,
        }}
      />
    </span>
  );
}

export const EYE_SCALE_CLASS = "w-[0.82em] h-[1em] shrink-0";

export default OgWordmark;
