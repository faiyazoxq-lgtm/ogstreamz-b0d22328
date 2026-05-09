import { useEffect, useRef } from "react";

/**
 * Two glowing "eyes" docked to the left and right edges of the screen
 * acting as spotlights. They throw blue lightning bolts at the mouse
 * pointer and emit sparks that track the cursor.
 */
export function SpotlightEyes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
      // Emit a couple of sparks tracking the mouse
      for (let i = 0; i < 2; i++) {
        sparksRef.current.push({
          x: e.clientX + (Math.random() - 0.5) * 6,
          y: e.clientY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 2.4,
          vy: (Math.random() - 0.5) * 2.4 - 0.4,
          life: 0,
          max: 28 + Math.random() * 22,
        });
      }
      if (sparksRef.current.length > 240) sparksRef.current.splice(0, sparksRef.current.length - 240);
    };
    const onLeave = () => { mouseRef.current.active = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    let lastBolt = 0;

    const eyePositions = () => [
      { x: 28, y: h * 0.45, side: -1 },
      { x: w - 28, y: h * 0.45, side: 1 },
    ];

    const drawBolt = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      alpha: number,
      seed: number
    ) => {
      const segments = 14;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(160,220,255,${alpha})`;
      ctx.shadowBlur = 18;
      ctx.shadowColor = `rgba(0,180,255,${alpha})`;
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
        grad.addColorStop(0, "rgba(80,180,255,0.28)");
        grad.addColorStop(0.35, "rgba(40,120,255,0.10)");
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

      // Periodically emit a lightning bolt from each eye to the cursor
      if (m.active && ts - lastBolt > 140) {
        lastBolt = ts;
        eyes.forEach((eye) => {
          if (Math.random() < 0.85) {
            boltsRef.current.push({
              from: { x: eye.x, y: eye.y },
              to: { x: m.x, y: m.y },
              life: 0,
              max: 8 + Math.random() * 6,
              seed: Math.random() * 1000,
            });
          }
        });
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

      // Draw bolts
      boltsRef.current = boltsRef.current.filter((b) => {
        b.life++;
        const alpha = Math.max(0, 1 - b.life / b.max);
        drawBolt(b.from, b.to, alpha * 0.85, b.seed + b.life * 0.4);
        return b.life < b.max;
      });
      ctx.shadowBlur = 0;

      // Draw sparks
      sparksRef.current = sparksRef.current.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
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
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ mixBlendMode: "screen" }}
    />
  );
}