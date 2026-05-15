import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logBossAction } from "@/lib/boss-audit.functions";
import { OG_TIERS, type OgTier } from "@/lib/og-tier";

const RANKS = ["prospect", "enforcer", "stream_user", "vip", "boss"] as const;
type Rank = typeof RANKS[number];


export type RosterRow = {
  id: string;
  email: string;
  display_name: string | null;
  rank: Rank;
  status: "free" | "vip";
  credits: number;
  banned: boolean;
  banned_reason: string | null;
  stream_status: string | null;
  stream_verified_at: string | null;
  stream_expires_at: string | null;
  created_at: string;
  feature_flags: Record<string, any> | null;
  og_pass_no: number | null;
  member_tier: string | null;
  contact_card: Record<string, any> | null;
  avatar_url: string | null;
  og_tier: OgTier | null;
  is_friends_family?: boolean | null;
};

export const listRoster = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .inputValidator((d: { search?: string; rank?: string; limit?: number; cursor?: string | null } | undefined) => ({
    search: (d?.search ?? "").trim().slice(0, 120),
    rank: d?.rank && RANKS.includes(d.rank as Rank) ? (d.rank as Rank) : "",
    limit: Math.min(100, Math.max(1, Math.trunc(Number(d?.limit ?? 25)))),
    cursor: d?.cursor && typeof d.cursor === "string" ? d.cursor : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    let q = supabase
      .from("profiles")
      .select("id,email,display_name,rank,status,credits,banned,banned_reason,stream_status,stream_verified_at,stream_expires_at,created_at,feature_flags,og_pass_no,member_tier,contact_card,avatar_url,og_tier,is_friends_family")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit + 1);
    if (data.rank) q = q.eq("rank", data.rank);
    if (data.search) q = q.or(`email.ilike.%${data.search}%,display_name.ilike.%${data.search}%`);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const all = (rows ?? []) as RosterRow[];
    const hasMore = all.length > data.limit;
    const pageRows = hasMore ? all.slice(0, data.limit) : all;
    const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.created_at ?? null : null;
    return { rows: pageRows, nextCursor, hasMore };
  });

export const setOgTier = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { userId: string; tier: OgTier }) => {
    if (!OG_TIERS.includes(d.tier)) throw new Error("Invalid tier");
    return { userId: String(d.userId), tier: d.tier };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: prev } = await supabase
      .from("profiles").select("og_tier,rank,status").eq("id", data.userId).maybeSingle();
    const { data: result, error } = await supabaseAdmin.rpc("boss_set_og_tier", {
      _user_id: data.userId,
      _tier: data.tier,
    });
    if (error) throw new Error(error.message);
    await logBossAction(supabase, {
      action: "set_og_tier",
      surface: "/boss/og-passes",
      targetUserId: data.userId,
      before: prev ?? null,
      after: { og_tier: result ?? data.tier },
    });
    return { ok: true, tier: result ?? data.tier };
  });

export const setRank = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { userId: string; rank: Rank }) => {
    if (!RANKS.includes(d.rank)) throw new Error("Invalid rank");
    return { userId: String(d.userId), rank: d.rank };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const status = data.rank === "vip" || data.rank === "boss" ? "vip" : "free";
    const { data: prev } = await supabase
      .from("profiles").select("rank,status").eq("id", data.userId).maybeSingle();
    const { error } = await supabase.from("profiles").update({ rank: data.rank, status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logBossAction(supabase, {
      action: "set_rank",
      surface: "/boss/users",
      targetUserId: data.userId,
      before: prev ?? null,
      after: { rank: data.rank, status },
    });
    return { ok: true };
  });

export const setStatus = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { userId: string; status: "free" | "vip" }) => {
    if (!["free", "vip"].includes(d.status)) throw new Error("Invalid status");
    return { userId: String(d.userId), status: d.status };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: prev } = await supabase
      .from("profiles").select("status").eq("id", data.userId).maybeSingle();
    const { error } = await supabase.from("profiles").update({ status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logBossAction(supabase, {
      action: "set_status",
      surface: "/boss/users",
      targetUserId: data.userId,
      before: prev ?? null,
      after: { status: data.status },
    });
    return { ok: true };
  });

export const adjustCredits = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { userId: string; delta: number; reason?: string }) => ({
    userId: String(d.userId),
    delta: Math.trunc(Number(d.delta)),
    reason: String(d.reason ?? "boss:adjust").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: bal, error } = await supabaseAdmin.rpc("admin_adjust_credits", {
      _user_id: data.userId, _delta: data.delta, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    await logBossAction(supabase, {
      action: "adjust_credits",
      surface: "/boss/users",
      targetUserId: data.userId,
      after: { credits: bal as number, delta: data.delta },
      reason: data.reason,
      metadata: { delta: data.delta },
    });
    return { credits: bal as number };
  });

export const setBanned = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { userId: string; banned: boolean; reason?: string }) => ({
    userId: String(d.userId),
    banned: !!d.banned,
    reason: d.reason ? String(d.reason).slice(0, 240) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: prev } = await supabase
      .from("profiles").select("banned,banned_reason").eq("id", data.userId).maybeSingle();
    const { error } = await (supabaseAdmin as any).rpc("boss_set_banned", {
      _user_id: data.userId, _banned: data.banned, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    // When banning, also force sign-out via admin client
    if (data.banned) {
      try { await supabaseAdmin.auth.admin.signOut(data.userId); } catch { /* non-fatal */ }
    }
    await logBossAction(supabase, {
      action: "set_banned",
      surface: "/boss/users",
      targetUserId: data.userId,
      before: prev ?? null,
      after: { banned: data.banned, banned_reason: data.reason },
      reason: data.reason,
    });
    return { ok: true };
  });

export const forceSignOut = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { userId: string }) => ({ userId: String(d.userId) }))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.auth.admin.signOut(data.userId);
    if (error) throw new Error(error.message);
    const { supabase } = context as any;
    await logBossAction(supabase, {
      action: "force_sign_out",
      surface: "/boss/users",
      targetUserId: data.userId,
    });
    return { ok: true };
  });

const INTENSITIES = ["mild", "medium", "chaotic"] as const;
type Intensity = typeof INTENSITIES[number];

/**
 * Boss-only: explicitly set the swearing flag and intensity for a user.
 * Pass `enabled: null` to clear the explicit override (rank-based default returns).
 */
export const setUserSwearing = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { userId: string; enabled: boolean | null; intensity?: Intensity }) => ({
    userId: String(d.userId),
    enabled: d.enabled === null ? null : !!d.enabled,
    intensity: d.intensity && INTENSITIES.includes(d.intensity) ? d.intensity : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: prof, error: readErr } = await supabase
      .from("profiles").select("feature_flags").eq("id", data.userId).maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const flags = { ...(prof?.feature_flags ?? {}) } as Record<string, any>;
    const prevFlags = { swearing: flags.swearing ?? null, swearing_intensity: flags.swearing_intensity ?? null };
    if (data.enabled === null) {
      delete flags.swearing;
    } else {
      flags.swearing = data.enabled;
    }
    if (data.intensity) flags.swearing_intensity = data.intensity;
    const { error } = await supabase.from("profiles").update({ feature_flags: flags }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logBossAction(supabase, {
      action: "set_user_swearing",
      surface: "/boss/users",
      targetUserId: data.userId,
      before: prevFlags,
      after: { swearing: flags.swearing ?? null, swearing_intensity: flags.swearing_intensity ?? null },
    });
    return { ok: true, feature_flags: flags };
  });

export const setFriendsFamily = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { userId: string; enabled: boolean }) => ({
    userId: String(d.userId),
    enabled: !!d.enabled,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: prev } = await supabase
      .from("profiles").select("is_friends_family").eq("id", data.userId).maybeSingle();
    const { error } = await supabase
      .from("profiles")
      .update({ is_friends_family: data.enabled })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logBossAction(supabase, {
      action: "set_friends_family",
      surface: "/boss/og-passes",
      targetUserId: data.userId,
      before: prev ?? null,
      after: { is_friends_family: data.enabled },
    });
    return { ok: true, is_friends_family: data.enabled };
  });