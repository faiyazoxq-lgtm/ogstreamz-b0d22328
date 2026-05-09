import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logo.jpg";

export function TVStaticLogo({ className = "", size = 56 }: { className?: string; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const max = 3.2; // pixels of pupil travel
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 200);
      setPupil({ x: (dx / dist) * max * k, y: (dy / dist) * max * k });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <span
      ref={ref}
      className={`relative inline-block tv-screen rounded-md ring-1 ring-[oklch(0.72_0.22_245/0.55)] ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={logo} alt="0G-PORTAL" className="rounded-md object-cover block" style={{ width: size, height: size }} />
      {/* Demon eye overlay */}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 shadow-[0_0_10px_rgba(120,200,255,0.8)] flex items-center justify-center"
        style={{ width: size * 0.28, height: size * 0.28 }}
      >
        <span
          className="block rounded-full bg-black transition-transform duration-75"
          style={{ width: size * 0.16, height: size * 0.16, transform: `translate(${pupil.x}px, ${pupil.y}px)` }}
        />
      </span>
      <span aria-hidden className="tv-static-overlay" />
    </span>
  );
}