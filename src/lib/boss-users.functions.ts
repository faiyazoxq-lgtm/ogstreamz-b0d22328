import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RANKS = ["prospect", "enforcer", "stream_user", "vip", "boss"] as const;
type Rank = typeof RANKS[number];

async function assertBoss(supabase: any) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("Auth required");
  const [{ data: bossFlag }, { data: roles }] = await Promise.all([
    supabase.rpc("is_boss", { _uid: uid }),
    supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin"),
  ]);
  if (!bossFlag && !(roles && roles.length)) throw new Error("Boss only");
  return uid as string;
}

export type RosterRow = {
  id: string;
  email: string;
  display_name: string | null;
  rank: Rank;
  status: "free" | "vip";
  credits: number;
  banned: boolean;
  banned_reason: string | null;
  stream_username: string | null;
  stream_status: string | null;
  stream_verified_at: string | null;
  stream_expires_at: string | null;
  created_at: string;
};

export const listRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; rank?: string; limit?: number } | undefined) => ({
    search: (d?.search ?? "").trim().slice(0, 120),
    rank: d?.rank && RANKS.includes(d.rank as Rank) ? (d.rank as Rank) : "",
    limit: Math.min(500, Math.max(1, Math.trunc(Number(d?.limit ?? 200)))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertBoss(supabase);
    let q = supabase
      .from("profiles")
      .select("id,email,display_name,rank,status,credits,banned,banned_reason,stream_username,stream_status,stream_verified_at,stream_expires_at,created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.rank) q = q.eq("rank", data.rank);
    if (data.search) q = q.or(`email.ilike.%${data.search}%,display_name.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as RosterRow[] };
  });

export const setRank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; rank: Rank }) => {
    if (!RANKS.includes(d.rank)) throw new Error("Invalid rank");
    return { userId: String(d.userId), rank: d.rank };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertBoss(supabase);
    const status = data.rank === "vip" || data.rank === "boss" ? "vip" : "free";
    const { error } = await supabase.from("profiles").update({ rank: data.rank, status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: "free" | "vip" }) => {
    if (!["free", "vip"].includes(d.status)) throw new Error("Invalid status");
    return { userId: String(d.userId), status: d.status };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertBoss(supabase);
    const { error } = await supabase.from("profiles").update({ status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; delta: number; reason?: string }) => ({
    userId: String(d.userId),
    delta: Math.trunc(Number(d.delta)),
    reason: String(d.reason ?? "boss:adjust").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertBoss(supabase);
    const { data: bal, error } = await supabase.rpc("admin_adjust_credits", {
      _user_id: data.userId, _delta: data.delta, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { credits: bal as number };
  });

export const setBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; banned: boolean; reason?: string }) => ({
    userId: String(d.userId),
    banned: !!d.banned,
    reason: d.reason ? String(d.reason).slice(0, 240) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertBoss(supabase);
    const { error } = await supabase.rpc("boss_set_banned", {
      _user_id: data.userId, _banned: data.banned, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    // When banning, also force sign-out via admin client
    if (data.banned) {
      try { await supabaseAdmin.auth.admin.signOut(data.userId); } catch { /* non-fatal */ }
    }
    return { ok: true };
  });

export const forceSignOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => ({ userId: String(d.userId) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertBoss(supabase);
    const { error } = await supabaseAdmin.auth.admin.signOut(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });