import React from "react";
import { formatGbp } from "@/lib/coins";

type Props = {
  credits: number | null | undefined;
  className?: string;
  size?: "xs" | "sm";
};

/**
 * Inline coin balance chip used next to user names across roster/list views.
 * Shows 🪙 balance plus its GBP value at the canonical site rate
 * (1 🪙 = £1, see `src/lib/coins.ts`). Formatting goes through the shared
 * `formatGbp` helper so rounding/locale match every promo, pricing page
 * and top-up modal across the site.
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
        className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1 ${text} uppercase tracking-[0.18em] px-1.5 py-0.5 rounded font-black bg-white/5 text-white/45 border border-white/10 ${className}`}
      >
        🪙 —
        <span className="text-white/35 font-bold normal-case tracking-normal">
          (n/a)
        </span>
      </span>
    );
  }

  const coins = Number(credits);
  // 1 🪙 = £1 → cents = coins * 100. Shared helper keeps rounding (whole
  // pounds when integer, 2dp otherwise) consistent with the rest of the site.
  const gbp = formatGbp(coins * 100);
  return (
    <span
      title={`${coins.toLocaleString()} coins (${gbp})`}
      className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1 ${text} uppercase tracking-[0.18em] px-1.5 py-0.5 rounded font-black bg-amber-500/15 text-amber-200 border border-amber-400/40 ${className}`}
    >
      🪙 {coins.toLocaleString()}
      <span className="text-amber-100/70 font-bold normal-case tracking-normal">
        ({gbp})
      </span>
    </span>
  );
}

export default CoinChip;