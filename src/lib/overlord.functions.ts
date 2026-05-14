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
  .inputValidator((d: { userId: string; flags: { jokes: boolean; music: boolean; tools: boolean; swearing?: boolean } }) => ({
    userId: String(d.userId),
    flags: {
      jokes: !!d.flags.jokes,
      music: !!d.flags.music,
      tools: !!d.flags.tools,
      swearing: !!d.flags.swearing,
    },
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

export const grantVipPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; expiresAt: string; source?: string; notes?: string }) => ({
    userId: String(d.userId),
    expiresAt: String(d.expiresAt),
    source: String(d.source ?? "custom").slice(0, 32),
    notes: d.notes ? String(d.notes).slice(0, 240) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data: id, error } = await supabase.rpc("boss_grant_vip_pass", {
      _user_id: data.userId, _expires_at: data.expiresAt, _source: data.source, _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

function makeVipCode(): string {
  // 12-char URL-safe code, easy to type. Avoids ambiguous chars.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 12; i++) s += alphabet[bytes[i] % alphabet.length];
  return `VIP-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/**
 * Boss-only: generate a one-time code that grants the redeemer a lifetime
 * VIP pass (revocable from the dashboard). Optionally bundles credits.
 */
export const createLifetimeVipCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code?: string; credits?: number; notes?: string; expiresAt?: string | null }) => ({
    code: d.code ? String(d.code).trim().toUpperCase().slice(0, 32) : null,
    credits: Math.max(1, Math.trunc(Number(d.credits ?? 1))),
    notes: d.notes ? String(d.notes).slice(0, 240) : null,
    expiresAt: d.expiresAt ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const code = data.code || makeVipCode();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("Code must be 3-32 chars A-Z 0-9 _ -");
    const { data: row, error } = await supabase
      .from("redeem_codes")
      .insert({
        code,
        credits: data.credits,
        grant_rank: "vip",
        max_uses: 1,
        expires_at: data.expiresAt,
        lifetime_vip: true,
        created_by: userId,
      })
      .select("id, code, credits, max_uses, uses, expires_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { code: row };
  });

export const listLifetimeVipCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data, error } = await supabase
      .from("redeem_codes")
      .select("id, code, credits, max_uses, uses, expires_at, created_at")
      .eq("lifetime_vip", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { codes: data ?? [] };
  });

export const deleteLifetimeVipCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    // Only allow deleting unredeemed codes; redeemed ones must be revoked
    // via the issued vip_pass instead (preserves audit trail).
    const { error } = await supabase
      .from("redeem_codes")
      .delete()
      .eq("id", data.id)
      .eq("lifetime_vip", true)
      .eq("uses", 0);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Boss-only: check if a custom code is available (not already used by any
 * redeem_codes row). Used by the UI for live uniqueness validation.
 */
export const checkLifetimeVipCodeAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({
    code: String(d.code ?? "").trim().toUpperCase().slice(0, 32),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const code = data.code;
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return { code, available: false, reason: "format" as const };
    }
    const { data: row, error } = await supabase
      .from("redeem_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { code, available: !row, reason: row ? ("taken" as const) : ("ok" as const) };
  });

export const revokeVipPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passId: string }) => ({ passId: String(d.passId) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { error } = await supabase.rpc("boss_revoke_vip_pass", { _pass_id: data.passId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVipPasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data, error } = await supabase
      .from("vip_passes")
      .select("id,user_id,source,notes,expires_at,revoked_at,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { passes: data ?? [] };
  });

export const grantByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; credits: number; grantRank?: Rank | null; notes?: string }) => {
    const email = String(d.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
    return {
      email,
      credits: Math.max(0, Math.trunc(Number(d.credits ?? 0))),
      grantRank: d.grantRank && RANKS.includes(d.grantRank) ? d.grantRank : null,
      notes: d.notes ? String(d.notes).slice(0, 240) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    if (data.credits === 0 && !data.grantRank) throw new Error("Set credits or a rank");
    const { data: result, error } = await supabase.rpc("boss_grant_by_email", {
      _email: data.email,
      _credits: data.credits,
      _grant_rank: data.grantRank,
      _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return result as { status: "applied" | "queued"; user_id?: string; credits?: number; grant_id: string };
  });

export const listPendingGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data, error } = await supabase
      .from("pending_credit_grants")
      .select("id,email,credits,grant_rank,notes,created_at,claimed_at,claimed_by")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { grants: data ?? [] };
  });

export const deletePendingGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { error } = await supabase
      .from("pending_credit_grants")
      .delete()
      .eq("id", data.id)
      .is("claimed_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PassOrderRow = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  kind: string;
  status: string;
  duration_days: number;
  amount_cents: number;
  currency: string;
  environment: string;
  pass_number: string | null;
  stripe_session_id: string;
  boss_decision_note: string | null;
  created_at: string;
  decided_at: string | null;
};

export const listPassOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => ({
    status: d?.status && ["pending_approval", "issued", "denied", "all"].includes(d.status)
      ? d.status
      : "pending_approval",
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    let q = supabase
      .from("pass_orders")
      .select("id,user_id,kind,status,duration_days,amount_cents,currency,environment,pass_number,stripe_session_id,boss_decision_note,created_at,decided_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: orders, error } = await q;
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((orders ?? []).map((o: any) => o.user_id)));
    let profileMap = new Map<string, { email: string; display_name: string | null }>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email,display_name")
        .in("id", userIds);
      for (const p of profs ?? []) profileMap.set(p.id, { email: p.email, display_name: p.display_name });
    }
    const rows: PassOrderRow[] = (orders ?? []).map((o: any) => ({
      ...o,
      email: profileMap.get(o.user_id)?.email ?? null,
      display_name: profileMap.get(o.user_id)?.display_name ?? null,
    }));
    return { orders: rows };
  });

export const decidePassOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; approve: boolean; note?: string }) => ({
    orderId: String(d.orderId),
    approve: !!d.approve,
    note: d.note ? String(d.note).slice(0, 500) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data: result, error } = await supabase.rpc("boss_decide_pass_order", {
      _order_id: data.orderId,
      _approve: data.approve,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return result as {
      status: "issued" | "denied";
      order_id: string;
      user_id: string;
      pass_number?: string;
      pass_id?: string;
      expires_at?: string;
      kind?: string;
      chat_id?: number | null;
    };
  });