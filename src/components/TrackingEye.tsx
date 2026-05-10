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
  variant = "ice",
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
  /** Color theme. "ice" = white iris + electric blue pupil; "gold" = legacy electric-gold. */
  variant?: "ice" | "gold";
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

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

  // Blink on any pointer down anywhere on the page.
  useEffect(() => {
    let timer = 0;
    const onDown = () => {
      setBlink(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBlink(false), 180);
    };
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.clearTimeout(timer);
    };
  }, []);

  const isIce = variant === "ice";
  const irisBg = isIce
    ? "linear-gradient(135deg, #ffffff, #e6f4ff)"
    : "linear-gradient(135deg, var(--electric-gold-100), var(--electric-gold-300))";
  const irisGlow = isIce
    ? "0 0 12px -1px oklch(0.78 0.2 240 / 0.85)"
    : "0 0 12px -1px var(--electric-gold-glow)";
  const irisRing = isIce
    ? "color-mix(in oklab, oklch(0.72 0.22 245) 60%, transparent)"
    : "color-mix(in oklab, var(--electric-gold-500) 60%, transparent)";
  const pupilBg = isIce ? "oklch(0.55 0.24 255)" : "var(--midnight-pupil)";
  const pupilRing = isIce
    ? "color-mix(in oklab, oklch(0.2 0.08 255) 70%, transparent)"
    : "color-mix(in oklab, var(--electric-gold-900) 70%, transparent)";

  return (
    <span
      ref={ref}
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full ring-1 transition-transform duration-150 ${className}`}
      style={{
        background: irisBg,
        boxShadow: irisGlow,
        ["--tw-ring-color" as string]: irisRing,
        transform: blink ? "scaleY(0.1)" : "scaleY(1)",
        ...(size ? { width: size, height: size } : null),
        ...style,
      }}
    >
      <span
        className="block rounded-full ring-1 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)] transition-transform duration-75"
        style={{
          background: pupilBg,
          ["--tw-ring-color" as string]: pupilRing,
          width: `${pupilRatio * 100}%`,
          height: `${pupilRatio * 100}%`,
          transform: `translate(${pupil.x}px, ${pupil.y}px)`,
        }}
      />
    </span>
  );
}

export default TrackingEye;