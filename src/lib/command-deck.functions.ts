// Command Deck — superuser server functions for the Power Console.
// Exposes:
//  • runAgentTask     — free-form Lovable AI Gateway prompt (any supported model)
//  • getOpsSnapshot   — live counts across the whole platform
//  • runMaintenance   — one-click housekeeping actions
import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AI_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const runAgentTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { model?: string; system?: string; prompt: string; temperature?: number }) => ({
    model: String(d.model || "google/gemini-2.5-flash").slice(0, 80),
    system: String(d.system || "You are a senior operator inside a command deck. Be terse, decisive, and output actionable steps.").slice(0, 4000),
    prompt: String(d.prompt || "").slice(0, 12000),
    temperature: typeof d.temperature === "number" ? Math.max(0, Math.min(1.5, d.temperature)) : 0.5,
  }))
  .handler(async ({ data, context }) => {
    await assertBoss(context.userId);
    const KEY = process.env.LOVABLE_API_KEY;
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!data.prompt.trim()) throw new Error("Prompt required");

    const r = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: data.model,
        temperature: data.temperature,
        messages: [
          { role: "system", content: data.system },
          { role: "user", content: data.prompt },
        ],
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`AI gateway ${r.status}: ${txt.slice(0, 300)}`);
    }
    const j: any = await r.json();
    const text: string = j?.choices?.[0]?.message?.content ?? "";
    return { text, model: data.model, usage: j?.usage ?? null };
  });

export const getOpsSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.userId);
    const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
    const counts = async (table: string, filter?: (q: any) => any) => {
      let q: any = (supabaseAdmin as any).from(table).select("id", { head: true, count: "exact" });
      if (filter) q = filter(q);
      const { count, error } = await q;
      if (error) return 0;
      return count ?? 0;
    };
    const [users, vipUsers, portals, tracks, sunoPending, sunoToday, scansToday, requestsPending, bots, leadsToday, codes] = await Promise.all([
      counts("profiles"),
      counts("profiles", (q) => q.eq("status", "vip")),
      counts("portals"),
      counts("tracks"),
      counts("suno_jobs", (q) => q.eq("status", "pending")),
      counts("suno_jobs", (q) => q.gte("created_at", since24)),
      counts("trade_scans", (q) => q.gte("created_at", since24)),
      counts("custom_track_requests", (q) => q.eq("status", "pending")),
      counts("bot_configs", (q) => q.eq("active", true)),
      counts("connect_leads", (q) => q.gte("created_at", since24)),
      counts("redeem_codes"),
    ]);
    return { users, vipUsers, portals, tracks, sunoPending, sunoToday, scansToday, requestsPending, bots, leadsToday, codes, ts: new Date().toISOString() };
  });

export const runMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { action: string }) => ({ action: String(d.action || "").slice(0, 60) }))
  .handler(async ({ data, context }) => {
    await assertBoss(context.userId);
    const action = data.action;

    if (action === "purge_stale_suno") {
      const cutoff = new Date(Date.now() - 6 * 3600_000).toISOString();
      const { count, error } = await supabaseAdmin
        .from("suno_jobs")
        .delete({ count: "exact" })
        .eq("status", "pending")
        .lt("created_at", cutoff);
      if (error) throw new Error(error.message);
      return { ok: true, message: `Purged ${count ?? 0} stale Suno jobs (>6h pending)` };
    }

    if (action === "expire_vip_passes") {
      const { count, error } = await supabaseAdmin
        .from("vip_passes")
        .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
        .is("revoked_at", null)
        .lt("expires_at", new Date().toISOString());
      if (error) throw new Error(error.message);
      return { ok: true, message: `Revoked ${count ?? 0} expired VIP passes` };
    }

    if (action === "reset_free_clicks") {
      const { count, error } = await supabaseAdmin
        .from("profiles")
        .update({ free_clicks_used: 0 }, { count: "exact" })
        .gt("free_clicks_used", 0);
      if (error) throw new Error(error.message);
      return { ok: true, message: `Reset free-click counters for ${count ?? 0} members` };
    }

    if (action === "clear_marketing_errors") {
      const { count, error } = await supabaseAdmin
        .from("portal_marketing")
        .update({ status: "pending", error: null }, { count: "exact" })
        .eq("status", "error");
      if (error) throw new Error(error.message);
      return { ok: true, message: `Reset ${count ?? 0} marketing jobs to pending` };
    }

    if (action === "purge_view_zero_portals") {
      const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { count, error } = await supabaseAdmin
        .from("portals")
        .delete({ count: "exact" })
        .eq("view_count", 0)
        .lt("created_at", cutoff);
      if (error) throw new Error(error.message);
      return { ok: true, message: `Deleted ${count ?? 0} dead portals (0 views, >30d old)` };
    }

    throw new Error(`Unknown action: ${action}`);
  });
