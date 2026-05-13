import { Sparkles } from "lucide-react";

/**
 * OG PASS badge — displays a member's unique sequential identity number.
 * Use on every member profile card so each member is identifiable at a glance.
 */
export function OgPassBadge({
  number,
  size = "md",
  className = "",
}: {
  number: number | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (number == null) return null;
  const formatted = `#${String(number).padStart(5, "0")}`;
  const sizeCls =
    size === "lg"
      ? "px-3 py-1 text-[12px]"
      : size === "sm"
      ? "px-2 py-0.5 text-[9px]"
      : "px-2.5 py-0.5 text-[10px]";
  return (
    <span
      title={`OG PASS ${formatted}`}
      className={[
        "inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-[0.22em]",
        "border border-amber-300/60 bg-gradient-to-r from-amber-400/15 via-amber-300/10 to-amber-500/15",
        "text-amber-100 shadow-[0_0_18px_-6px_rgba(255,200,80,0.6)]",
        sizeCls,
        className,
      ].join(" ")}
    >
      <Sparkles className="h-3 w-3 text-amber-300" />
      <span>OG PASS</span>
      <span className="text-amber-200/90 tracking-[0.18em]">{formatted}</span>
    </span>
  );
}
