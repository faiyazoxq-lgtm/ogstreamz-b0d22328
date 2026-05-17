/**
 * Single source of truth for role / tier membership.
 *
 * Every page, component, hook, route-guard and server function that needs to
 * answer "is this profile Boss / VIP / Stream / Member?" MUST go through the
 * helpers below. Adding (or renaming) a role should require editing ONLY
 * `ROLE_CONFIG` in this file — never the call sites.
 *
 * Each role config lists:
 *   - `ranks`         — `profiles.rank` values that satisfy the role
 *   - `statuses`      — `profiles.status` values that satisfy the role
 *   - `featureFlags`  — `profiles.feature_flags.*` keys whose `true` value
 *                       grants the role (e.g. `real_og`)
 *   - `adminCounts`   — when true, an `isAdmin` caller passes the check
 *
 * Helpers operate on a lightweight `ProfileLike` shape so they work in both
 * client code (where the full Profile is loaded) and server functions
 * (which usually `.select("rank,status")` for cheaper reads).
 */

export type RoleKey = "boss" | "vip" | "stream" | "member";

export type ProfileLike = {
  rank?: string | null;
  status?: string | null;
  banned?: boolean | null;
  feature_flags?: Record<string, unknown> | null;
} | null | undefined;

type RoleSpec = {
  ranks: readonly string[];
  statuses: readonly string[];
  featureFlags: readonly string[];
  /** When true, an `isAdmin: true` caller passes regardless of profile. */
  adminCounts: boolean;
};

/**
 * The whole role ladder in one place. Edit here to add new ranks/statuses;
 * every page picks it up automatically.
 *
 * NOTE: `boss` is intentionally the narrowest — it only matches `rank=boss`
 * (plus admins). `vip` includes boss because Boss outranks VIP everywhere;
 * `stream` includes everyone above it for the same reason.
 */
export const ROLE_CONFIG: Record<RoleKey, RoleSpec> = {
  boss: {
    ranks: ["boss"],
    statuses: [],
    featureFlags: [],
    adminCounts: true,
  },
  vip: {
    ranks: ["vip", "boss"],
    statuses: ["vip"],
    featureFlags: ["real_og"],
    adminCounts: true,
  },
  stream: {
    ranks: ["stream_user", "vip", "boss"],
    statuses: ["vip"],
    featureFlags: [],
    adminCounts: true,
  },
  // "member" = signed-in non-banned. Predicate uses `signedIn` rather than the
  // config because there is no rank/status that defines membership on its own.
  member: {
    ranks: [],
    statuses: [],
    featureFlags: [],
    adminCounts: true,
  },
};

type Opts = { isAdmin?: boolean };

function matches(role: RoleKey, profile: ProfileLike, opts: Opts = {}): boolean {
  const cfg = ROLE_CONFIG[role];
  if (opts.isAdmin && cfg.adminCounts) return true;
  if (!profile) return false;
  if (profile.banned) return false;
  const rank = (profile.rank ?? "") as string;
  const status = (profile.status ?? "") as string;
  if (rank && cfg.ranks.includes(rank)) return true;
  if (status && cfg.statuses.includes(status)) return true;
  const flags = profile.feature_flags ?? {};
  for (const key of cfg.featureFlags) {
    if (flags && (flags as any)[key] === true) return true;
  }
  return false;
}

/** Boss / admin. Pass `{ isAdmin }` when the caller knows it from `useAuth`. */
export function isBossProfile(profile: ProfileLike, opts: Opts = {}): boolean {
  return matches("boss", profile, opts);
}

/**
 * VIP-or-better. Includes Boss, admins (when `adminCounts`), and anyone whose
 * profile satisfies the VIP rank/status/flag list in `ROLE_CONFIG`.
 */
export function isVipProfile(profile: ProfileLike, opts: Opts = {}): boolean {
  return matches("vip", profile, opts);
}

/** Stream-user-or-better (anyone with usage privileges beyond marketing). */
export function isStreamProfile(profile: ProfileLike, opts: Opts = {}): boolean {
  return matches("stream", profile, opts);
}

/** Generic role check — use when role is dynamic. */
export function hasRole(role: RoleKey, profile: ProfileLike, opts: Opts = {}): boolean {
  if (role === "member") return !!profile && !profile.banned;
  return matches(role, profile, opts);
}

/**
 * Server-side variant of {@link isVipProfile} that also honours an active
 * `vip_passes` row. Use inside server functions where the pass lookup is
 * already in hand (avoid double-querying).
 */
export function isVipProfileWithPass(
  profile: ProfileLike,
  opts: Opts & { hasActivePass?: boolean } = {},
): boolean {
  if (opts.hasActivePass) return true;
  return isVipProfile(profile, opts);
}