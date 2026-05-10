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
  className = "",
  style,
}: {
  size?: number;
  pupilRatio?: number;
  travel?: number;
  travelRatio?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
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
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 200);
      const t = travel ?? r.width * travelRatio;
      setPupil({ x: (dx / dist) * t * k, y: (dy / dist) * t * k });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [travel, travelRatio]);

  return (
    <span
      ref={ref}
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full bg-white/90 shadow-[0_0_10px_rgba(120,200,255,0.85)] ring-1 ring-black/40 ${className}`}
      style={{ ...(size ? { width: size, height: size } : null), ...style }}
    >
      <span
        className="block rounded-full bg-black transition-transform duration-75"
        style={{
          width: `${pupilRatio * 100}%`,
          height: `${pupilRatio * 100}%`,
          transform: `translate(${pupil.x}px, ${pupil.y}px)`,
        }}
      />
    </span>
  );
}

export default TrackingEye;