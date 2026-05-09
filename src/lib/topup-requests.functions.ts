import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isBoss(supabase: any) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const { data } = await supabase.rpc("is_boss", { _uid: uid });
  return !!data;
}

export const requestTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credits: number; reason?: string }) => ({
    credits: Math.max(1, Math.min(500, Math.trunc(Number(d.credits ?? 10)))),
    reason: String(d.reason ?? "").slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: id, error } = await supabase.rpc("request_topup", {
      _credits: data.credits,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const listMyTopupRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("topup_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

export const bossListTopupRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } = {}) => ({
    status: d?.status === "approved" || d?.status === "denied" || d?.status === "all" ? d.status : "pending",
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    let q = supabase.from("topup_requests").select("*").order("created_at", { ascending: false }).limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { requests: rows ?? [] };
  });

export const bossApproveTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; credits: number; note?: string }) => ({
    id: String(d.id),
    credits: Math.max(1, Math.min(1000, Math.trunc(Number(d.credits)))),
    note: String(d.note ?? "").slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: result, error } = await supabase.rpc("boss_approve_topup", {
      _id: data.id,
      _credits: data.credits,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return result as { balance: number; credits: number };
  });

export const bossDenyTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; note?: string }) => ({
    id: String(d.id),
    note: String(d.note ?? "").slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.rpc("boss_deny_topup", { _id: data.id, _note: data.note });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bossSetFriendsFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; enabled: boolean }) => ({
    userId: String(d.userId),
    enabled: !!d.enabled,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data: profile, error: readErr } = await supabase
      .from("profiles")
      .select("feature_flags")
      .eq("id", data.userId)
      .single();
    if (readErr) throw new Error(readErr.message);
    const flags = { ...(profile?.feature_flags ?? {}), friends_family: data.enabled };
    const { error } = await supabase.from("profiles").update({ feature_flags: flags }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, friends_family: data.enabled };
  });

export const bossListFriendsFamily = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,credits,feature_flags,rank,status")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const ff = (data ?? []).filter((p: any) => p?.feature_flags?.friends_family === true);
    return { friends: ff };
  });