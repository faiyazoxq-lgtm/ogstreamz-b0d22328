import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import {
  tgSendMessage,
  tgSendPhoto,
  tgCall,
  deriveTelegramWebhookSecret,
  type TgInlineKeyboard,
} from "@/lib/telegram-bot.server";
import { getBossChatId } from "@/lib/boss-chat.server";
import { logInfo, logWarn, logError } from "@/lib/server-log.server";
import {
  handleCredsCallback,
  handleBossCredsReply,
} from "@/lib/stream-credential-bot.server";
import {
  getPerplexityReply,
  getSwearingEnabled,
  setSwearingEnabled,
} from "@/lib/perplexity.server";

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

  // --- AI agent: /swear toggle + /ask <prompt> --------------------------
  // These work in any chat (no link required) so members can try the agent
  // before binding their account.
  if (/^\/swear\b/i.test(trimmed)) {
    const current = await getSwearingEnabled(chatId);
    const next = !current;
    await setSwearingEnabled(chatId, next);
    await tgSendMessage(
      chatId,
      next
        ? "🤬 <b>Swearing agent ACTIVATED.</b> Brace yourself."
        : "😇 <b>Swearing agent OFF.</b> Clean mode engaged.",
    );
    return;
  }
  if (/^\/ask\b/i.test(trimmed)) {
    const prompt = trimmed.replace(/^\/ask\s*/i, "").trim();
    if (!prompt) {
      await tgSendMessage(
        chatId,
        "Give me something to work with. <code>/ask &lt;your question&gt;</code>",
      );
      return;
    }
    try {
      await tgCall(
        "sendChatAction",
        { chat_id: chatId, action: "typing" },
        { tag: "tg.typing", silent: true },
      );
    } catch {
      // non-fatal
    }
    const swearing = await getSwearingEnabled(chatId);
    const reply = await getPerplexityReply(chatId, prompt, swearing);
    await tgSendMessage(chatId, escapeHtml(reply).slice(0, 3500));
    return;
  }

  // --- Boss-only commands -------------------------------------------------
  // Anything sent in the chat whose ID matches BOSS_TELEGRAM_CHAT_ID_TEST is
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
  if (/^\/(me|status|account|credits|unlink|msg|contact|boss)\b/i.test(trimmed)) {
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

    if (/^\/(me|status|account|credits)\b/i.test(trimmed)) {
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
          `Commands: /me · /status · /msg &lt;text&gt; · /unlink · /help`,
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
        logError("tg.webhook.forward_to_boss_failed", {
          chatId,
          error: e instanceof Error ? e.message : String(e),
        });
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
          "<code>/status</code> — alias of /me\n" +
          "<code>/msg TEXT</code> — message the OG-Streamz team\n" +
          "<code>/ask TEXT</code> — chat with the OG AI agent\n" +
          "<code>/swear</code> — toggle the swearing agent on/off\n" +
          "<code>/unlink</code> — disconnect this chat\n\n" +
          "Get your code at <b>/account/passes</b>.",
      );
    }
    return;
  }
  const rawArg = m[2];
  // Deep links from the site arrive as `/start CODE__OGPASSTAG` because
  // Telegram's `start` parameter only accepts [A-Za-z0-9_-]. Split on the
  // double-underscore so we recover the 8-char link CODE that
  // `claim_telegram_link_code` actually stored.
  const [codePart] = rawArg ? rawArg.split("__", 2) : [undefined];
  const code = codePart;
  if (!code) {
    // /start with no code:
    //   1. Always upsert the chat_id (+ tg username / name) into
    //      telegram_chat_prefs so we have a first-class onboarding record
    //      from the very first contact, even before they generate a code.
    //   2. Already-linked chat → branded welcome card.
    //   3. Unlinked chat       → clear numbered onboarding card.
    const sb = getSupabase() as any;
    const nowIso = new Date().toISOString();
    try {
      await sb.from("telegram_chat_prefs").upsert(
        {
          chat_id: chatId,
          tg_username: username || null,
          first_name: (msg?.from?.first_name as string | undefined) ?? null,
          last_name: (msg?.from?.last_name as string | undefined) ?? null,
          last_start_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "chat_id" },
      );
    } catch (e) {
      logWarn("tg.start.prefs_upsert_failed", {
        chatIdSuffix: String(chatId).slice(-8),
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const { data: link } = await sb
      .from("telegram_user_links")
      .select("user_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (link?.user_id) {
      let displayName: string | null = null;
      try {
        const { data: prof } = await sb
          .from("profiles")
          .select("display_name,email")
          .eq("id", link.user_id)
          .maybeSingle();
        displayName = (prof?.display_name as string) || (prof?.email as string) || null;
      } catch {
        // best-effort personalisation only
      }
      await sendBrandedWelcome(chatId, { returning: true, displayName });
    } else {
      const hello = msg?.from?.first_name
        ? `Hey ${escapeHtml(String(msg.from.first_name))} 👋`
        : "Hey 👋";
      await tgSendMessage(
        chatId,
        `${hello}\n\n` +
          `Welcome to <b>OG-Streamz</b>. This bot delivers your drops, ` +
          `credits and live alerts straight into Telegram.\n\n` +
          `<b>Link this chat to your account in 3 steps:</b>\n` +
          `1. Open <b>ogstreamz.co.uk/account/passes</b> on the site.\n` +
          `2. Tap <b>“Link Telegram”</b> to get your 8-character code.\n` +
          `3. Send it back here as <code>/link CODE</code>.\n\n` +
          `Once linked you can use:\n` +
          `• <code>/me</code> — account status &amp; credits\n` +
          `• <code>/msg TEXT</code> — message the OG-Streamz team\n` +
          `• <code>/ask TEXT</code> — chat with the OG AI agent\n` +
          `• <code>/help</code> — full command list`,
      );
    }
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
  // Look up the freshly-linked profile so we can show the member exactly
  // which OG-Streamz account this Telegram chat is now bound to. This is
  // the explicit "successfully connected" confirmation.
  let linkedProfile: {
    display_name: string | null;
    email: string | null;
    og_pass_no: number | null;
    status: string | null;
    rank: string | null;
  } | null = null;
  try {
    const sb = getSupabase() as any;
    const { data: link } = await sb
      .from("telegram_user_links")
      .select("user_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (link?.user_id) {
      const { data: prof } = await sb
        .from("profiles")
        .select("display_name,email,og_pass_no,status,rank")
        .eq("id", link.user_id)
        .maybeSingle();
      if (prof) {
        const p = prof as any;
        linkedProfile = {
          display_name: p.display_name ?? null,
          email: p.email ?? null,
          og_pass_no: p.og_pass_no ?? null,
          status: p.status ?? null,
          rank: p.rank ?? null,
        };
      }
    }
  } catch (e) {
    logWarn("tg.link.profile_lookup_failed", {
      chatIdSuffix: String(chatId).slice(-8),
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Branded welcome card — uses the site wallpaper + OG-Streamz theme.
  await sendBrandedWelcome(chatId, {
    returning: false,
    displayName: linkedProfile?.display_name || linkedProfile?.email || null,
  });

  // Explicit profile-bound confirmation so the member can verify the
  // right account was linked (and spot a wrong-account mistake fast).
  if (linkedProfile) {
    const who =
      linkedProfile.display_name ||
      linkedProfile.email ||
      "your OG-Streamz profile";
    const ogLine =
      linkedProfile.og_pass_no != null
        ? `🪪 OG PASS: <b>#${linkedProfile.og_pass_no}</b>\n`
        : "";
    const tierLine =
      linkedProfile.status || linkedProfile.rank
        ? `🎟 Tier: <b>${escapeHtml(linkedProfile.status || "member")}</b>` +
          (linkedProfile.rank ? ` · ${escapeHtml(linkedProfile.rank)}` : "") +
          "\n"
        : "";
    const siteBase = (process.env.PUBLIC_SITE_URL || "https://ogstreamz.co.uk").replace(/\/$/, "");
    const confirmKeyboard: TgInlineKeyboard = {
      inline_keyboard: [
        [
          { text: "👤 View my profile", url: `${siteBase}/profile` },
          { text: "🔓 VIP Vault", url: `${siteBase}/vip` },
        ],
        [{ text: "🔌 Unlink this chat", callback_data: "wc:unlink" }],
      ],
    };
    await tgSendMessage(
      chatId,
      `✅ <b>Successfully connected</b>\n\n` +
        `This Telegram chat is now bound to:\n` +
        `👤 <b>${escapeHtml(String(who))}</b>\n` +
        (linkedProfile.email && linkedProfile.email !== who
          ? `📧 <code>${escapeHtml(linkedProfile.email)}</code>\n`
          : "") +
        ogLine +
        tierLine +
        `\nTap <b>View my profile</b> to verify the account, or <b>Unlink</b> if it's wrong.\n` +
        `Try <code>/me</code>, <code>/vault</code> or <code>/help</code> any time.`,
      { reply_markup: confirmKeyboard },
    );
  } else {
    // Defensive fallback: claim succeeded but lookup failed. Still confirm.
    await tgSendMessage(
      chatId,
      "✅ <b>Successfully connected.</b> This chat is now bound to your OG-Streamz profile. Send <code>/me</code> to see your account.",
    );
  }

  // Mirror onboarding metadata into telegram_chat_prefs so the chat record
  // exists even if the user never sent /start first.
  try {
    const nowIso = new Date().toISOString();
    await (getSupabase() as any).from("telegram_chat_prefs").upsert(
      {
        chat_id: chatId,
        tg_username: username || null,
        first_name: (msg?.from?.first_name as string | undefined) ?? null,
        last_name: (msg?.from?.last_name as string | undefined) ?? null,
        last_start_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "chat_id" },
    );
  } catch (e) {
    logWarn("tg.link.prefs_upsert_failed", {
      chatIdSuffix: String(chatId).slice(-8),
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Boss-only audit notice: tie this Telegram identity to the member's OG Pass.
  try {
    const sb = getSupabase() as any;
    const { data: link } = await sb
      .from("telegram_user_links")
      .select("user_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (link?.user_id) {
      const { data: prof } = await sb
        .from("profiles")
        .select("email,display_name,og_pass_no,status,rank")
        .eq("id", link.user_id)
        .maybeSingle();
      const bossChat = getBossChatId();
      if (bossChat && prof) {
        const who = prof.display_name || prof.email || link.user_id;
        const og = prof.og_pass_no != null ? `#${prof.og_pass_no}` : "—";
        const handle = username ? `@${username}` : "(no username)";
        await tgSendMessage(
          bossChat,
          `🔗 <b>Telegram linked</b>\n` +
            `OG PASS: <b>${escapeHtml(String(og))}</b>\n` +
            `Member: ${escapeHtml(String(who))}\n` +
            (prof.email ? `Email: <code>${escapeHtml(prof.email)}</code>\n` : "") +
            `Telegram: ${escapeHtml(handle)} · <code>${chatId}</code>\n` +
            `Tier: ${escapeHtml(prof.status || "—")}${prof.rank ? ` · ${escapeHtml(prof.rank)}` : ""}`,
        );
      }
    }
  } catch (e) {
    logError("tg.webhook.boss_link_notify_failed", {
      chatIdSuffix: String(chatId).slice(-8),
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Handle inline-button taps from the branded welcome card. Buttons use the
 * "wc:" callback_data prefix so they're routed here. We acknowledge the tap
 * with answerCallbackQuery (otherwise Telegram leaves the button spinning)
 * and reply in-chat with the requested action.
 */
async function handleWelcomeCallback(cb: any): Promise<void> {
  const data: string = cb?.data ?? "";
  const chatId: number | undefined = cb?.message?.chat?.id;
  const cbId: string | undefined = cb?.id;
  if (!chatId || !cbId) return;

  // Acknowledge first so the client stops the loading spinner immediately.
  try {
    await tgCall("answerCallbackQuery", { callback_query_id: cbId }, { tag: "tg.answerCb", silent: true });
  } catch {
    // Non-fatal — the in-chat reply is the real payload.
  }

  if (data === "wc:help") {
    await tgSendMessage(
      chatId,
      "<b>OG-Streamz commands</b>\n" +
        "<code>/me</code> — account &amp; credits\n" +
        "<code>/status</code> — alias of /me\n" +
        "<code>/msg TEXT</code> — message the team\n" +
        "<code>/unlink</code> — disconnect this chat\n" +
        "<code>/start</code> — re-show the welcome card\n\n" +
        "Tap <b>VIP Pass</b> or <b>Live Drops</b> on the welcome card to jump back to the site.",
    );
  }
}

/**
 * Branded /start welcome card. Sent on:
 *  - successful /link CODE (returning=false, fresh link)
 *  - /start with no code from an already-linked chat (returning=true)
 *
 * Uses the site wallpaper at /brand/og-image.jpg as the photo, so the
 * Telegram card carries the OG-STREAMZ theme. Falls back to a plain text
 * message if Telegram rejects the photo (sendPhoto already does this).
 */
async function sendBrandedWelcome(
  chatId: number,
  opts: { returning: boolean; displayName: string | null },
) {
  const siteBase = (process.env.PUBLIC_SITE_URL || "https://ogstreamz.co.uk").replace(/\/$/, "");
  const wallpaperUrl = `${siteBase}/brand/og-image.jpg`;
  const greeting = opts.returning
    ? `👑 <b>Welcome back${opts.displayName ? ", " + escapeHtml(opts.displayName) : ""}</b>`
    : `🔥 <b>Welcome to OG-STREAMZ</b> 🔥`;
  const sub = opts.returning
    ? `<i>The Syndicate frequency is still locked in.</i>`
    : `<i>The Syndicate just opened the gate.</i>`;
  const linkLine = opts.returning
    ? `✅ <b>Telegram already linked.</b> You're set to receive:`
    : `✅ <b>Telegram linked.</b> You'll now get:`;
  const caption =
    `${greeting}\n${sub}\n\n` +
    `${linkLine}\n` +
    `• 🎟 VIP pass updates &amp; expiry reminders\n` +
    `• 📡 Live drops the moment they go hot\n` +
    `• 💬 Direct line to the OG-Streamz team\n\n` +
    `<b>Quick commands</b>\n` +
    `<code>/me</code> · account &amp; credits\n` +
    `<code>/msg TEXT</code> · message the team\n` +
    `<code>/help</code> · see everything\n\n` +
    `🌐 ${siteBase}`;
  const reply_markup: TgInlineKeyboard = {
    inline_keyboard: [
      [
        { text: "🎟 VIP Pass", url: `${siteBase}/account/passes` },
        { text: "📡 Live Drops", url: `${siteBase}/` },
      ],
      [{ text: "❓ Help", callback_data: "wc:help" }],
    ],
  };
  try {
    await tgSendPhoto(chatId, wallpaperUrl, caption, { reply_markup });
  } catch (e) {
    logError("tg.webhook.welcome_failed", {
      chatIdSuffix: String(chatId).slice(-8),
      returning: opts.returning,
      error: e instanceof Error ? e.message : String(e),
    });
    await tgSendMessage(chatId, caption, { reply_markup });
  }
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
        logError("tg.webhook.broadcast_send_failed", {
          targetSuffix: String(id).slice(-8),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    logInfo("tg.webhook.broadcast_complete", { sent, failed, total: targets.length });
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
      logError("tg.webhook.outbound_persist_failed", {
        targetSuffix: String(target).slice(-8),
        error: e instanceof Error ? e.message : String(e),
      });
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
        const requestStartedAt = Date.now();
        const TG = process.env.TELEGRAM_API_KEY;
        if (!TG) {
          logError("tg.webhook.misconfigured", { reason: "missing_telegram_api_key" });
          return new Response("not configured", { status: 500 });
        }

        const expected = deriveTelegramWebhookSecret(TG);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) {
          logWarn("tg.webhook.unauthorized", {
            hasHeader: got.length > 0,
            ip: request.headers.get("x-forwarded-for") ?? null,
          });
          return new Response("Unauthorized", { status: 401 });
        }

        let update: any = {};
        try {
          update = await request.json();
        } catch {
          logWarn("tg.webhook.bad_json");
          return Response.json({ ok: true });
        }
        // Inline-button taps from the boss credential card.
        if (update.callback_query) {
          const cbData: string = update.callback_query?.data ?? "";
          // Welcome-card buttons (data prefix "wc:") are handled inline
          // here so they work for every linked member, not just boss creds.
          if (cbData.startsWith("wc:")) {
            try {
              await handleWelcomeCallback(update.callback_query);
            } catch (e) {
              logError("tg.webhook.welcome_callback_failed", {
                error: e instanceof Error ? e.message : String(e),
              });
            }
            return Response.json({ ok: true });
          }
          try {
            await handleCredsCallback(update.callback_query);
          } catch (e) {
            logError("tg.webhook.callback_failed", {
              error: e instanceof Error ? e.message : String(e),
            });
          }
          return Response.json({ ok: true });
        }
        const msg = update.message ?? update.edited_message;
        const chatId: number | undefined = msg?.chat?.id;
        const text: string = msg?.text ?? "";
        const username: string = msg?.from?.username ?? "";
        if (!chatId) {
          logInfo("tg.webhook.no_chat_id", { updateId: update.update_id ?? null });
          return Response.json({ ok: true });
        }

        logInfo("tg.webhook.received", {
          updateId: update.update_id ?? null,
          chatType: msg?.chat?.type ?? null,
          chatIdSuffix: String(chatId).slice(-8),
          edited: Boolean(update.edited_message),
          textLen: text.length,
        });

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
          logError("tg.webhook.inbox_upsert_failed", {
            updateId: update.update_id ?? null,
            error: e instanceof Error ? e.message : String(e),
          });
        }

        if (!text) {
          logInfo("tg.webhook.handled", {
            updateId: update.update_id ?? null,
            ms: Date.now() - requestStartedAt,
            kind: "non_text",
          });
          return Response.json({ ok: true });
        }

        // Boss is replying to one of our credential force-reply prompts —
        // intercept BEFORE the generic /reply DM logic so it's not treated
        // as a member chat reply.
        try {
          if (await handleBossCredsReply(msg)) {
            return Response.json({ ok: true });
          }
        } catch (e) {
          logError("tg.webhook.creds_reply_failed", {
            error: e instanceof Error ? e.message : String(e),
          });
        }

        try {
          await handleCommand(text, chatId, username, msg);
          logInfo("tg.webhook.handled", {
            updateId: update.update_id ?? null,
            ms: Date.now() - requestStartedAt,
            kind: "command",
          });
        } catch (e) {
          logError("tg.webhook.handler_error", {
            updateId: update.update_id ?? null,
            chatIdSuffix: String(chatId).slice(-8),
            commandPrefix: text.split(/\s+/)[0]?.slice(0, 32) ?? null,
            ms: Date.now() - requestStartedAt,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});