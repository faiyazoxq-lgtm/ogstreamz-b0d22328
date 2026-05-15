import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

const CUSTOM_TRACK_COST = 50;

export const requestCustomTrack = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { vibe: string; notes: string }) => ({
    vibe: String(data.vibe || "").trim().slice(0, 120),
    notes: String(data.notes || "").trim().slice(0, 600),
  }))
  .handler(async ({ data, context }) => {
    if (!data.vibe) throw new Error("Vibe required");
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { error: spendErr } = await supabase.rpc("spend_credits", {
      _amount: CUSTOM_TRACK_COST,
      _reason: "custom-track-request",
    });
    if (spendErr) {
      const msg = (spendErr.message || "").toLowerCase();
      if (msg.includes("insufficient")) return { ok: false as const, error: "insufficient" };
      return { ok: false as const, error: spendErr.message };
    }

    const { error: insErr } = await supabase.from("custom_track_requests").insert({
      user_id: userId,
      vibe: data.vibe,
      notes: data.notes,
      credits_spent: CUSTOM_TRACK_COST,
    });
    if (insErr) return { ok: false as const, error: insErr.message };
    return { ok: true as const, error: null };
  });

export const listMyTrackRequests = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data } = await supabase
      .from("custom_track_requests")
      .select("id, vibe, notes, status, deliverable_url, created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminListTrackRequests = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Admin only");
    const { data } = await supabase
      .from("custom_track_requests")
      .select("id, user_id, vibe, notes, status, deliverable_url, created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminUpdateTrackRequest = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { id: string; status: string; deliverable_url?: string }) => ({
    id: String(data.id),
    status: String(data.status).slice(0, 32),
    deliverable_url: data.deliverable_url ? String(data.deliverable_url).slice(0, 500) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Admin only");
    const { error } = await supabase
      .from("custom_track_requests")
      .update({ status: data.status, deliverable_url: data.deliverable_url })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });