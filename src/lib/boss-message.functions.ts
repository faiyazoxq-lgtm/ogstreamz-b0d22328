/**
 * User-facing "Message the Boss" — delivers a member's message into the
 * configured boss Telegram chat via the existing notifyBoss helper.
 *
 * - Auth-gated: requires a signed-in Supabase session.
 * - Best-effort in-memory rate-limit per user (1 / 30s, 10 / hour).
 * - Pulls display_name + email from profiles for boss-side context.
 * - Never returns the boss chat id or any Telegram internals to the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyBoss } from "./boss-notify.server";
import { logWarn } from "./server-log.server";

const MessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, "Message is too short")
    .max(2000, "Message must be 2000 characters or fewer"),
});

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Best-effort per-instance rate limit. Workers are not shared across
// instances, so this is a soft floor — duplicates a "1 per 30s, 10 per hour"
// ceiling that matches similar lightweight UX gating elsewhere in the app.
type Hits = { last: number; windowStart: number; count: number };
const HITS = new Map<string, Hits>();
const COOLDOWN_MS = 30_000;
const HOUR_MS = 60 * 60_000;
const HOUR_CAP = 10;

function checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const h = HITS.get(userId);
  if (!h) {
    HITS.set(userId, { last: now, windowStart: now, count: 1 });
    return { ok: true };
  }
  if (now - h.last < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - h.last)) / 1000);
    return { ok: false, reason: `Please wait ${wait}s before sending another message.` };
  }
  if (now - h.windowStart > HOUR_MS) {
    h.windowStart = now;
    h.count = 0;
  }
  if (h.count >= HOUR_CAP) {
    return { ok: false, reason: "Hourly message limit reached — try again later." };
  }
  h.last = now;
  h.count += 1;
  return { ok: true };
}

export const sendBossMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => MessageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as { userId: string; claims: Record<string, unknown> };

    const rl = checkRateLimit(userId);
    if (!rl.ok) {
      return { ok: false as const, error: rl.reason };
    }

    // Pull a friendly identifier for the boss-side context.
    let displayName: string | null = null;
    let email: string | null = (claims?.email as string | undefined) ?? null;
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", userId)
        .maybeSingle();
      if (prof) {
        displayName = (prof as { display_name?: string | null }).display_name ?? null;
        email = (prof as { email?: string | null }).email ?? email;
      }
    } catch (e) {
      logWarn("boss-message.profile_lookup_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const who =
      displayName && email
        ? `${displayName} (${email})`
        : displayName || email || `user ${userId.slice(0, 8)}…`;

    const html =
      `📨 <b>Message from a member</b>\n\n` +
      `<b>From:</b> ${escapeHtml(who)}\n` +
      `<b>User ID:</b> <code>${escapeHtml(userId)}</code>\n\n` +
      `${escapeHtml(data.message)}`;

    try {
      await notifyBoss(html);
      return { ok: true as const };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Failed to deliver message.",
      };
    }
  });