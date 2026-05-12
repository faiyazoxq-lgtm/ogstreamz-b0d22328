import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Two glowing "eyes" docked to the left and right edges of the screen
 * acting as spotlights. They throw blue lightning bolts at the mouse
 * pointer and emit sparks that track the cursor.
 */
export function SpotlightEyes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => { reducedRef.current = reduced; }, [reduced]);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const sparksRef = useRef<
    { x: number; y: number; vx: number; vy: number; life: number; max: number }[]
  >([]);
  const boltsRef = useRef<
    { from: { x: number; y: number }; to: { x: number; y: number }; life: number; max: number; seed: number }[]
  >([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Cursor tracking removed. The eyes no longer follow the pointer; the
    // spotlight cones rest pointing at the centre of the screen. Each tap
    // (mouse, pen, or touch) fires a one-shot bolt + spark burst from
    // both eyes to the tap location, then the target clears so the eyes
    // return to rest.
    let tapClearTimer: number | undefined;
    const TAP_HOLD_MS = 380;
    // Cooldown so frantic tapping (or accidental double-taps on touch)
    // can't pile bolts + sparks onto the canvas faster than the rAF loop
    // can clear them. We allow a quick burst (BURST_LIMIT taps) inside
    // BURST_WINDOW_MS, then enforce a hard MIN_TAP_GAP_MS minimum gap
    // between accepted taps until the burst counter decays.
    const MIN_TAP_GAP_MS = 120;
    const BURST_WINDOW_MS = 600;
    const BURST_LIMIT = 4;
    let lastTapAt = 0;
    let burstCount = 0;
    const onPointerDown = (e: PointerEvent) => {
      const now = performance.now();
      const sinceLast = now - lastTapAt;
      // Decay the burst counter once the window has elapsed since the
      // last accepted tap.
      if (sinceLast > BURST_WINDOW_MS) burstCount = 0;
      // Hard minimum spacing — drops machine-gun taps below ~8/sec.
      if (sinceLast < MIN_TAP_GAP_MS) return;
      // Soft burst limit — after BURST_LIMIT rapid taps, require the
      // burst window to elapse before accepting more.
      if (burstCount >= BURST_LIMIT && sinceLast < BURST_WINDOW_MS) return;
      lastTapAt = now;
      burstCount++;

      const x = e.clientX;
      const y = e.clientY;
      mouseRef.current.x = x;
      mouseRef.current.y = y;
      mouseRef.current.active = true;
      if (tapClearTimer) window.clearTimeout(tapClearTimer);
      tapClearTimer = window.setTimeout(() => {
        mouseRef.current.active = false;
      }, TAP_HOLD_MS);

      // Force-fire bolts from each eye at the tap, regardless of cadence.
      const eyes = eyePositions();
      eyes.forEach((eye) => {
        boltsRef.current.push({
          from: { x: eye.x, y: eye.y },
          to: { x, y },
          life: 0,
          max: 22 + Math.random() * 12,
          seed: Math.random() * 1000,
        });
      });

      if (reducedRef.current) return;
      // Hard caps so the draw loop never has to chew through unbounded
      // particle counts even if the cooldown is somehow bypassed.
      if (boltsRef.current.length > 24) {
        boltsRef.current.splice(0, boltsRef.current.length - 24);
      }
      if (sparksRef.current.length > 200) {
        sparksRef.current.splice(0, sparksRef.current.length - 200);
      }
      // Spark burst at the tap point.
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 1 + Math.random() * 2.5;
        sparksRef.current.push({
          x, y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0, max: 22 + Math.random() * 18,
        });
      }
    };
    window.addEventListener("pointerdown", onPointerDown, { passive: true });

    let lastBolt = 0;
    // Slow-motion: throttle the canvas to ~20fps and halve all kinetics
    // (bolt cadence, spark velocity, gravity) for a cinematic drift.
    const FRAME_INTERVAL = 1000 / 20;
    let lastFrame = 0;

    function eyePositions() { return [
      { x: 28, y: h * 0.18, side: -1 },
      { x: w - 28, y: h * 0.18, side: 1 },
    ]; }

    const drawBolt = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      alpha: number,
      seed: number
    ) => {
      const segments = 14;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(160,220,255,${alpha * 0.75})`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = `rgba(0,180,255,${alpha * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const jitter = (Math.sin(seed + i * 12.9898) * 43758.5453) % 1;
        const off = (jitter - 0.5) * 38 * (1 - Math.abs(t - 0.5) * 1.4);
        const nx = -dy / Math.hypot(dx, dy);
        const ny = dx / Math.hypot(dx, dy);
        ctx.lineTo(from.x + dx * t + nx * off, from.y + dy * t + ny * off);
      }
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      // bright core
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, alpha * 1.4)})`;
      ctx.shadowBlur = 6;
      ctx.stroke();
    };

    const tick = (ts: number) => {
      if (ts - lastFrame < FRAME_INTERVAL) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastFrame = ts;
      ctx.clearRect(0, 0, w, h);
      const eyes = eyePositions();
      const m = mouseRef.current;

      // Spotlight cones
      eyes.forEach((eye) => {
        const target = m.active ? { x: m.x, y: m.y } : { x: w / 2, y: h / 2 };
        const ang = Math.atan2(target.y - eye.y, target.x - eye.x);
        const len = 1400;
        const spread = 0.32;
        const grad = ctx.createRadialGradient(eye.x, eye.y, 10, eye.x, eye.y, len);
        grad.addColorStop(0, "rgba(80,180,255,0.16)");
        grad.addColorStop(0.35, "rgba(40,120,255,0.05)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.save();
        ctx.translate(eye.x, eye.y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len, -spread, spread);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.globalCompositeOperation = "screen";
        ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = "source-over";

        // Eye orb
        const orb = ctx.createRadialGradient(eye.x, eye.y, 1, eye.x, eye.y, 26);
        orb.addColorStop(0, "rgba(220,240,255,0.95)");
        orb.addColorStop(0.4, "rgba(60,160,255,0.55)");
        orb.addColorStop(1, "rgba(0,40,120,0)");
        ctx.fillStyle = orb;
        ctx.beginPath();
        ctx.arc(eye.x, eye.y, 26, 0, Math.PI * 2);
        ctx.fill();

        // Pupil tracks mouse
        const pdx = target.x - eye.x;
        const pdy = target.y - eye.y;
        const pdist = Math.hypot(pdx, pdy) || 1;
        const px = eye.x + (pdx / pdist) * 6;
        const py = eye.y + (pdy / pdist) * 6;
        ctx.fillStyle = "rgba(10,20,40,0.95)";
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(px - 1, py - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Periodically emit a lightning bolt from each eye to the cursor.
      // Reduced-motion mode: fire ~6× less often, single eye, no edge bolts, no sparks.
      const boltInterval = reducedRef.current ? 4800 : 1100;
      if (m.active && ts - lastBolt > boltInterval) {
        lastBolt = ts;
        if (reducedRef.current) {
          // One subtle bolt from a single eye, longer-lived & dimmer
          const eye = eyes[Math.floor(Math.random() * eyes.length)];
          boltsRef.current.push({
            from: { x: eye.x, y: eye.y },
            to: { x: m.x, y: m.y },
            life: 0,
            max: 26 + Math.random() * 10,
            seed: Math.random() * 1000,
          });
        } else {
        eyes.forEach((eye) => {
          if (Math.random() < 0.55) {
            boltsRef.current.push({
              from: { x: eye.x, y: eye.y },
              to: { x: m.x, y: m.y },
              life: 0,
              max: 18 + Math.random() * 12,
              seed: Math.random() * 1000,
            });
          }
        });
        // Extra bolts coming from random edges/directions toward the mouse
        const edgeCount = Math.random() < 0.6 ? 1 : 0;
        for (let i = 0; i < edgeCount; i++) {
          const side = Math.floor(Math.random() * 4);
          let fx = 0, fy = 0;
          if (side === 0) { fx = Math.random() * w; fy = -10; }
          else if (side === 1) { fx = w + 10; fy = Math.random() * h; }
          else if (side === 2) { fx = Math.random() * w; fy = h + 10; }
          else { fx = -10; fy = Math.random() * h; }
          boltsRef.current.push({
            from: { x: fx, y: fy },
            to: { x: m.x, y: m.y },
            life: 0,
            max: 16 + Math.random() * 14,
            seed: Math.random() * 1000,
          });
        }
        // burst of sparks at cursor
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 1 + Math.random() * 2.5;
          sparksRef.current.push({
            x: m.x, y: m.y,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            life: 0, max: 22 + Math.random() * 18,
          });
        }
        }
      }

      // Draw bolts
      boltsRef.current = boltsRef.current.filter((b) => {
        b.life++;
        const alpha = Math.max(0, 1 - b.life / b.max);
        drawBolt(b.from, b.to, alpha * 0.55, b.seed + b.life * 0.4);
        return b.life < b.max;
      });
      ctx.shadowBlur = 0;

      // Draw sparks
      sparksRef.current = sparksRef.current.filter((p) => {
        p.life++;
        // Slow-mo: half-speed travel + gravity for a hanging-spark look.
        p.x += p.vx * 0.5;
        p.y += p.vy * 0.5;
        p.vy += 0.02;
        const a = Math.max(0, 1 - p.life / p.max);
        ctx.fillStyle = `rgba(140,210,255,${a})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(60,160,255,${a})`;
        ctx.fillRect(p.x, p.y, 1.6, 1.6);
        return p.life < p.max;
      });
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onPointerDown);
      if (tapClearTimer) window.clearTimeout(tapClearTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 opacity-70"
      style={{ mixBlendMode: "screen" }}
    />
  );
}