// Pure decision helpers for boss/VIP promotion. Kept free of side effects so
// they can be unit-tested without hitting Supabase or the server runtime.

export function normalizeEmail(input: string | null | undefined): string {
  return String(input ?? "").trim().toLowerCase();
}

/**
 * Returns true ONLY when the candidate email exactly matches the configured
 * BOSS_EMAIL secret. No regex backdoors, no name-based matching, no kin.
 */
export function shouldPromoteToBoss(
  userEmail: string | null | undefined,
  bossEmail: string | null | undefined,
): boolean {
  const u = normalizeEmail(userEmail);
  const b = normalizeEmail(bossEmail);
  if (!u || !b) return false;
  return u === b;
}