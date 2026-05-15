import React from "react";

type Props = {
  credits: number | null | undefined;
  className?: string;
  size?: "xs" | "sm";
};

/**
 * Inline coin balance chip used next to user names across roster/list views.
 * Shows 🪙 balance plus an estimated GBP value (1 coin = £0.99).
 * When credits is null/undefined or not finite, renders a neutral
 * "🪙 —" fallback so the UI never shows a misleading 0 / £0.00.
 */
export function CoinChip({ credits, className = "", size = "xs" }: Props) {
  const text = size === "sm" ? "text-[11px]" : "text-[10px]";
  const hasValue =
    credits !== null && credits !== undefined && Number.isFinite(Number(credits));

  if (!hasValue) {
    return (
      <span
        title="Coin balance unavailable"
        aria-label="Coin balance unavailable"
        className={`inline-flex items-center gap-1 ${text} uppercase tracking-[0.18em] px-1.5 py-0.5 rounded font-black bg-white/5 text-white/45 border border-white/10 ${className}`}
      >
        🪙 —
        <span className="text-white/35 font-bold normal-case tracking-normal">
          (n/a)
        </span>
      </span>
    );
  }

  const coins = Number(credits);
  const gbp = (coins * 0.99).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
  });
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