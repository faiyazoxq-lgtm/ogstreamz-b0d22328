import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export type SubscriptionRow = {
  price_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type SubscriptionView = {
  sub: SubscriptionRow | null;
  /** "Monthly" | "Yearly" inferred from price_id, or null */
  planLabel: string | null;
  /** Localized renewal/expiry date string, or null */
  renewalDate: string | null;
  /** "Renews 12 Mar 2026" or "Access until …" or null */
  renewalLabel: string | null;
  /** Exact next-billing datetime, e.g. "12 Mar 2026, 14:32 GMT", or null */
  renewalExact: string | null;
  /** IANA timezone resolved from the browser, e.g. "Europe/London" */
  timezone: string | null;
};

/**
 * Subscribes to the latest subscription row for the current user in the
 * active Stripe environment, with realtime updates on writes from the
 * payments webhook. Returns the row plus precomputed display fields used
 * by /vip, /dashboard, and any future surface that mirrors VIP status.
 *
 * Pass `pollOnSuccess` to briefly poll after a successful checkout return
 * (the webhook may insert the row a moment after the redirect).
 */
export function useSubscription(opts: {
  userId: string | null | undefined;
  pollOnSuccess?: boolean;
}): SubscriptionView {
  const { userId, pollOnSuccess } = opts;
  const [sub, setSub] = useState<SubscriptionRow | null>(null);

  useEffect(() => {
    if (!userId) { setSub(null); return; }
    let cancelled = false;
    const env = getStripeEnvironment();
    const fetchSub = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("price_id,status,current_period_end,cancel_at_period_end")
        .eq("user_id", userId)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setSub((data as SubscriptionRow | null) ?? null);
    };
    void fetchSub();

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    if (pollOnSuccess) {
      let tries = 0;
      pollTimer = setInterval(() => {
        tries += 1;
        if (tries > 8) { if (pollTimer) clearInterval(pollTimer); return; }
        void fetchSub();
      }, 1500);
    }

    const channel = supabase
      .channel(`sub_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => { void fetchSub(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [userId, pollOnSuccess]);

  const planLabel = (() => {
    const id = sub?.price_id ?? "";
    if (/year|annual/i.test(id)) return "Yearly";
    if (/month/i.test(id)) return "Monthly";
    return null;
  })();
  const renewalDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;
  const renewalLabel = renewalDate
    ? sub?.cancel_at_period_end
      ? `Access until ${renewalDate}`
      : `Renews ${renewalDate}`
    : null;
  const timezone = sub?.current_period_end
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? null)
    : null;
  const renewalExact = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleString(undefined, {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  return { sub, planLabel, renewalDate, renewalLabel, renewalExact, timezone };
}