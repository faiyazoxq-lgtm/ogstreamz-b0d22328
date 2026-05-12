import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { tgSendMessage, deriveTelegramWebhookSecret } from "@/lib/telegram-bot.server";
import { getBossChatId } from "@/lib/boss-chat.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _supabase;
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function handleCommand(
  text: string,
  chatId: number,
  username: string,
  msg: any,
) {
  const trimmed = text.trim();

  // --- Boss-only commands -------------------------------------------------
  // Anything sent in the chat whose ID matches BOSS_TELEGRAM_API_KEY_TEST is
  // treated as the operator. Boss commands let the operator send DMs back
  // to members directly from Telegram, broadcast to all linked members,
  // and inspect inbox state — fully two-way messaging without leaving chat.
  const bossChatRaw = getBossChatId();
  const bossChatId = bossChatRaw ? Number(bossChatRaw) : NaN;
  if (bossChatRaw && Number.isFinite(bossChatId) && chatId === bossChatId) {
    if (await handleBossCommand(trimmed, chatId, msg)) return;
  }

  // --- Member self-service commands ---------------------------------------
  // /me /account /credits /unlink /msg <text> /help
  // All of these require the chat to already be linked to a profile.
  if (/^\/(me|account|credits|unlink|msg|contact|boss)\b/i.test(trimmed)) {
    const sb = getSupabase() as any;
    const { data: link } = await sb
      .from("telegram_user_links")
      .select("user_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (!link?.user_id) {
      await tgSendMessage(
        chatId,
        "You're not linked yet. Visit <b>/account/passes</b> on the site to get a code, then send <code>/link CODE</code> here.",
      );
      return;
    }

    if (/^\/(me|account|credits)\b/i.test(trimmed)) {
      const { data: prof } = await sb
        .from("profiles")
        .select("email,display_name,status,rank,credits,stream_status,stream_expires_at")
        .eq("id", link.user_id)
        .maybeSingle();
      if (!prof) {
        await tgSendMessage(chatId, "Profile not found.");
        return;
      }
      const exp = prof.stream_expires_at
        ? new Date(prof.stream_expires_at).toISOString().slice(0, 10)
        : "—";
      await tgSendMessage(
        chatId,
        `<b>Your account</b>\n` +
          `👤 ${escapeHtml(prof.display_name || prof.email || "—")}\n` +
          `🎟 Status: <b>${escapeHtml(prof.status || "member")}</b>` +
          (prof.rank ? ` · ${escapeHtml(prof.rank)}` : "") +
          `\n💰 Credits: <b>${Number(prof.credits ?? 0)}</b>\n` +
          `📺 Stream: ${escapeHtml(prof.stream_status || "none")} · expires ${exp}\n\n` +
          `Commands: /me · /msg &lt;text&gt; · /unlink · /help`,
      );
      return;
    }

    if (/^\/unlink\b/i.test(trimmed)) {
      await sb
        .from("telegram_user_links")
        .update({ chat_id: null, tg_username: null, linked_at: null })
        .eq("user_id", link.user_id);
      await tgSendMessage(
        chatId,
        "🔌 Unlinked. You will no longer receive DMs. Re-link any time from /account/passes.",
      );
      return;
    }

    if (/^\/(msg|contact|boss)\b/i.test(trimmed)) {
      const body = trimmed.replace(/^\/(msg|contact|boss)\s*/i, "").trim();
      if (!body) {
        await tgSendMessage(
          chatId,
          "Send a message after the command, e.g. <code>/msg need help with my pass</code>",
        );
        return;
      }
      const bossChat = getBossChatId();
      if (!bossChat) {
        await tgSendMessage(chatId, "Inbox temporarily unavailable. Please try later.");
        return;
      }
      const { data: prof } = await sb
        .from("profiles")
        .select("email,display_name")
        .eq("id", link.user_id)
        .maybeSingle();
      const who =
        (prof?.display_name as string) ||
        (prof?.email as string) ||
        (username ? `@${username}` : `chat ${chatId}`);
      try {
        await tgSendMessage(
          bossChat,
          `📨 <b>Member message</b>\n` +
            `From: ${escapeHtml(who)} · <code>${chatId}</code>\n\n` +
            escapeHtml(body).slice(0, 3500),
        );
        await tgSendMessage(chatId, "✅ Sent. The team will reply here shortly.");
      } catch (e) {
        console.error("forward to boss failed", e);
        await tgSendMessage(chatId, "Could not deliver your message. Please try again.");
      }
      return;
    }
  }

  // /start CODE   /link CODE   /start  (no arg)
  const m = trimmed.match(/^\/(start|link)(?:@\w+)?(?:\s+(\S+))?/i);
  if (!m) {
    if (/^\/help/i.test(trimmed)) {
      await tgSendMessage(
        chatId,
        "Available commands:\n" +
          "<code>/link CODE</code> — bind this chat to your account\n" +
          "<code>/me</code> — show your account status & credits\n" +
          "<code>/msg TEXT</code> — message the OG-Streamz team\n" +
          "<code>/unlink</code> — disconnect this chat\n\n" +
          "Get your code at <b>/account/passes</b>.",
      );
    }
    return;
  }
  const code = m[2];
  if (!code) {
    await tgSendMessage(
      chatId,
      "Welcome to OG-Streamz. Get your link code at <b>/account/passes</b>, then send <code>/link CODE</code> here."
    );
    return;
  }

  const { data, error } = await (getSupabase() as any).rpc("claim_telegram_link_code", {
    _code: code.toUpperCase(),
    _chat_id: chatId,
    _tg_username: username || null,
  });
  if (error) {
    await tgSendMessage(chatId, "Link failed. Please try again or generate a new code.");
    return;
  }
  const result = data as { ok: boolean; reason?: string };
  if (!result?.ok) {
    const why =
      result?.reason === "expired"
        ? "That code has expired. Generate a fresh one in your account."
        : result?.reason === "not_found"
        ? "That code is not valid."
        : "Could not link. Try a fresh code.";
    await tgSendMessage(chatId, why);
    return;
  }
  await tgSendMessage(
    chatId,
    "✅ Linked! You will now receive VIP pass updates, expiry reminders and live drops here."
  );
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Boss-only command dispatcher. Returns true if the message was consumed
 * (so the generic /link path doesn't also run for the boss). All replies
 * land back in the boss's own chat for confirmation, and any outbound
 * member DMs are persisted into `telegram_messages` so the Boss inbox UI
 * stays in sync.
 */
async function handleBossCommand(
  text: string,
  bossChatId: number,
  msg: any,
): Promise<boolean> {
  // Native Telegram reply: if the boss hits "Reply" on a forwarded member
  // message and types text without a slash command, extract the originating
  // chat_id from the quoted body (we always include "<code>chatId</code>"
  // in the forward header) and DM that chat.
  const replyTo = msg?.reply_to_message;
  const isPlainReply =
    replyTo && !text.startsWith("/") && text.length > 0;
  if (isPlainReply) {
    const quoted: string = replyTo?.text ?? "";
    const idMatch = quoted.match(/(\d{5,})/); // first 5+ digit run
    const target = idMatch ? Number(idMatch[1]) : NaN;
    if (Number.isFinite(target) && target !== bossChatId) {
      await deliverBossDm(target, text, bossChatId);
      return true;
    }
  }

  if (/^\/help\b/i.test(text)) {
    await tgSendMessage(
      bossChatId,
      "<b>Boss commands</b>\n" +
        "<code>/reply CHAT_ID TEXT</code> — DM a member by chat id\n" +
        "<code>/dm CHAT_ID TEXT</code> — alias of /reply\n" +
        "<code>/broadcast TEXT</code> — DM every linked member\n" +
        "<code>/users</code> — count of linked members\n" +
        "<code>/last [N]</code> — most recent N incoming messages (default 5)\n\n" +
        "<i>Tip:</i> tap <b>Reply</b> on any forwarded member message and just " +
        "type — your text is delivered to that member automatically.",
    );
    return true;
  }

  const reply = text.match(/^\/(reply|dm)\s+(-?\d{3,})\s+([\s\S]+)/i);
  if (reply) {
    const target = Number(reply[2]);
    const body = reply[3].trim();
    if (!body) {
      await tgSendMessage(bossChatId, "Empty reply — nothing sent.");
      return true;
    }
    await deliverBossDm(target, body, bossChatId);
    return true;
  }

  if (/^\/broadcast\s+/i.test(text)) {
    const body = text.replace(/^\/broadcast\s+/i, "").trim();
    if (!body) {
      await tgSendMessage(bossChatId, "Usage: <code>/broadcast TEXT</code>");
      return true;
    }
    const sb = getSupabase() as any;
    const { data: rows, error } = await sb
      .from("telegram_user_links")
      .select("chat_id")
      .not("chat_id", "is", null);
    if (error) {
      await tgSendMessage(bossChatId, `Broadcast failed: ${escapeHtml(error.message)}`);
      return true;
    }
    const targets = (rows ?? [])
      .map((r: { chat_id: number | null }) => r.chat_id)
      .filter((id: number | null): id is number => typeof id === "number");
    let sent = 0;
    let failed = 0;
    const safeBody = `📣 <b>Notice</b>\n\n${escapeHtml(body).slice(0, 3500)}`;
    for (const id of targets) {
      try {
        await tgSendMessage(id, safeBody);
        sent++;
      } catch (e) {
        failed++;
        console.error("broadcast send failed for", id, e);
      }
    }
    await tgSendMessage(
      bossChatId,
      `📣 Broadcast complete — ${sent} delivered, ${failed} failed.`,
    );
    return true;
  }

  if (/^\/users\b/i.test(text)) {
    const sb = getSupabase() as any;
    const { count } = await sb
      .from("telegram_user_links")
      .select("user_id", { count: "exact", head: true })
      .not("chat_id", "is", null);
    await tgSendMessage(
      bossChatId,
      `👥 Linked members: <b>${count ?? 0}</b>`,
    );
    return true;
  }

  if (/^\/last\b/i.test(text)) {
    const n = Math.min(20, Math.max(1, Number(text.split(/\s+/)[1]) || 5));
    const sb = getSupabase() as any;
    const { data: rows } = await sb
      .from("telegram_messages")
      .select("chat_id, from_username, from_name, text, message_date")
      .neq("chat_id", bossChatId)
      .order("message_date", { ascending: false })
      .limit(n);
    if (!rows?.length) {
      await tgSendMessage(bossChatId, "Inbox is empty.");
      return true;
    }
    const lines = rows
      .map((r: any) => {
        const who = r.from_name || (r.from_username ? `@${r.from_username}` : `chat ${r.chat_id}`);
        const when = r.message_date ? r.message_date.slice(11, 16) : "";
        const body = (r.text || "").slice(0, 140);
        return `• <b>${escapeHtml(who)}</b> <code>${r.chat_id}</code> ${when}\n  ${escapeHtml(body)}`;
      })
      .join("\n");
    await tgSendMessage(bossChatId, `<b>Last ${rows.length} messages</b>\n${lines}`);
    return true;
  }

  // Not a recognized boss slash command — fall through to normal handling.
  return false;
}

/**
 * Send a DM from boss → member, with confirmation back to boss and an
 * optimistic inbox row so the web Boss inbox renders the outbound message.
 */
async function deliverBossDm(target: number, body: string, bossChatId: number) {
  const safe = escapeHtml(body).slice(0, 3500);
  try {
    await tgSendMessage(target, `💬 <b>OG-Streamz Team</b>\n\n${safe}`);
    try {
      const sb = getSupabase() as any;
      await sb.from("telegram_messages").insert({
        chat_id: target,
        from_username: "boss",
        from_name: "OG-Streamz Team",
        text: body,
        raw: { outbound: true, from_boss: true },
        message_date: new Date().toISOString(),
      });
    } catch (e) {
      console.error("outbound persist failed", e);
    }
    await tgSendMessage(
      bossChatId,
      `✅ Delivered to <code>${target}</code>:\n${safe.slice(0, 200)}${
        safe.length > 200 ? "…" : ""
      }`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await tgSendMessage(
      bossChatId,
      `❌ Could not DM <code>${target}</code>: ${escapeHtml(msg).slice(0, 300)}`,
    );
  }
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const TG = process.env.TELEGRAM_API_KEY;
        if (!TG) return new Response("not configured", { status: 500 });

        const expected = deriveTelegramWebhookSecret(TG);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: any = {};
        try {
          update = await request.json();
        } catch {
          return Response.json({ ok: true });
        }
        const msg = update.message ?? update.edited_message;
        const chatId: number | undefined = msg?.chat?.id;
        const text: string = msg?.text ?? "";
        const username: string = msg?.from?.username ?? "";
        if (!chatId) return Response.json({ ok: true });

        // Persist every incoming message so the Boss inbox can render
        // chats/groups and conversation threads. Idempotent on update_id.
        try {
          if (typeof update.update_id === "number") {
            const fromName = [msg?.from?.first_name, msg?.from?.last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || null;
            await (getSupabase().from("telegram_messages") as any).upsert(
              {
                update_id: update.update_id,
                chat_id: chatId,
                chat_type: msg?.chat?.type ?? null,
                chat_title:
                  msg?.chat?.title ||
                  ([msg?.chat?.first_name, msg?.chat?.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim()) ||
                  msg?.chat?.username ||
                  null,
                from_user_id: msg?.from?.id ?? null,
                from_username: username || null,
                from_name: fromName,
                text: text || null,
                raw: update,
                message_date: msg?.date
                  ? new Date(msg.date * 1000).toISOString()
                  : new Date().toISOString(),
              },
              { onConflict: "update_id" },
            );
          }
        } catch (e) {
          console.error("telegram inbox upsert failed", e);
        }

        if (!text) return Response.json({ ok: true });

        try {
          await handleCommand(text, chatId, username, msg);
        } catch (e) {
          console.error("telegram webhook handler error", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});