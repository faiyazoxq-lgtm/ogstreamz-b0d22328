import { Crown, Sparkles } from "lucide-react";

type Size = "sm" | "md" | "lg";

/**
 * RealOgBadge — gold prestige badge for VIP pass holders ("Real OGs").
 * Variants: "pill" (compact, header-friendly) and "badge" (larger, profile-friendly).
 */
export function RealOgBadge({
  variant = "pill",
  size = "md",
  className = "",
}: {
  variant?: "pill" | "badge";
  size?: Size;
  className?: string;
}) {
  const sizing =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : size === "lg"
        ? "px-4 py-1.5 text-sm gap-2"
        : "px-2.5 py-1 text-xs gap-1.5";

  const iconSize =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (variant === "badge") {
    return (
      <span
        title="Real OG — VIP Pass holder. Treated with street OG respect."
        className={[
          "inline-flex items-center font-black uppercase tracking-[0.25em] rounded-full",
          "border border-gold/70 text-gold",
          "bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20",
          "shadow-[0_0_22px_-4px_oklch(0.82_0.16_85/0.85)]",
          "animate-pulse-gold",
          sizing,
          className,
        ].join(" ")}
      >
        <Crown className={`${iconSize} drop-shadow-[0_0_6px_rgba(255,209,102,0.85)]`} />
        Real OG
        <Sparkles className={`${iconSize} opacity-90`} />
      </span>
    );
  }

  return (
    <span
      title="Real OG — VIP Pass holder"
      className={[
        "inline-flex items-center font-bold uppercase tracking-[0.22em] rounded-md",
        "border border-gold/60 text-gold bg-gold/10",
        "shadow-[0_0_14px_-6px_oklch(0.82_0.16_85/0.8)]",
        sizing,
        className,
      ].join(" ")}
    >
      <Crown className={iconSize} />
      Real OG
    </span>
  );
}
