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
  pupilRatio = 0.22,
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

  // Blink on any pointer down.
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

  return (
    <span
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-1/2 ${className}`}
      style={{
        width: `${pupilRatio * 100}%`,
        // Slit pupil — 4× taller than wide, matches the painted artwork.
        height: `${pupilRatio * 400}%`,
        transform: `translate(calc(-50% + ${pupil.x}px), calc(-50% + ${pupil.y}px)) scaleY(${blink ? 0.1 : 1})`,
        transformOrigin: "center",
        // Bloodshot blue pupil: cold-blue core fading to a faint red bloodshot
        // halo so it reads as an electric-iris over the artwork's red pearl.
        background:
          "radial-gradient(ellipse at 50% 45%, #cfe9ff 0%, #4ea8ff 22%, #0a3a8a 55%, rgba(8,18,60,0) 100%)",
        borderRadius: "45% / 50%",
        boxShadow:
          "0 0 0.3em 0.04em rgba(150,210,255,0.85), 0 0 0.8em 0.14em rgba(40,120,255,0.55), 0 0 1.4em 0.25em rgba(255,40,60,0.35), inset 0 0 0.22em rgba(255,255,255,0.6)",
        willChange: "transform",
        ...style,
      }}
    />
  );
}

export default TrackingPupil;