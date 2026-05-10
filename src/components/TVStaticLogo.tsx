import logo from "@/assets/logo.jpg";

export function TVStaticLogo({ className = "", size = 56 }: { className?: string; size?: number }) {
  return (
    <span
      className={`relative inline-block tv-screen rounded-md ring-1 ring-[oklch(0.72_0.22_245/0.55)] ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={logo} alt="0G-PORTAL" className="rounded-md object-cover block" style={{ width: size, height: size }} />
      <span aria-hidden className="tv-static-overlay" />
    </span>
  );
}