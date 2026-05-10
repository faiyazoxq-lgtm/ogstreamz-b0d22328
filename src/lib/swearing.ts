/**
 * Per-user "Swearing Agent" defaults.
 *
 * Streamers (stream_user) and Real OGs (vip / boss) get Safe Mode by default.
 * Everyone else gets the swearing agent ON by default.
 *
 * Boss can override either side via the user roster — explicit `true`/`false`
 * stored on `feature_flags.swearing` always wins.
 */

export type SwearIntensity = "mild" | "medium" | "chaotic";

type RankLike = string | null | undefined;
type FlagsLike = { swearing?: boolean | null; swearing_intensity?: string | null } | null | undefined;
type ProfileLike = { rank?: RankLike; feature_flags?: FlagsLike } | null | undefined;

const SAFE_MODE_RANKS = new Set(["stream_user", "vip", "boss"]);

/** True if Safe Mode is the default for this rank (no explicit user choice). */
export function rankDefaultsToSafe(rank: RankLike): boolean {
  return SAFE_MODE_RANKS.has(String(rank ?? ""));
}

/** Resolve effective swearing on/off for a profile, falling back to rank defaults. */
export function effectiveSwearing(profile: ProfileLike): boolean {
  const flags = (profile?.feature_flags ?? {}) as FlagsLike;
  const explicit = flags?.swearing;
  if (explicit === true) return true;
  if (explicit === false) return false;
  return !rankDefaultsToSafe(profile?.rank);
}

/** Resolve effective intensity ("chaotic" default for non-safe ranks, "mild" for safe). */
export function effectiveIntensity(profile: ProfileLike): SwearIntensity {
  const raw = String((profile?.feature_flags ?? {})?.swearing_intensity ?? "").toLowerCase();
  if (raw === "mild" || raw === "medium" || raw === "chaotic") return raw;
  return rankDefaultsToSafe(profile?.rank) ? "mild" : "chaotic";
}