import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Charge a user `portals.use_credit_cost` credits for performing an action
 * inside a portal. Boss / admin users bypass the charge.
 *
 * Returns:
 *   { ok: true,  cost, balance, free }  - charged successfully (or free)
 *   { ok: false, error: "insufficient", cost, balance: null } - not enough credits
 *   { ok: false, error: string, cost, balance: null } - other error
 */
export const chargePortalUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.slug) throw new Error("Portal slug required");

    // Boss / admin = free.
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("rank").eq("id", userId).maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);
    const privileged = profile?.rank === "boss" || !!roleRow;

    const { data: portal, error: portalErr } = await supabase
      .from("portals")
      .select("id, use_credit_cost")
      .eq("slug", data.slug)
      .maybeSingle();
    if (portalErr) throw new Error(portalErr.message);
    if (!portal) throw new Error("Portal not found");

    const cost = Math.max(0, Math.floor(Number(portal.use_credit_cost) || 0));
    if (cost === 0 || privileged) {
      return { ok: true as const, cost, balance: null as number | null, free: true };
    }

    const { data: balance, error: spendErr } = await supabase.rpc("spend_credits", {
      _amount: cost,
      _reason: `portal_use:${data.slug}`,
    });
    if (spendErr) {
      const msg = (spendErr.message || "").toLowerCase();
      if (msg.includes("insufficient")) {
        return { ok: false as const, error: "insufficient", cost, balance: null as number | null };
      }
      return { ok: false as const, error: spendErr.message || "spend_failed", cost, balance: null as number | null };
    }
    return { ok: true as const, cost, balance: balance as number, free: false };
  });
