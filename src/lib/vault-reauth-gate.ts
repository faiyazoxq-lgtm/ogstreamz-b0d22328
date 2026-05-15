/**
 * Pure server-side authorization gate for `revealVaultCredential`.
 *
 * Extracted from `src/lib/vault.functions.ts` so it can be unit-tested in
 * isolation (without dragging in `supabaseAdmin` / Worker-only modules).
 *
 * Rule (server-enforced — the client `VaultGuard` sessionStorage flag is
 * UX only and MUST NOT be consulted here):
 *
 *   ALLOW iff
 *     rank ∈ { 'vip', 'boss' }                        // elevated rank
 *     OR  hasAdminRole === true                       // admin role row
 *     OR  rank === 'stream_user'
 *         AND stream_verified_at is within
 *         VAULT_REAUTH_WINDOW_MS of `now`             // fresh portal login
 */

export const VAULT_REAUTH_WINDOW_MS = 12 * 60 * 60 * 1000;

export type VaultGateProfile = {
  rank: string | null | undefined;
  stream_verified_at: string | null | undefined;
};

export type VaultGateInput = {
  profile: VaultGateProfile | null | undefined;
  hasAdminRole: boolean;
  /** Defaults to Date.now(). Injectable for tests. */
  now?: number;
};

export type VaultGateDecision =
  | { allow: true; reason: "elevated_rank" | "admin_role" | "fresh_stream_user" }
  | { allow: false; reason: "no_profile" | "rank_not_eligible" | "stream_verification_stale" };

export function evaluateVaultRevealAccess(input: VaultGateInput): VaultGateDecision {
  const now = input.now ?? Date.now();
  const profile = input.profile ?? null;

  if (input.hasAdminRole) return { allow: true, reason: "admin_role" };

  if (!profile) return { allow: false, reason: "no_profile" };

  const rank = profile.rank ?? null;
  if (rank === "vip" || rank === "boss") {
    return { allow: true, reason: "elevated_rank" };
  }

  if (rank !== "stream_user") {
    return { allow: false, reason: "rank_not_eligible" };
  }

  const verifiedAt = profile.stream_verified_at
    ? new Date(profile.stream_verified_at).getTime()
    : 0;
  const fresh =
    Number.isFinite(verifiedAt) &&
    verifiedAt > 0 &&
    now - verifiedAt < VAULT_REAUTH_WINDOW_MS;

  return fresh
    ? { allow: true, reason: "fresh_stream_user" }
    : { allow: false, reason: "stream_verification_stale" };
}

/**
 * Convenience wrapper used by the server fn — throws the canonical error
 * string so callers don't have to translate the decision shape.
 */
export function assertVaultRevealAllowed(input: VaultGateInput): void {
  const d = evaluateVaultRevealAccess(input);
  if (!d.allow) throw new Error("Vault re-auth required");
}
