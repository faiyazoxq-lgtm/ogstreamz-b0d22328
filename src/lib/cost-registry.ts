// Hard-coded registry of paid external services this project uses.
// Boss toggles per-portal/hub which services are in play; UI rolls these
// up into a single sortable cost tier.

export type ChargeType = "subscription" | "allowance" | "coin" | "payg" | "free";

export type ServiceDef = {
  key: string;
  label: string;
  /** How the user pays for actions that hit this service. */
  chargeType: ChargeType;
  /** Live unit cost we incur per call (USD). 0 if covered by sub. */
  unitCostUsd: number;
  unit: string; // "song", "1k tokens", "request", "month"…
  /** True if WE (boss) pay a flat subscription that covers it. */
  bossSubscribed: boolean;
  notes?: string;
};

// Edit me as subscriptions / pricing change.
export const SERVICES: ServiceDef[] = [
  { key: "lovable_ai_flash", label: "Lovable AI · Gemini 2.5 Flash", chargeType: "allowance",    unitCostUsd: 0,       unit: "request",    bossSubscribed: true,  notes: "Covered by Lovable AI gateway allowance." },
  { key: "lovable_ai_pro",   label: "Lovable AI · Gemini 2.5 Pro",   chargeType: "allowance",    unitCostUsd: 0,       unit: "request",    bossSubscribed: true,  notes: "Counts against monthly AI credit allowance." },
  { key: "lovable_ai_gpt5",  label: "Lovable AI · GPT-5",            chargeType: "allowance",    unitCostUsd: 0,       unit: "request",    bossSubscribed: true },
  { key: "suno",             label: "Suno · song generation",        chargeType: "subscription", unitCostUsd: 0.10,    unit: "song",       bossSubscribed: true,  notes: "Pro plan; live cost shown if we exceed quota." },
  { key: "elevenlabs",       label: "ElevenLabs · TTS",              chargeType: "subscription", unitCostUsd: 0.00018, unit: "char",       bossSubscribed: true },
  { key: "perplexity",       label: "Perplexity · research",         chargeType: "payg",         unitCostUsd: 0.005,   unit: "request",    bossSubscribed: false },
  { key: "firecrawl",        label: "Firecrawl · scrape",            chargeType: "payg",         unitCostUsd: 0.002,   unit: "page",       bossSubscribed: false },
  { key: "apollo",           label: "Apollo · lead enrichment",      chargeType: "subscription", unitCostUsd: 0,       unit: "lead",       bossSubscribed: true },
  { key: "instantly",        label: "Instantly · email outreach",    chargeType: "subscription", unitCostUsd: 0,       unit: "send",       bossSubscribed: true },
  { key: "stripe",           label: "Stripe · payments",             chargeType: "payg",         unitCostUsd: 0.30,    unit: "txn + 2.9%", bossSubscribed: false },
  { key: "telegram_bot",     label: "Telegram bot fleet",            chargeType: "free",         unitCostUsd: 0,       unit: "message",    bossSubscribed: true },
  { key: "iptv_provider",    label: "IPTV upstream provider",        chargeType: "subscription", unitCostUsd: 0,       unit: "stream",     bossSubscribed: true },
  { key: "in_app_coins",     label: "In-app coins (user spend)",     chargeType: "coin",         unitCostUsd: 0,       unit: "coin",       bossSubscribed: false, notes: "Charged to the end-user, not us." },
];

export const SERVICE_BY_KEY: Record<string, ServiceDef> =
  Object.fromEntries(SERVICES.map((s) => [s.key, s]));

/** Tier ordering used for sortable column. Lower = cheaper for boss. */
export const TIER_RANK: Record<ChargeType | "mixed", number> = {
  free: 0,
  coin: 1,
  subscription: 2,
  allowance: 3,
  mixed: 4,
  payg: 5,
};

export type CostSummary = {
  tier: ChargeType | "mixed";
  liveCostUsd: number; // sum of payg unit costs we actually pay
  services: ServiceDef[];
  hasUnsubscribedPaid: boolean; // boss isn't subscribed but service is paid
};

/** Roll up the toggled services into a single tier + live cost. */
export function summarizeCosts(flags: Record<string, boolean> | null | undefined): CostSummary {
  const services = Object.entries(flags ?? {})
    .filter(([, v]) => !!v)
    .map(([k]) => SERVICE_BY_KEY[k])
    .filter(Boolean) as ServiceDef[];

  if (services.length === 0) {
    return { tier: "free", liveCostUsd: 0, services: [], hasUnsubscribedPaid: false };
  }

  const types = new Set(services.map((s) => s.chargeType));
  const tier: ChargeType | "mixed" = types.size === 1 ? [...types][0] : "mixed";
  const liveCostUsd = services
    .filter((s) => !s.bossSubscribed && s.unitCostUsd > 0)
    .reduce((acc, s) => acc + s.unitCostUsd, 0);
  const hasUnsubscribedPaid = services.some(
    (s) => !s.bossSubscribed && s.chargeType !== "free" && s.chargeType !== "coin"
  );
  return { tier, liveCostUsd, services, hasUnsubscribedPaid };
}

export const TIER_LABEL: Record<ChargeType | "mixed", string> = {
  free: "Free",
  coin: "Coins",
  subscription: "Subscription",
  allowance: "Allowance",
  mixed: "Mixed",
  payg: "Live $",
};

export const TIER_BADGE_CLASS: Record<ChargeType | "mixed", string> = {
  free:         "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  coin:         "bg-amber-500/15 text-amber-300 border-amber-500/30",
  subscription: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  allowance:    "bg-violet-500/15 text-violet-300 border-violet-500/30",
  mixed:        "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  payg:         "bg-rose-500/15 text-rose-300 border-rose-500/30",
};