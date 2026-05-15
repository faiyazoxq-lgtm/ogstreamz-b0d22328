import React from "react";

type Props = {
  credits: number | null | undefined;
  className?: string;
  size?: "xs" | "sm";
};

/**
 * Inline coin balance chip used next to user names across roster/list views.
 * Shows 🪙 balance plus an estimated GBP value (1 coin = £0.99).
 */
export function CoinChip({ credits, className = "", size = "xs" }: Props) {
  const coins = Number(credits ?? 0);
  const gbp = (coins * 0.99).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
  });
  const text = size === "sm" ? "text-[11px]" : "text-[10px]";
  return (
    <span
      title={`${coins.toLocaleString()} coins (~${gbp})`}
      className={`inline-flex items-center gap-1 ${text} uppercase tracking-[0.18em] px-1.5 py-0.5 rounded font-black bg-amber-500/15 text-amber-200 border border-amber-400/40 ${className}`}
    >
      🪙 {coins.toLocaleString()}
      <span className="text-amber-100/70 font-bold normal-case tracking-normal">
        ({gbp})
      </span>
    </span>
  );
}

export default CoinChip;