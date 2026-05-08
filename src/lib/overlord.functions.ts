import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RANKS = ["prospect", "enforcer", "vip", "boss"] as const;
type Rank = typeof RANKS[number];

async function isBoss(supabase: any) {
  const { data, error } = await supabase.rpc("is_boss", { _uid: (await supabase.auth.getUser()).data.user?.id });
  if (error) return false;
  return !!data;
}

export const adjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; delta: number; reason?: string }) => ({
    userId: String(d.userId),
    delta: Math.trunc(Number(d.delta)),
    reason: String(d.reason ?? "admin:adjust").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data: bal, error } = await supabase.rpc("admin_adjust_credits", {
      _user_id: data.userId, _delta: data.delta, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { credits: bal as number };
  });

export const setRank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; rank: Rank }) => {
    if (!RANKS.includes(d.rank)) throw new Error("Invalid rank");
    return { userId: String(d.userId), rank: d.rank };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const status = data.rank === "vip" || data.rank === "boss" ? "vip" : "free";
    const { error } = await supabase.from("profiles").update({ rank: data.rank, status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFeatureFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; flags: { jokes: boolean; music: boolean; tools: boolean } }) => ({
    userId: String(d.userId),
    flags: { jokes: !!d.flags.jokes, music: !!d.flags.music, tools: !!d.flags.tools },
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { error } = await supabase.from("profiles").update({ feature_flags: data.flags }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createRedeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; credits: number; grantRank?: Rank | null; maxUses?: number; expiresAt?: string | null }) => ({
    code: String(d.code).trim().toUpperCase().slice(0, 32),
    credits: Math.max(1, Math.trunc(Number(d.credits))),
    grantRank: d.grantRank && RANKS.includes(d.grantRank) ? d.grantRank : null,
    maxUses: Math.max(1, Math.trunc(Number(d.maxUses ?? 1))),
    expiresAt: d.expiresAt ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    if (!/^[A-Z0-9_-]{3,32}$/.test(data.code)) throw new Error("Code must be 3-32 chars A-Z 0-9 _ -");
    const { data: row, error } = await supabase
      .from("redeem_codes")
      .insert({
        code: data.code, credits: data.credits, grant_rank: data.grantRank,
        max_uses: data.maxUses, expires_at: data.expiresAt, created_by: userId,
      })
      .select("id, code, credits, grant_rank, max_uses, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return { code: row };
  });

export const redeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({ code: String(d.code).trim().toUpperCase().slice(0, 32) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: result, error } = await supabase.rpc("redeem_code", { _code: data.code });
    if (error) throw new Error(error.message);
    return result as { credits: number; rank: string | null };
  });