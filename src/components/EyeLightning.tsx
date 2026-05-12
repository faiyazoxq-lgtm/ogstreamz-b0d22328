import { useEffect, useRef } from "react";

/**
 * Slow-motion lightning trail. Emits soft, jagged blue bolts that arc from a
 * given origin element (the OG evil-eye iris) toward the cursor / tap point,
 * then fade out. Rendered as a fixed, pointer-events-none SVG layer using
 * `mix-blend-mode: screen` so bolts read as light, not solid strokes, on any
 * background.
 */
export function EyeLightning({
  originRef,
}: {
  originRef: React.RefObject<HTMLElement | null>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastEmitRef = useRef(0);

  useEffect(() => {
    const SVG_NS = "http://www.w3.org/2000/svg";

    const emit = (cx: number, cy: number) => {
      const now = performance.now();
      if (now - lastEmitRef.current < 110) return;
      lastEmitRef.current = now;

      const origin = originRef.current?.getBoundingClientRect();
      const svg = svgRef.current;
      if (!origin || !svg) return;

      const ox = origin.left + origin.width / 2;
      const oy = origin.top + origin.height / 2;

      // Don't fire if cursor is basically on the eye.
      const dist = Math.hypot(cx - ox, cy - oy);
      if (dist < 24) return;

      // Build a jagged path from origin → cursor with perpendicular jitter.
      const segments = 7;
      const dx = (cx - ox) / segments;
      const dy = (cy - oy) / segments;
      const nx = -(cy - oy) / dist;
      const ny = (cx - ox) / dist;
      const jitter = Math.min(28, dist * 0.08);
      let d = `M ${ox.toFixed(1)} ${oy.toFixed(1)}`;
      for (let i = 1; i <= segments; i++) {
        const j = i === segments ? 0 : (Math.random() - 0.5) * 2 * jitter;
        const px = ox + dx * i + nx * j;
        const py = oy + dy * i + ny * j;
        d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }

      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(150,210,255,0.9)");
      path.setAttribute("stroke-width", "1.4");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.style.filter =
        "drop-shadow(0 0 6px rgba(90,170,255,0.85)) drop-shadow(0 0 16px rgba(40,90,255,0.55)) drop-shadow(0 0 28px rgba(255,40,60,0.25))";
      path.style.opacity = "0.95";
      path.style.transition = "opacity 1600ms ease-out";
      svg.appendChild(path);

      // Start the slow fade on the next frame so the transition runs.
      requestAnimationFrame(() => {
        path.style.opacity = "0";
      });
      window.setTimeout(() => path.remove(), 1700);
    };

    const onPointer = (e: PointerEvent) => emit(e.clientX, e.clientY);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [originRef]);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 w-screen h-screen"
      style={{ zIndex: 1, mixBlendMode: "screen" }}
    />
  );
}

export default EyeLightning;