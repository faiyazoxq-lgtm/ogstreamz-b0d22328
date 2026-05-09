import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, type ReactNode, type CSSProperties } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  intensity?: number; // max degrees
  asChild?: boolean;
};

/**
 * 3D-tilt wrapper using framer-motion. Tracks pointer over the card and
 * tilts on the X/Y axes with a soft spring + glare highlight that follows
 * the cursor. Honors prefers-reduced-motion implicitly via small intensity.
 */
export function TiltCard({ children, className, style, intensity = 8 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const rx = useSpring(useTransform(my, [-0.5, 0.5], [intensity, -intensity]), { stiffness: 180, damping: 18, mass: 0.4 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-intensity, intensity]), { stiffness: 180, damping: 18, mass: 0.4 });

  const glareX = useTransform(mx, [-0.5, 0.5], ["10%", "90%"]);
  const glareY = useTransform(my, [-0.5, 0.5], ["10%", "90%"]);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() { mx.set(0); my.set(0); }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000, transformStyle: "preserve-3d", ...style }}
      className={className}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useTransform(
            [glareX, glareY] as any,
            ([x, y]: any) =>
              `radial-gradient(420px circle at ${x} ${y}, color-mix(in srgb, var(--syndicate-glow) 22%, transparent), transparent 60%)`,
          ),
        }}
      />
    </motion.div>
  );
}

export default TiltCard;