// Shared between server (webhook) and client (Buy Credits UI).
// Keep keys in sync with the price IDs registered in payments.

export type CreditPack = {
  priceId: string;
  name: string;
  tagline: string;
  amountCents: number;
  // For one-time packs: number of credits to grant on payment.
  // For the subscription, credits === null (we only flip status to "vip").
  credits: number | null;
  recurring: boolean;
};

export const CREDIT_PACKS: Record<string, CreditPack> = {
  starter_pack_10: {
    priceId: "starter_pack_10",
    name: "Starter Pack",
    tagline: "10 Portal Credits",
    amountCents: 499,
    credits: 10,
    recurring: false,
  },
  enforcer_pack_50: {
    priceId: "enforcer_pack_50",
    name: "Enforcer Pack",
    tagline: "50 Portal Credits",
    amountCents: 1999,
    credits: 50,
    recurring: false,
  },
  boss_pack_monthly: {
    priceId: "boss_pack_monthly",
    name: "Boss Pack",
    tagline: "Unlimited monthly VIP",
    amountCents: 2999,
    credits: null,
    recurring: true,
  },
};

export const CREDIT_PACK_LIST: CreditPack[] = [
  CREDIT_PACKS.starter_pack_10,
  CREDIT_PACKS.enforcer_pack_50,
  CREDIT_PACKS.boss_pack_monthly,
];