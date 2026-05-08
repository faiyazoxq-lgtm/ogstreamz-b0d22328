import { Radio } from "lucide-react";
import { motion } from "framer-motion";

/**
 * 0G-BRAIN "Live Data" indicator. Glows brightly while Perplexity is actively
 * scouting the web; dim and subdued when idle. Drop in next to any portal headline.
 */
export function LiveDataIcon({
  active,
  accent = "#00e08a",
  label,
  className = "",
}: {
  active: boolean;
  accent?: string;
  label?: string;
  className?: string;
}) {
  const txt = label ?? (active ? "LIVE DATA · SCOUTING" : "LIVE DATA · IDLE");
  return (
    <motion.span
      animate={
        active
          ? { boxShadow: [`0 0 0 0 ${accent}66`, `0 0 18px 4px ${accent}aa`, `0 0 0 0 ${accent}66`] }
          : { boxShadow: `0 0 6px 0 ${accent}33` }
      }
      transition={active ? { duration: 1.4, repeat: Infinity } : { duration: 0.3 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.3em] ${className}`}
      style={{
        color: accent,
        borderColor: `${accent}66`,
        background: active ? `${accent}14` : "rgba(0,0,0,0.35)",
      }}
      aria-live="polite"
    >
      <motion.span
        animate={active ? { opacity: [0.4, 1, 0.4], scale: [1, 1.25, 1] } : { opacity: 0.5 }}
        transition={active ? { duration: 1.1, repeat: Infinity } : { duration: 0.3 }}
        style={{ display: "inline-flex" }}
      >
        <Radio className="h-3 w-3" />
      </motion.span>
      {txt}
    </motion.span>
  );
}

export default LiveDataIcon;