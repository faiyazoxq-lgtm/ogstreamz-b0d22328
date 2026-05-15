import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

export type DownloadPeek = {
  cost: number;
  balance: number;
  is_real_og: boolean;
  vip_free_used_today: number;
  vip_free_available: boolean;
  can_pay: boolean;
};

export type DownloadClaim =
  | { ok: true; mode: "vip_free" | "paid"; balance: number; cost: number; vip_free_used_today: number }
  | { ok: false; error: "insufficient" | "unauthorized" | "unknown"; message: string };

export const peekPortalDownload = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { portalId: string; cost?: number }) => ({
    portalId: String(d.portalId || ""),
    cost: Math.max(1, Math.min(50, Math.floor(Number(d.cost) || 2))),
  }))
  .handler(async ({ data, context }): Promise<DownloadPeek> => {
    const { supabase } = context as { supabase: any };
    const { data: row, error } = await supabase.rpc("peek_portal_download", {
      _portal_id: data.portalId,
      _cost: data.cost,
    });
    if (error) throw new Error(error.message);
    return row as DownloadPeek;
  });

export const claimPortalDownload = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { portalId: string; cost?: number }) => ({
    portalId: String(d.portalId || ""),
    cost: Math.max(1, Math.min(50, Math.floor(Number(d.cost) || 2))),
  }))
  .handler(async ({ data, context }): Promise<DownloadClaim> => {
    const { supabase } = context as { supabase: any };
    const { data: row, error } = await supabase.rpc("claim_portal_download", {
      _portal_id: data.portalId,
      _cost: data.cost,
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("insufficient")) return { ok: false, error: "insufficient", message: error.message };
      if (msg.includes("auth")) return { ok: false, error: "unauthorized", message: error.message };
      return { ok: false, error: "unknown", message: error.message };
    }
    return row as DownloadClaim;
  });