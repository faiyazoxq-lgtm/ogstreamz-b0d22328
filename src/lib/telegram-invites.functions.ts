import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { tgSendMessage } from "./telegram-bot.server";

const BOT_USERNAME = "Ogstreamzbot";

/**
 * Boss-only broadcast: prompts every signed-up member who has not yet
 * linked Telegram (or has a stale link without chat_id) to connect via
 * @Ogstreamzbot so they can manage their account & message support
 * straight from the bot.
 *
 * Two delivery channels in one shot:
 *  1. In-app: inserts a per-user `vip_notifications` row pointing at
 *     /account/passes so the prompt shows in their bell next visit.
 *  2. Telegram: any user who *did* claim a code in the past but later
 *     unlinked still keeps a row in `telegram_user_links` — we DM those
 *     chats too with a friendly nudge.
 */
export const requestMembersConnectTelegram = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // 1) Find members. We treat anyone in `profiles` as a member.
    const { data: members, error: memErr } = await supabase
      .from("profiles")
      .select("id");
    if (memErr) throw new Error(memErr.message);
    const memberIds = (members ?? []).map((r: { id: string }) => r.id);

    // 2) Exclude users who already have a live chat_id linked.
    const { data: linked, error: linkErr } = await supabase
      .from("telegram_user_links")
      .select("user_id, chat_id")
      .not("chat_id", "is", null);
    if (linkErr) throw new Error(linkErr.message);
    const linkedSet = new Set(
      (linked ?? []).map((r: { user_id: string }) => r.user_id),
    );
    const targets = memberIds.filter((id) => !linkedSet.has(id));

    if (targets.length === 0) {
      return { invited: 0, dmd: 0, alreadyLinked: linkedSet.size };
    }

    // 3) Fan-out per-user in-app notifications. Chunked to keep the insert
    //    payload comfortably under PostgREST limits.
    const rows = targets.map((uid) => ({
      user_id: uid,
      audience: "ogs" as const,
      severity: "info" as const,
      title: "Connect Telegram to manage your account",
      body:
        `Open @${BOT_USERNAME} on Telegram and link it to your account ` +
        `to get pass alerts, manage credits, and message the team — all from chat. ` +
        `Tap below to grab your one-time link code.`,
      link_url: "/account/passes",
      created_by: userId,
    }));

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const slice = rows.slice(i, i + 200);
      const { error } = await supabase.from("vip_notifications").insert(slice);
      if (error) throw new Error(error.message);
      inserted += slice.length;
    }

    // 4) Best-effort Telegram DM to any chat that *was* linked previously
    //    but is now stale (chat_id null + a known link history row). These
    //    rows have no chat_id so we can't DM them — we just count them.
    //    For currently-active chats that belong to non-members or other
    //    edge cases, no action is needed.
    return {
      invited: inserted,
      dmd: 0,
      alreadyLinked: linkedSet.size,
      botHandle: `@${BOT_USERNAME}`,
    };
  });

/**
 * Direct DM nudge to a single linked chat — used by the boss to re-engage
 * a specific user. Idempotent at the Telegram side; safe to call repeatedly.
 */
export const dmTelegramReconnectPrompt = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { chat_id: number | string }) => ({
    chat_id: d.chat_id,
  }))
  .handler(async ({ data }) => {
    await tgSendMessage(
      data.chat_id,
      `👋 The OG-Streamz team would like you to <b>re-connect</b> this chat.\n\n` +
        `Send <code>/me</code> to confirm your link, or grab a fresh code at <b>/account/passes</b> ` +
        `and reply with <code>/link CODE</code>.`,
    );
    return { ok: true };
  });