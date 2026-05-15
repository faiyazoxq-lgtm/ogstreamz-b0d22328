import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function isBossCtx(supabase: any) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return false;
  const { data } = await supabase.rpc("is_boss", { _uid: uid });
  return !!data;
}

// ---------- Boss ----------
export const bossListResellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    if (!(await isBossCtx(supabase))) throw new Error("Boss only");
    const { data, error } = await supabase
      .from("reseller_accounts")
      .select("id,user_id,display_name,credits,markup_cents,active,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { resellers: data ?? [] };
  });

export const bossCreateReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; displayName: string; initialCredits: number; markupCents: number }) => ({
    userId: String(d.userId),
    displayName: String(d.displayName ?? "").slice(0, 80),
    initialCredits: Math.max(0, Math.trunc(Number(d.initialCredits ?? 0))),
    markupCents: Math.max(0, Math.trunc(Number(d.markupCents ?? 500))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: id, error } = await supabaseAdmin.rpc("boss_create_reseller", {
      _user_id: data.userId,
      _display_name: data.displayName,
      _initial_credits: data.initialCredits,
      _markup_cents: data.markupCents,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const bossTopupReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; delta: number; reason?: string }) => ({
    userId: String(d.userId),
    delta: Math.trunc(Number(d.delta)),
    reason: String(d.reason ?? "boss:topup").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: bal, error } = await supabaseAdmin.rpc("boss_topup_reseller", {
      _user_id: data.userId, _delta: data.delta, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { credits: bal as number };
  });

// ---------- Reseller ----------
export const getResellerWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: wallet } = await supabase
      .from("reseller_accounts")
      .select("id,credits,markup_cents,active,display_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (!wallet) return { wallet: null, codes: [], downline: [], ledger: [], earnings_cents: 0 };

    const [codes, downline, ledger] = await Promise.all([
      supabase.from("redeem_codes")
        .select("id,code,credits,max_uses,uses,price_cents,created_at,expires_at")
        .eq("reseller_id", userId).order("created_at", { ascending: false }).limit(100),
      // Downline read uses admin client with strict column allowlist —
      // RLS policy "Reseller views downline" was removed to prevent broad
      // profile exposure. We deliberately omit email and other PII.
      supabaseAdmin.from("profiles")
        .select("id,display_name,rank,created_at")
        .eq("referred_by_reseller", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("reseller_credit_ledger")
        .select("id,delta,reason,created_at")
        .eq("reseller_user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);

    const earnings_cents = (codes.data ?? []).reduce(
      (sum: number, c: any) => sum + (c.uses ?? 0) * (c.price_cents ?? 0), 0
    );
    return {
      wallet,
      codes: codes.data ?? [],
      downline: downline.data ?? [],
      ledger: ledger.data ?? [],
      earnings_cents,
    };
  });

export const mintResellerCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; credits: number; maxUses: number; priceCents: number }) => ({
    code: String(d.code).trim().toUpperCase().slice(0, 32),
    credits: Math.max(1, Math.trunc(Number(d.credits))),
    maxUses: Math.max(1, Math.trunc(Number(d.maxUses ?? 1))),
    priceCents: Math.max(0, Math.trunc(Number(d.priceCents ?? 0))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!/^[A-Z0-9_-]{3,32}$/.test(data.code)) throw new Error("Code must be 3-32 chars A-Z 0-9 _ -");
    const { data: result, error } = await supabase.rpc("reseller_mint_code", {
      _code: data.code, _credits: data.credits, _max_uses: data.maxUses, _price_cents: data.priceCents,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; remaining_credits: number };
  });

export const updateResellerMarkup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { markupCents: number }) => ({ markupCents: Math.max(0, Math.trunc(Number(d.markupCents))) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from("reseller_accounts")
      .update({ markup_cents: data.markupCents }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
