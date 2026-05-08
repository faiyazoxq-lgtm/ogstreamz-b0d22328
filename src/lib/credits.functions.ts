import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const spendCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number; reason: string }) => ({
    amount: Math.max(1, Math.min(500, Math.floor(Number(data.amount) || 1))),
    reason: String(data.reason || "spend").slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: balance, error } = await supabase.rpc("spend_credits", {
      _amount: data.amount,
      _reason: data.reason,
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("insufficient")) {
        return { ok: false, error: "insufficient", balance: null as number | null };
      }
      return { ok: false, error: error.message, balance: null as number | null };
    }
    return { ok: true, balance: balance as number, error: null as string | null };
  });