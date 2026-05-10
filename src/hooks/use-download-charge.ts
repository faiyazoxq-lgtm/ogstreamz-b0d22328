import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  claimPortalDownload,
  type DownloadClaim,
} from "@/lib/portal-downloads.functions";

export type ChargeOutcome =
  | { ok: true; mode: "vip_free" | "paid"; cost: number; balance: number }
  | { ok: false; reason: "insufficient" | "unauthorized" | "unknown"; message: string; cost: number };

/**
 * Atomically charges the user for a full download (or burns a VIP free pass).
 * Returns a typed outcome so callers can decide whether to start the download
 * or surface the insufficient-balance flow.
 */
export function useDownloadCharge() {
  const claim = useServerFn(claimPortalDownload);
  const [pending, setPending] = useState(false);

  const charge = useCallback(
    async (input: { portalId: string; cost?: number }): Promise<ChargeOutcome> => {
      const cost = Math.max(1, Math.min(50, Math.floor(Number(input.cost) || 2)));
      setPending(true);
      try {
        const res = (await claim({ data: { portalId: input.portalId, cost } })) as DownloadClaim;
        if (res.ok) {
          return { ok: true, mode: res.mode, cost: res.cost, balance: res.balance };
        }
        return { ok: false, reason: res.error, message: res.message, cost };
      } catch (e: any) {
        const message = String(e?.message || "Couldn't process payment.");
        const insufficient = message.toLowerCase().includes("insufficient");
        return {
          ok: false,
          reason: insufficient ? "insufficient" : "unknown",
          message,
          cost,
        };
      } finally {
        setPending(false);
      }
    },
    [claim],
  );

  return { charge, pending };
}