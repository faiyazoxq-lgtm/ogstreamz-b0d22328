import { useEffect, useRef, useState } from "react";

/**
 * Animated credit counter:
 *  - Smoothly count-ups (or down) from the previous value to the new value
 *  - Brief glow + floating ±delta indicator whenever the value changes
 * Drop-in replacement for `{profile?.credits ?? 0}` next to a Coins icon.
 */
export function AnimatedCredits({
  value,
  className = "",
  duration = 700,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState<number>(value);
  const [delta, setDelta] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const prev = useRef<number>(value);
  const raf = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;

    const diff = to - from;
    setDelta(diff);
    setPulse(true);

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + diff * eased));
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        prev.current = to;
      }
    };
    raf.current = requestAnimationFrame(tick);

    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setDelta(null);
      setPulse(false);
    }, 1400);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={`relative inline-flex items-center tabular-nums ${className}`}>
      <span
        className={[
          "transition-all duration-300",
          pulse
            ? "text-gold drop-shadow-[0_0_10px_oklch(0.78_0.18_85/0.85)] scale-110"
            : "",
        ].join(" ")}
      >
        {display}
      </span>
      {delta !== null && delta !== 0 && (
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute -top-3 left-full ml-1 text-[10px] font-black tracking-wider",
            "animate-fade-in",
            delta > 0 ? "text-emerald-400" : "text-rose-400",
          ].join(" ")}
          style={{ animation: "credit-float 1.2s ease-out forwards" }}
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
      <style>{`
        @keyframes credit-float {
          0%   { opacity: 0; transform: translateY(4px); }
          20%  { opacity: 1; transform: translateY(-2px); }
          80%  { opacity: 1; transform: translateY(-10px); }
          100% { opacity: 0; transform: translateY(-16px); }
        }
      `}</style>
    </span>
  );
}

export default AnimatedCredits;
