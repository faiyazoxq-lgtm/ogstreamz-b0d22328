import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatGbp, centsToCoins } from "../../src/lib/coins";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

/**
 * CoinChip uses the canonical 1 🪙 = £1 rate via `formatGbp(coins * 100)`.
 * These tests pin both the underlying currency math and the chip's
 * structural contract (fallback branch, shared helper, mobile-safe classes).
 */
describe("Coin currency math (1 🪙 = £1)", () => {
  it("formats whole-pound amounts without decimals", () => {
    expect(formatGbp(2000)).toBe("£20");
    expect(formatGbp(100)).toBe("£1");
    expect(formatGbp(0)).toBe("£0");
  });

  it("formats fractional amounts with two decimals", () => {
    expect(formatGbp(499)).toBe("£4.99");
    expect(formatGbp(1234)).toBe("£12.34");
  });

  it("respects an explicit 2-decimal override", () => {
    expect(formatGbp(2000, { decimals: 2 })).toBe("£20.00");
  });

  it("converts cents to coins by rounding", () => {
    expect(centsToCoins(2000)).toBe(20);
    expect(centsToCoins(149)).toBe(1); // rounds 1.49 → 1
    expect(centsToCoins(150)).toBe(2); // rounds 1.5 → 2
    expect(centsToCoins(0)).toBe(0);
  });

  it("treats null/undefined cents as 0 (defensive)", () => {
    expect(formatGbp(undefined as unknown as number)).toBe("£0");
    expect(centsToCoins(undefined as unknown as number)).toBe(0);
  });
});

describe("CoinChip component contract (src/components/CoinChip.tsx)", () => {
  const src = read("src/components/CoinChip.tsx");

  it("imports the shared formatGbp helper instead of inlining its own rate", () => {
    expect(src).toMatch(/from\s+["']@\/lib\/coins["']/);
    expect(src).toMatch(/\bformatGbp\b/);
    // Must NOT carry a hand-rolled rate — that would drift from site-wide pricing.
    expect(src).not.toMatch(/\*\s*0\.99/);
  });

  it("multiplies coins by 100 to feed cents-based formatGbp (1 🪙 = £1)", () => {
    expect(src).toMatch(/formatGbp\s*\(\s*coins\s*\*\s*100\s*\)/);
  });

  it("renders a neutral fallback when credits is null/undefined/non-finite", () => {
    expect(src).toMatch(/credits\s*!==\s*null/);
    expect(src).toMatch(/credits\s*!==\s*undefined/);
    expect(src).toMatch(/Number\.isFinite/);
    expect(src).toMatch(/🪙\s*—/); // em-dash placeholder
    expect(src).toMatch(/n\/a/i);
  });

  it("uses tabular currency formatting via toLocaleString for the coin count", () => {
    expect(src).toMatch(/coins\.toLocaleString\(\)/);
  });

  it("is mobile-safe: shrink-0 + whitespace-nowrap on both branches", () => {
    const occurrences = src.match(/shrink-0 whitespace-nowrap/g) ?? [];
    // One for the fallback span, one for the value span.
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("exposes a size prop with xs (default) and sm variants", () => {
    expect(src).toMatch(/size\?\:\s*"xs"\s*\|\s*"sm"/);
    expect(src).toMatch(/text-\[11px\]/); // sm
    expect(src).toMatch(/text-\[10px\]/); // xs
  });

  it("provides an accessible title with both coin count and GBP value", () => {
    expect(src).toMatch(/title=\{`\$\{coins\.toLocaleString\(\)\} coins \(\$\{gbp\}\)`\}/);
  });
});