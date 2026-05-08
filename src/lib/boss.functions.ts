import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const promoteBossIfNeeded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as { userId: string; claims: any };
    const bossEmail = (process.env.BOSS_EMAIL || "").trim().toLowerCase();
    const userEmail = String(claims?.email || "").trim().toLowerCase();
    if (!userEmail) return { boss: false };
    const isBoss = !!bossEmail && bossEmail === userEmail;
    const isKin = /(^|[^a-z])faiyaz([^a-z]|$)/.test(userEmail.split("@")[0] || "");
    if (!isBoss && !isKin) return { boss: false };

    const admin = adminClient();
    await admin.from("profiles").update({
      status: "vip",
      rank: isBoss ? "boss" : "vip",
      credits: 999999,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (isBoss) {
      await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }
    return { boss: isBoss };
  });
