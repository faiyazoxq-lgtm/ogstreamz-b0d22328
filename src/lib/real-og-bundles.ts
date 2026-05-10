// Shared bundle catalog — used by both the client UI and the server checkout fn.
// A bundle = Real OG Pass (£20 standalone) + a coin pack, sold at a discount.

export type RealOgBundle = {
  sku: "real_og_bundle_starter" | "real_og_bundle_bulk";
  name: string;
  tagline: string;
  /** Total bundle price in pence (what Stripe charges). */
  amountCents: number;
  /** Coins granted on top of the Real OG Pass. */
  credits: number;
  /** Standalone price (in pence) of the equivalent coin pack — for "you save" math. */
  packStandaloneCents: number;
  /** Standalone Real OG price in pence — always 2000. */
  ogStandaloneCents: number;
};

export const REAL_OG_BUNDLES: RealOgBundle[] = [
  {
    sku: "real_og_bundle_starter",
    name: "Real OG + Starter Coins",
    tagline: "Lifetime pass + 28 Coins 🪙",
    amountCents: 3900, // £39
    credits: 28,
    packStandaloneCents: 2500, // 25 Coins pack
    ogStandaloneCents: 2000,
  },
  {
    sku: "real_og_bundle_bulk",
    name: "Real OG + Bulk Coins",
    tagline: "Lifetime pass + 120 Coins 🪙",
    amountCents: 10500, // £105
    credits: 120,
    packStandaloneCents: 10000, // 100 Coins pack
    ogStandaloneCents: 2000,
  },
];

export function getBundle(sku: string): RealOgBundle | undefined {
  return REAL_OG_BUNDLES.find((b) => b.sku === sku);
}

export function bundleSavingsCents(b: RealOgBundle): number {
  return Math.max(0, b.ogStandaloneCents + b.packStandaloneCents - b.amountCents);
}