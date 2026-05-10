import logo from "@/assets/logo.jpg";
import { TrackingEye } from "@/components/TrackingEye";

export function TVStaticLogo({ className = "", size = 56 }: { className?: string; size?: number }) {
  return (
    <span
      className={`relative inline-block tv-screen rounded-md ring-1 ring-[oklch(0.72_0.22_245/0.55)] ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={logo} alt="0G-PORTAL" className="rounded-md object-cover block" style={{ width: size, height: size }} />
      {/* Demon eye — perched in the upper-right of the screen */}
      <span
        className="absolute"
        style={{ top: size * 0.14, right: size * 0.12 }}
      >
        <TrackingEye size={size * 0.26} pupilRatio={0.55} travel={size * 0.05} />
      </span>
      <span aria-hidden className="tv-static-overlay" />
    </span>
  );
}