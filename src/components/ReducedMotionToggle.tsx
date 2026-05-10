import { useEffect, useState } from "react";
import { Zap, ZapOff, MonitorCog } from "lucide-react";
import {
  getReducedMotionMode,
  setReducedMotionMode,
  useReducedMotion,
  type ReducedMotionMode,
} from "@/hooks/use-reduced-motion";

/**
 * Tiny floating control to toggle the reduced-motion preference.
 * Cycles: auto → on → off → auto. Persists in localStorage.
 */
export function ReducedMotionToggle() {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<ReducedMotionMode>("auto");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMode(getReducedMotionMode());
    setMounted(true);
  }, [reduced]);

  const cycle = () => {
    const next: ReducedMotionMode = mode === "auto" ? "on" : mode === "on" ? "off" : "auto";
    setReducedMotionMode(next);
    setMode(next);
  };

  const Icon = mode === "off" ? Zap : mode === "on" ? ZapOff : MonitorCog;
  const label =
    mode === "auto"
      ? mounted
        ? `Motion: Auto (${reduced ? "reduced" : "full"})`
        : "Motion: Auto"
      : mode === "on"
        ? "Motion: Reduced"
        : "Motion: Full";

  return (
    <button
      type="button"
      onClick={cycle}
      title={`${label} — click to change`}
      aria-label={label}
      className="fixed bottom-3 right-3 z-[60] flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 backdrop-blur px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-white/75 hover:text-white hover:bg-black/70 transition print:hidden"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}