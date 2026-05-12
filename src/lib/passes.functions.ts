import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isBoss(supabase: any) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const { data } = await supabase.rpc("is_boss", { _uid: uid });
  return !!data;
}

function makeToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return `0G-${s}`;
}

export const bossCreatePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    label?: string; redeemCode?: string | null; credits?: number;
    vipDays?: number | null; maxUses?: number; expiresAt?: string | null;
  }) => ({
    label: (d.label ?? "").slice(0, 80),
    redeemCode: d.redeemCode ? String(d.redeemCode).trim().toUpperCase().slice(0, 32) : null,
    credits: Math.max(0, Math.trunc(Number(d.credits ?? 0))),
    vipDays: d.vipDays ? Math.max(0, Math.trunc(Number(d.vipDays))) : null,
    maxUses: Math.max(1, Math.trunc(Number(d.maxUses ?? 1))),
    expiresAt: d.expiresAt || null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const token = makeToken();
    const { data: row, error } = await supabase
      .from("signup_passes")
      .insert({
        token, label: data.label || null, redeem_code: data.redeemCode,
        credits: data.credits, vip_days: data.vipDays,
        max_uses: data.maxUses, expires_at: data.expiresAt, created_by: userId,
      })
      .select("*").single();
    if (error) throw new Error(error.message);
    return { pass: row };
  });

export const bossListPasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data, error } = await supabase
      .from("signup_passes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { passes: data ?? [] };
  });

export const bossDeletePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { error } = await supabase.from("signup_passes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const claimSignupPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => ({ token: String(d.token).trim().toUpperCase().slice(0, 32) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: result, error } = await supabase.rpc("claim_signup_pass", { _token: data.token });
    if (error) throw new Error(error.message);
    return result as { credits: number; vip_until: string | null; label: string | null };
  });
