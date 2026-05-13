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
        "border border-[oklch(0.55_0.12_240/0.55)]",
        "bg-[linear-gradient(180deg,oklch(0.28_0.05_240)_0%,oklch(0.16_0.04_240)_50%,oklch(0.22_0.05_240)_100%)]",
        "text-[oklch(0.92_0.05_235)]",
        "shadow-[inset_0_1px_0_oklch(0.85_0.08_235/0.35),inset_0_-1px_0_oklch(0.1_0.03_240/0.7),0_1px_0_oklch(0.05_0.02_240/0.8),0_0_14px_-4px_oklch(0.72_0.22_245/0.55)]",
        sizeCls,
        className,
      ].join(" ")}
    >
      <Sparkles className="h-3 w-3 text-[oklch(0.85_0.18_235)] drop-shadow-[0_0_4px_oklch(0.72_0.22_245/0.9)]" />
      <span>OG PASS</span>
      <span className="text-[oklch(0.96_0.04_235)] tracking-[0.18em] tabular-nums drop-shadow-[0_1px_0_oklch(0.05_0.02_240/0.9)]">{formatted}</span>
    </span>
  );
}
