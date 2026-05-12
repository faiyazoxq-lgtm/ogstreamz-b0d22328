import logo from "@/assets/logo.gif";

export function TVStaticLogo({
  className = "",
  size,
}: {
  className?: string;
  /** Pixel size override. When omitted, the logo scales fluidly with viewport
   *  width to stay optically aligned with the wordmark inside the navbar. */
  size?: number;
}) {
  // Fluid square that tracks the wordmark's clamp font-size formula
  // (~0.95rem→1.875rem) so icon + text always share the same optical centre.
  // Tighter fluid scale so the logo stays in proportion with the wordmark
  // across phones, tablets, and desktop without dominating the navbar.
  const dim = size ? `${size}px` : "clamp(2.25rem, 5vw + 1rem, 3.5rem)";
  return (
    <span
      className={`relative inline-block tv-screen rounded-md ring-1 ring-[oklch(0.72_0.22_245/0.55)] align-middle ${className}`}
      style={{ width: dim, height: dim, lineHeight: 0 }}
    >
      <img
        src={logo}
        alt="0G-PORTAL"
        className="rounded-md object-cover block w-full h-full"
      />
      <span aria-hidden className="tv-static-overlay" />
    </span>
  );
}