import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoinPurchaseKind = "track_unlock" | "real_og" | "store_pass";

export const purchaseWithCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: CoinPurchaseKind; ref?: string }) => {
    const kind = d.kind;
    if (kind !== "track_unlock" && kind !== "real_og" && kind !== "store_pass") {
      throw new Error("Invalid purchase kind");
    }
    const ref = String(d.ref ?? "").slice(0, 80);
    if (kind !== "real_og" && !ref) throw new Error("Missing ref");
    return { kind, ref };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: result, error } = await supabase.rpc("purchase_with_coins", {
      _kind: data.kind,
      _ref: data.ref,
    });
    if (error) {
      return { ok: false, error: error.message, balance: null as number | null, cost: null as number | null };
    }
    return result as {
      ok: boolean;
      error?: string;
      balance: number;
      cost: number;
      kind?: string;
      already?: boolean;
      pending_approval?: boolean;
    };
  });