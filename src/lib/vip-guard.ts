import { isVipProfileWithPass, isStreamProfile } from "@/lib/roles";

/**
 * Server-side VIP gate. Use inside any `createServerFn` whose UI is paywalled
 * so a non-VIP cannot bypass the front-end gate by calling the function
 * directly (devtools, curl, replay, etc.).
 *
 * A user is allowed when ANY of the following holds:
 *   - profile.status === "vip"  (legacy / Boss Pack flag)
 *   - profile.rank   === "vip" or "boss"
 *   - they have an active row in vip_passes (not revoked, not expired)
 *   - they hold the "admin" role in user_roles
 *
 * This mirrors the UI logic used across the hubs (music, jokes/live-roast,
 * etc.) and the SQL `has_active_vip()` helper.
 *
 * Throws a user-readable Error when the caller is NOT a VIP. The thrown
 * message is safe to surface — it never leaks DB internals.
 */
export async function assertVipAccess(
  supabase: any,
  userId: string,
  feature = "this action",
): Promise<void> {
  if (!userId) throw new Error("Sign in required.");

  const [profileRes, roleRes, passRes] = await Promise.all([
    supabase.from("profiles").select("status, rank").eq("id", userId).maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabase
      .from("vip_passes")
      .select("id, expires_at, revoked_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes?.data ?? null;
  const isAdmin = !!roleRes?.data;
  const hasActivePass = !!passRes?.data;
  if (isVipProfileWithPass(profile, { isAdmin, hasActivePass })) return;

  throw new Error(
    `VIP membership required for ${feature}. Visit the store to unlock — your credit was not charged.`,
  );
}

/**
 * Server-side gate for "usage" features (anything beyond marketing).
 * Allows: stream_user, vip, boss, admin, or anyone with an active VIP pass.
 * Blocks: visitors, banned users, plain members (prospect/enforcer).
 */
export async function assertUsageAccess(
  supabase: any,
  userId: string,
  feature = "this action",
): Promise<void> {
  if (!userId) throw new Error("Sign in required.");

  const [profileRes, roleRes, passRes] = await Promise.all([
    supabase.from("profiles").select("status, rank, banned").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabase.from("vip_passes")
      .select("id").eq("user_id", userId).is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()).limit(1).maybeSingle(),
  ]);

  const profile = profileRes?.data ?? null;
  if (profile?.banned) throw new Error("Account suspended.");

  const isAdmin = !!roleRes?.data;
  const allowed =
    isStreamProfile(profile, { isAdmin }) || !!passRes?.data;

  if (!allowed) {
    throw new Error(
      `OGSTREAMZ approval required for ${feature}. Link your stream account on the profile page so Boss can promote you.`,
    );
  }
}