// Coin currency: 1 🪙 = £1. All GBP prices are also presented as Coins.
export const COIN = "🪙";

export function centsToCoins(cents: number): number {
  return Math.round((cents || 0) / 100);
}

/** "£20" or "£4.99" */
export function formatGbp(cents: number, opts: { decimals?: 0 | 2 } = {}): string {
  const n = (cents || 0) / 100;
  const d = opts.decimals ?? (Number.isInteger(n) ? 0 : 2);
  return `£${n.toFixed(d)}`;
}

/** "(20 🪙)" */
export function coinChip(cents: number): string {
  return `(${centsToCoins(cents).toLocaleString()} ${COIN})`;
}

/** "£20 (20 🪙)" */
export function formatGbpWithCoins(cents: number, opts: { decimals?: 0 | 2 } = {}): string {
  return `${formatGbp(cents, opts)} ${coinChip(cents)}`;
}

/** Currency-aware: append coin chip only for GBP. */
export function formatMoneyWithCoins(cents: number, currency: string | null | undefined): string {
  const cur = (currency || "gbp").toLowerCase();
  const symbol = cur === "gbp" ? "£" : cur === "usd" ? "$" : cur === "eur" ? "€" : "";
  const base = symbol
    ? `${symbol}${((cents || 0) / 100).toFixed(2)}`
    : `${((cents || 0) / 100).toFixed(2)} ${cur.toUpperCase()}`;
  if (cur !== "gbp") return base;
  return `${base} ${coinChip(cents)}`;
}
