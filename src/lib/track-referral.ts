import { supabase } from "@/integrations/supabase/client";

export type ReferralEventType = "copied" | "opened" | "shared" | "share_failed";

/**
 * Fire-and-forget analytics for referral-link interactions.
 * RLS only allows authenticated users to insert their own rows.
 * Errors are swallowed — analytics must never break the UX.
 */
export async function trackReferralEvent(
  userId: string | null | undefined,
  referralCode: string | null | undefined,
  eventType: ReferralEventType,
  source: string = "vip_pass_card",
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!userId || !referralCode) return;
  try {
    await supabase.from("referral_events").insert({
      user_id: userId,
      referral_code: referralCode,
      event_type: eventType,
      source,
      metadata: metadata as never,
    });
  } catch {
    /* swallow */
  }
}