import { useEffect, useRef, useState } from "react";

/**
 * A small white eyeball whose pupil follows the cursor.
 * Positioned absolutely by the parent (parent must be `relative`).
 */
export function TrackingEye({
  size,
  pupilRatio = 0.55,
  travel,
  travelRatio = 0.18,
  touchMode = "idle",
  idleTravelRatio = 0.06,
  className = "",
  style,
}: {
  size?: number;
  pupilRatio?: number;
  travel?: number;
  travelRatio?: number;
  /**
   * How the eye behaves on touch / coarse-pointer devices.
   *  - "still": pupil stays perfectly centered.
   *  - "idle": pupil drifts subtly in a slow loop (default).
   */
  touchMode?: "still" | "idle";
  /** Travel ratio used for the subtle idle drift in touch mode. */
  idleTravelRatio?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Detect touch / coarse pointer devices — skip mousemove (often missing,
    // or fired only after taps) in favor of a stable pupil or gentle idle drift.
    const isCoarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    if (isCoarse) {
      if (touchMode === "still") {
        setPupil({ x: 0, y: 0 });
        return;
      }
      // Gentle idle drift — slow Lissajous loop, scaled to the eye's width.
      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
        const el = ref.current;
        if (el) {
          const r = el.getBoundingClientRect();
          const t = travel ?? r.width * idleTravelRatio;
          const a = (now - start) / 1000;
          setPupil({
            x: Math.sin(a * 0.9) * t,
            y: Math.cos(a * 0.6) * t * 0.6,
          });
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 200);
      const t = travel ?? r.width * travelRatio;
      setPupil({ x: (dx / dist) * t * k, y: (dy / dist) * t * k });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [travel, travelRatio, touchMode, idleTravelRatio]);

  return (
    <span
      ref={ref}
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full ring-1 ${className}`}
      style={{
        background:
          "linear-gradient(135deg, var(--electric-gold-100), var(--electric-gold-300))",
        boxShadow: "0 0 12px -1px var(--electric-gold-glow)",
        // ring color via CSS var (Tailwind ring-1 uses currentColor fallback through --tw-ring-color)
        ["--tw-ring-color" as string]:
          "color-mix(in oklab, var(--electric-gold-500) 60%, transparent)",
        ...(size ? { width: size, height: size } : null),
        ...style,
      }}
    >
      <span
        className="block rounded-full ring-1 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)] transition-transform duration-75"
        style={{
          background: "var(--midnight-pupil)",
          ["--tw-ring-color" as string]:
            "color-mix(in oklab, var(--electric-gold-900) 70%, transparent)",
          width: `${pupilRatio * 100}%`,
          height: `${pupilRatio * 100}%`,
          transform: `translate(${pupil.x}px, ${pupil.y}px)`,
        }}
      />
    </span>
  );
}

export default TrackingEye;