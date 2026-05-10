import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { shouldPromoteToBoss, normalizeEmail } from "./boss-policy";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const promoteBossIfNeeded = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as { accessToken?: string };
    return { accessToken: String(d.accessToken || "") };
  })
  .handler(async ({ data }) => {
    if (!data.accessToken) return { boss: false };
    const admin = adminClient();
    const { data: u, error } = await admin.auth.getUser(data.accessToken);
    if (error || !u?.user) return { boss: false };
    const userId = u.user.id;
    const userEmail = normalizeEmail(u.user.email);
    const bossEmail = normalizeEmail(process.env.BOSS_EMAIL);
    const isBoss = shouldPromoteToBoss(userEmail, bossEmail);
    if (!isBoss) return { boss: false };

    await admin.from("profiles").update({
      status: "vip",
      rank: "boss",
      credits: 999999,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    return { boss: isBoss };
  });

/**
 * Returns whether the currently authenticated user matches the BOSS_EMAIL
 * secret. The secret value itself is never returned — only a boolean.
 * Requires a valid Supabase bearer token (via requireSupabaseAuth).
 */
export const checkIsBoss = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userEmail = normalizeEmail(context.claims?.email as string | undefined);
    const bossEmail = normalizeEmail(process.env.BOSS_EMAIL);
    return { isBoss: shouldPromoteToBoss(userEmail, bossEmail) };
  });
