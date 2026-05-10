import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A small white eyeball whose pupil follows the cursor.
 * Positioned absolutely by the parent (parent must be `relative`).
 */
export function TrackingEye({
  size,
  pupilRatio = 0.55,
  travel,
  travelRatio = 0.18,
  smoothing = 0.22,
  followGain = 0.5,
  touchMode = "idle",
  idleTravelRatio = 0.06,
  variant = "ice",
  bloodshot = false,
  className = "",
  style,
}: {
  size?: number;
  pupilRatio?: number;
  travel?: number;
  travelRatio?: number;
  /** 0–1 lerp factor per frame. Higher = snappier, lower = smoother. */
  smoothing?: number;
  /** Pupil offset = min(travel, distance * followGain). */
  followGain?: number;
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
  /** Adds red veins + pinkish iris tint for a bloodshot look. */
  bloodshot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  // Per-instance phase so multiple eyes on screen don't drift in lockstep
  // — keeps the page feeling alive without looking robotic.
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useEffect(() => {
    // Detect touch / coarse pointer + reduced-motion preference. On those
    // surfaces we skip pointer/touch listeners entirely (which would
    // otherwise jitter the pupil during scroll) and either pin the pupil
    // dead-center ("still") or run a slow time-based idle drift ("idle").
    const mql =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(hover: none) and (pointer: coarse)")
        : null;
    const reduced =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    const isCoarse = !!mql?.matches;

    const writeGlowVars = (nx: number, ny: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const tMax = travel ?? r.width * travelRatio;
      const reach = tMax > 0 ? Math.min(1, Math.hypot(nx, ny) / tMax) : 0;
      const rootMult =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--eye-glow-multiplier",
          ),
        ) || 1;
      el.style.setProperty("--eye-glow", String((0.35 + reach * 0.65) * rootMult));
      const sizePx = r.width || 28;
      el.style.setProperty("--eye-glow-base", `${(sizePx * 0.28).toFixed(2)}px`);
      el.style.setProperty("--eye-glow-spread", `${(sizePx * 0.65).toFixed(2)}px`);
      el.style.setProperty("--eye-glow-inner", `${(sizePx * 0.07).toFixed(2)}px`);
      el.style.setProperty("--eye-glow-inner-spread", `${(sizePx * 0.22).toFixed(2)}px`);
    };

    // ─── Touch / coarse pointer paths ──────────────────────────────────
    if (isCoarse || reduced) {
      // Always pin to centre first so a re-mount doesn't show a stale offset.
      currentRef.current = { x: 0, y: 0 };
      setPupil({ x: 0, y: 0 });
      writeGlowVars(0, 0);

      if (touchMode === "still" || reduced) {
        // Nothing else to do — no listeners, no rAF, no jank.
        return;
      }

      // Subtle, slow Lissajous drift driven purely by time. Capped tightly
      // so the pupil never visibly "tracks" anything — it just breathes.
      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
        const el = ref.current;
        if (!el) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const r = el.getBoundingClientRect();
        const t = (now - start) / 1000;
        const amp = (travel ?? r.width * travelRatio) * idleTravelRatio;
        // Two slow sine waves at incommensurate periods → organic drift.
        const nx = Math.sin(t * 0.6 + phase) * amp;
        const ny = Math.cos(t * 0.43 + phase * 1.3) * amp * 0.7;
        currentRef.current = { x: nx, y: ny };
        setPupil({ x: nx, y: ny });
        writeGlowVars(nx, ny);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    // ─── Desktop / fine pointer path ───────────────────────────────────
    const updateTarget = (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const t = travel ?? r.width * travelRatio;
      const mag = Math.min(t, dist * followGain);
      targetRef.current = { x: (dx / dist) * mag, y: (dy / dist) * mag };
    };

    const onPointer = (e: PointerEvent) => updateTarget(e.clientX, e.clientY);
    window.addEventListener("pointermove", onPointer, { passive: true });

    // rAF lerp toward the target — smooth motion independent of input rate.
    let raf = 0;
    const tick = () => {
      const tgt = targetRef.current;
      const cur = currentRef.current;
      const nx = cur.x + (tgt.x - cur.x) * smoothing;
      const ny = cur.y + (tgt.y - cur.y) * smoothing;
      currentRef.current = { x: nx, y: ny };
      if (Math.abs(nx - cur.x) > 0.02 || Math.abs(ny - cur.y) > 0.02) {
        setPupil({ x: nx, y: ny });
      }
      writeGlowVars(nx, ny);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(raf);
    };
  }, [travel, travelRatio, smoothing, followGain, touchMode, idleTravelRatio, phase]);

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
    ? bloodshot
      ? "linear-gradient(135deg, #fff5f5, #ffe0e6 55%, #f0d8ff)"
      : "linear-gradient(135deg, #ffffff, #e6f4ff)"
    : "linear-gradient(135deg, var(--electric-gold-100), var(--electric-gold-300))";
  const irisGlow = isIce
    ? bloodshot
      ? "0 0 var(--eye-glow-base, 8px) -1px oklch(0.65 0.22 25 / 0.7), 0 0 calc(var(--eye-glow-base, 8px) + var(--eye-glow, 0.35) * var(--eye-glow-spread, 18px)) -2px color-mix(in oklab, oklch(0.78 0.2 240) calc(var(--eye-glow, 0.35) * 95%), transparent)"
      : "0 0 calc(var(--eye-glow-base, 8px) + var(--eye-glow, 0.35) * var(--eye-glow-spread, 18px)) -1px color-mix(in oklab, oklch(0.78 0.2 240) calc(var(--eye-glow, 0.35) * 100%), transparent), 0 0 calc(var(--eye-glow-inner, 2px) + var(--eye-glow, 0.35) * var(--eye-glow-inner-spread, 6px)) color-mix(in oklab, oklch(0.85 0.18 235) calc(var(--eye-glow, 0.35) * 70%), transparent)"
    : "0 0 calc(var(--eye-glow-base, 8px) + var(--eye-glow, 0.35) * var(--eye-glow-spread, 16px)) -1px var(--electric-gold-glow)";
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
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full ring-1 transition-transform duration-150 ${className}`}
      style={{
        background: irisBg,
        boxShadow: irisGlow,
        ["--tw-ring-color" as string]: irisRing,
        transform: blink ? "scaleY(0.1)" : "scaleY(1)",
        ...(size ? { width: size, height: size } : null),
        ...style,
      }}
    >
      {bloodshot && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: [
              "radial-gradient(circle at 18% 30%, transparent 38%, oklch(0.55 0.27 25 / 0.85) 39%, transparent 41%)",
              "radial-gradient(circle at 78% 22%, transparent 34%, oklch(0.5 0.27 22 / 0.8) 35%, transparent 37%)",
              "radial-gradient(circle at 25% 78%, transparent 36%, oklch(0.55 0.28 18 / 0.75) 37%, transparent 39%)",
              "radial-gradient(circle at 82% 72%, transparent 32%, oklch(0.5 0.27 28 / 0.7) 33%, transparent 35%)",
              "radial-gradient(circle at 50% 12%, transparent 30%, oklch(0.55 0.25 20 / 0.65) 31%, transparent 33%)",
              "radial-gradient(circle at 50% 88%, transparent 28%, oklch(0.55 0.26 24 / 0.6) 29%, transparent 31%)",
              "radial-gradient(circle at 50% 50%, oklch(0.6 0.22 20 / 0.18), transparent 70%)",
            ].join(", "),
            mixBlendMode: "multiply",
          }}
        />
      )}
      <span
        className="relative block rounded-full ring-1 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)] transition-transform duration-75"
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