import type { AccessTier } from "@/lib/access";

/**
 * Single source of truth for subscription / role gating across the app.
 *
 * Each action declares the MINIMUM tier required to perform it. The same
 * map drives:
 *   - <SubscriptionGate> button-level upsell wrapper
 *   - <LiveCostEstimator> action picker (locked rows show Upgrade CTA)
 *   - server-side asserts (assertUsageAccess / assertVipAccess) — the
 *     server is still the source of truth for security; this map only
 *     keeps the UI in sync with those rules.
 */

export type GatedActionKey =
  | "hub:music"
  | "hub:jokes"
  | "hub:trade"
  | "hub:connect"
  | "hub:battle"
  | "hub:tools"
  | "download"
  | "vault"
  | "live_roast"
  | "boss_console";

export type ActionRule = {
  /** Minimum access tier required. */
  min: AccessTier;
  /** Friendly label used in upsell copy ("Spawn music portal"). */
  label: string;
  /** Plain-English perk description shown in the upsell card. */
  perk: string;
};

export const ACTION_RULES: Record<GatedActionKey, ActionRule> = {
  // Hub spawns — Real OG (VIP) only
  "hub:music":   { min: "vip",    label: "Spawn music portal",   perk: "Unlimited MusicHUB studios" },
  "hub:jokes":   { min: "vip",    label: "Spawn jokes portal",   perk: "Unlimited JokesHUB portals" },
  "hub:trade":   { min: "stream", label: "Spawn trade portal",   perk: "TradeHUB access for stream users" },
  "hub:connect": { min: "stream", label: "Spawn connect portal", perk: "ConnectHUB access for stream users" },
  "hub:battle":  { min: "stream", label: "Spawn battle portal",  perk: "BattleHUB access for stream users" },
  "hub:tools":   { min: "vip",    label: "Spawn tools portal",   perk: "Unlimited ToolHUB spawns" },

  // Coin-cost actions
  "download":    { min: "stream", label: "Unlock / download track", perk: "Track unlocks · 1 free per day for Real OG" },
  "vault":       { min: "vip",    label: "Reveal vault item",       perk: "Vault reveal is a Real OG perk" },

  // Feature gates (no coin cost)
  "live_roast":  { min: "vip",    label: "Live Roast",        perk: "Live Roast is reserved for Real OGs" },
  "boss_console":{ min: "boss",   label: "Boss console",      perk: "Boss / admin only" },
};

/** Where the upsell CTA should send the user, by required tier. */
export function upgradeHref(min: AccessTier): "/auth" | "/profile" | "/vip" | "/" {
  if (min === "vip" || min === "boss") return "/vip";
  if (min === "stream") return "/profile";
  if (min === "member") return "/auth";
  return "/";
}

/** Short upsell button label, by required tier. */
export function upgradeCta(min: AccessTier): string {
  if (min === "vip" || min === "boss") return "Upgrade to VIP";
  if (min === "stream") return "Link stream account";
  if (min === "member") return "Sign in";
  return "Continue";
}