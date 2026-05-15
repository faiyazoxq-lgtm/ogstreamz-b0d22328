/**
 * Single source of truth for the OG Pass tier system used across the site.
 *
 * Five canonical tiers:
 *   free        — signed in, nothing else
 *   stream_user — connected to OGSTREAMZ M3U
 *   vip         — bought a VIP pass or manually promoted
 *   real_og     — VIP **and** M3U-connected (auto-derived by DB trigger)
 *   boss        — admin / staff (manual only)
 */
export const OG_TIERS = ["free", "stream_user", "vip", "real_og", "boss"] as const;
export type OgTier = (typeof OG_TIERS)[number];

export const OG_TIER_LABEL: Record<OgTier, string> = {
  free: "Free",
  stream_user: "Stream User",
  vip: "VIP",
  real_og: "Real OG",
  boss: "Boss",
};

export const OG_TIER_SHORT: Record<OgTier, string> = {
  free: "Free",
  stream_user: "Stream",
  vip: "VIP",
  real_og: "Real OG",
  boss: "Boss",
};

export const OG_TIER_RANK: Record<OgTier, number> = {
  free: 0,
  stream_user: 1,
  vip: 2,
  real_og: 3,
  boss: 4,
};

export const OG_TIER_TONE: Record<OgTier, string> = {
  free: "border-zinc-600/60 text-zinc-300",
  stream_user: "border-cyan-500/60 text-cyan-300",
  vip: "border-amber-500/60 text-amber-300",
  real_og: "border-fuchsia-500/60 text-fuchsia-300",
  boss: "border-rose-500/60 text-rose-300",
};

export function meetsTier(user: OgTier | null | undefined, required: OgTier) {
  if (!user) return false;
  return (OG_TIER_RANK[user] ?? -1) >= OG_TIER_RANK[required];
}

/**
 * Map legacy `subscription_plan` values to the new OG tier system.
 * Used for backwards compatibility while reading bot/channel records.
 */
export function planToOgTier(plan: string | null | undefined): OgTier {
  switch ((plan ?? "").toLowerCase()) {
    case "metal":
    case "stream_user":
      return "stream_user";
    case "energy":
    case "vip":
      return "vip";
    case "syndicate":
    case "real_og":
      return "real_og";
    case "boss":
      return "boss";
    default:
      return "free";
  }
}

/**
 * Map legacy `rank` (syndicate_rank enum) to OG tier when no og_tier column is present.
 */
export function rankToOgTier(rank: string | null | undefined): OgTier {
  switch ((rank ?? "").toLowerCase()) {
    case "boss":
      return "boss";
    case "vip":
      return "vip";
    case "stream_user":
      return "stream_user";
    case "prospect":
    case "enforcer":
    default:
      return "free";
  }
}
