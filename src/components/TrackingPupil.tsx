import { useEffect, useRef, useState } from "react";

/**
 * Headless tracking pupil. Reuses the exact follow/lerp/blink behavior from
 * TrackingEye but renders ONLY the moving pupil, so it can be overlaid on top
 * of an artwork eye (e.g. the OG evil-eye lockup) and make that artwork's iris
 * appear to track the cursor — same way the old stylized eye did.
 *
 * Parent must be `position: relative`. The pupil is centered inside the parent
 * and translated within `travelRatio * parentWidth` of that center.
 */
export function TrackingPupil({
  pupilRatio = 0.55,
  travelRatio = 0.18,
  smoothing = 0.08,
  followGain = 0.5,
  className = "",
  style,
}: {
  /** Pupil width as a fraction of the parent's width. Height = 4× width for the slit. */
  pupilRatio?: number;
  travelRatio?: number;
  smoothing?: number;
  followGain?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const update = (clientX: number, clientY: number) => {
      const el = ref.current?.parentElement;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const t = r.width * travelRatio;
      const mag = Math.min(t, dist * followGain);
      targetRef.current = { x: (dx / dist) * mag, y: (dy / dist) * mag };
    };
    const onPointer = (e: PointerEvent) => update(e.clientX, e.clientY);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });

    let raf = 0;
    const tick = () => {
      const tgt = targetRef.current;
      const cur = currentRef.current;
      const nx = cur.x + (tgt.x - cur.x) * smoothing;
      const ny = cur.y + (tgt.y - cur.y) * smoothing;
      currentRef.current = { x: nx, y: ny };
      setPupil({ x: nx, y: ny });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      cancelAnimationFrame(raf);
    };
  }, [travelRatio, smoothing, followGain]);

  // Blink on any pointer down — and idle-blink every few seconds so the eye
  // feels alive even when the cursor is still.
  useEffect(() => {
    let downTimer = 0;
    let idleTimer = 0;
    const doBlink = (ms = 180) => {
      setBlink(true);
      window.clearTimeout(downTimer);
      downTimer = window.setTimeout(() => setBlink(false), ms);
    };
    const onDown = () => doBlink(200);
    window.addEventListener("pointerdown", onDown);

    const scheduleIdle = () => {
      // Random 2.5–6s idle blink cadence.
      const delay = 2500 + Math.random() * 3500;
      idleTimer = window.setTimeout(() => {
        doBlink(170);
        // Occasional double-blink for life.
        if (Math.random() < 0.25) {
          window.setTimeout(() => doBlink(140), 320);
        }
        scheduleIdle();
      }, delay);
    };
    scheduleIdle();

    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.clearTimeout(downTimer);
      window.clearTimeout(idleTimer);
    };
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-1/2 ${className}`}
      style={{
        width: `${pupilRatio * 100}%`,
        // Egg-shaped pupil — taller than wide, narrower top, rounder bottom.
        height: `${pupilRatio * 130}%`,
        transform: `translate(calc(-50% + ${pupil.x}px), calc(-50% + ${pupil.y}px)) scaleY(${blink ? 0.05 : 1})`,
        transformOrigin: "center",
        // Hot red pupil — bright blood core fading to deep crimson, with an
        // outer red glow so it reads as a glowing eye even at small sizes.
        background:
          "radial-gradient(ellipse at 50% 55%, #fff 0%, #ffd0c0 8%, #ff3a1a 28%, #c40000 60%, rgba(80,0,0,0) 100%)",
        // Egg shape: narrower top (40%), wider bottom (55%) on the X axis.
        borderRadius: "50% 50% 55% 55% / 42% 42% 58% 58%",
        boxShadow:
          "0 0 0.35em 0.05em rgba(255,80,40,0.9), 0 0 0.9em 0.15em rgba(255,30,0,0.7), 0 0 1.6em 0.3em rgba(255,0,0,0.45), inset 0 0 0.25em rgba(255,255,255,0.45)",
        willChange: "transform",
        ...style,
      }}
    />
  );
}

export default TrackingPupil;