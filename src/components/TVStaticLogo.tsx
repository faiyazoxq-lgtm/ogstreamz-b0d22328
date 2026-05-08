import logo from "@/assets/logo.jpg";

export function TVStaticLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-block tv-screen rounded-md ring-1 ring-[oklch(0.72_0.22_245/0.55)] ${className}`}>
      <img src={logo} alt="0G-PORTAL" className="h-9 w-9 rounded-md object-cover block" />
      <span aria-hidden className="tv-static-overlay" />
    </span>
  );
}