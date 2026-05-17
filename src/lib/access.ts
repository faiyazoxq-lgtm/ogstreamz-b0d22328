import { useAuth, type SyndicateRank } from "@/hooks/use-auth";
import { isBossProfile, isStreamProfile, isVipProfile } from "@/lib/roles";

/**
 * Role / access tiers for the OGSTREAMZ access ladder.
 *
 *   visitor   — anonymous / signed-out — marketing only
 *   member    — signed in (prospect or enforcer rank) — marketing + their own profile
 *   stream    — OGSTREAMZ stream_user (Boss-approved stream link) — usage features
 *   vip       — VIP / Real OG — upgraded capabilities
 *   boss      — Boss / admin — everything
 */
export type AccessTier = "visitor" | "member" | "stream" | "vip" | "boss";

const TIER_ORDER: AccessTier[] = ["visitor", "member", "stream", "vip", "boss"];

export function tierAtLeast(tier: AccessTier, min: AccessTier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);
}

export function tierFor(opts: {
  signedIn: boolean;
  rank: SyndicateRank | null | undefined;
  status: "free" | "vip" | null | undefined;
  isAdmin: boolean;
  banned: boolean;
}): AccessTier {
  if (!opts.signedIn) return "visitor";
  if (opts.banned) return "visitor"; // banned users get marketing only
  const profile = { rank: opts.rank ?? null, status: opts.status ?? null };
  if (isBossProfile(profile, { isAdmin: opts.isAdmin })) return "boss";
  if (isVipProfile(profile, { isAdmin: opts.isAdmin })) return "vip";
  if (isStreamProfile(profile, { isAdmin: opts.isAdmin })) return "stream";
  return "member";
}

export const TIER_LABEL: Record<AccessTier, string> = {
  visitor: "Visitor",
  member: "Member",
  stream: "OGSTREAMZ User",
  vip: "VIP / Real OG",
  boss: "Boss",
};

export type Access = {
  tier: AccessTier;
  signedIn: boolean;
  banned: boolean;
  /** Marketing pages, public portals, store. Always true. */
  canViewMarketing: boolean;
  /** Use streaming/usage features (calculators, joke generation, etc.). */
  canUseFeatures: boolean;
  /** VIP-only capabilities (vault reveal, unlimited scans, etc.). */
  hasVipPower: boolean;
  /** Boss console access. */
  isBoss: boolean;
  atLeast: (min: AccessTier) => boolean;
};

export function useAccess(): Access {
  const { user, profile, isAdmin } = useAuth();
  const tier = tierFor({
    signedIn: !!user,
    rank: profile?.rank ?? null,
    status: profile?.status ?? null,
    isAdmin,
    banned: !!profile?.banned,
  });
  return {
    tier,
    signedIn: !!user,
    banned: !!profile?.banned,
    canViewMarketing: true,
    canUseFeatures: tierAtLeast(tier, "stream"),
    hasVipPower: tierAtLeast(tier, "vip"),
    isBoss: tier === "boss",
    atLeast: (min) => tierAtLeast(tier, min),
  };
}
