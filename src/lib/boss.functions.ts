import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { shouldPromoteToBoss, normalizeEmail } from "./boss-policy";

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
