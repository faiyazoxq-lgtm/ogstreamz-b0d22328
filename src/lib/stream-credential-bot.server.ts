import { createClient } from "@supabase/supabase-js";
import { tgCall, tgSendMessage } from "./telegram-bot.server";
import { getBossChatId } from "./boss-chat.server";
import { logError, logInfo } from "./server-log.server";

let _sb: ReturnType<typeof createClient> | null = null;
function sb(): any {
  if (!_sb) {
    _sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _sb;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Prompt format that we recover order id from in `reply_to_message`. */
const PROMPT_TAG_RX = /\[creds:(username|password):([0-9a-f-]{36})\]/i;

function buildPrompt(field: "username" | "password", orderId: string, label: string) {
  return (
    `${field === "username" ? "👤" : "🔑"} ${label}\n\n` +
    `<i>Reply to this message with the ${field} only.</i>\n` +
    `[creds:${field}:${orderId}]`
  );
}

export function parseBossPromptReply(replyText: string | undefined | null) {
  if (!replyText) return null;
  const m = replyText.match(PROMPT_TAG_RX);
  if (!m) return null;
  return { field: m[1].toLowerCase() as "username" | "password", orderId: m[2] };
}

async function fetchOrderWithProfile(orderId: string) {
  const { data, error } = await sb()
    .from("pass_orders")
    .select(
      "id,user_id,product_id,kind,duration_days,amount_cents,currency,status,boss_draft_state,boss_draft_username,boss_chat_id,stripe_session_id,created_at",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  const { data: prof } = await sb()
    .from("profiles")
    .select("id,email,display_name,rank,member_tier,avatar_url,credits")
    .eq("id", data.user_id)
    .maybeSingle();
  const { data: prod } = await sb()
    .from("store_products")
    .select("id,name,kind")
    .eq("id", data.product_id)
    .maybeSingle();
  return { order: data, profile: prof ?? null, product: prod ?? null };
}

/** Pre-payment heads-up alert. Plain text, no buttons. */
export async function notifyBossOfStreamRequest(orderId: string) {
  const bossChat = getBossChatId();
  if (!bossChat) return;
  const ctx = await fetchOrderWithProfile(orderId);
  if (!ctx) return;
  const { order, profile, product } = ctx;
  const who = profile?.display_name || profile?.email || order.user_id;
  const text =
    `🟡 <b>Pending stream-profile checkout</b>\n` +
    `Member: ${escapeHtml(String(who))}\n` +
    (profile?.email ? `Email: <code>${escapeHtml(profile.email)}</code>\n` : "") +
    `Product: ${escapeHtml(product?.name || order.product_id)} · ${order.duration_days}d\n` +
    `Amount: ${(order.amount_cents / 100).toFixed(2)} ${(order.currency || "usd").toUpperCase()}\n` +
    `<i>Awaiting Stripe confirmation…</i>`;
  try {
    await tgSendMessage(bossChat, text);
  } catch (e) {
    logError("creds.notify_request_failed", { orderId, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Post-payment actionable card with "Send Credentials" inline button. */
export async function notifyBossOfStreamPurchase(orderId: string) {
  const bossChat = getBossChatId();
  if (!bossChat) return;
  const ctx = await fetchOrderWithProfile(orderId);
  if (!ctx) return;
  const { order, profile, product } = ctx;

  const who = profile?.display_name || profile?.email || order.user_id;
  const tier = profile?.member_tier ? ` · ${escapeHtml(profile.member_tier)}` : "";
  const caption =
    `🟢 <b>Stream profile purchased</b>\n` +
    `Member: <b>${escapeHtml(String(who))}</b>\n` +
    (profile?.email ? `Email: <code>${escapeHtml(profile.email)}</code>\n` : "") +
    `Rank: ${escapeHtml(profile?.rank || "—")}${tier}\n` +
    `Product: ${escapeHtml(product?.name || order.product_id)} · ${order.duration_days}d\n` +
    `Paid: ${(order.amount_cents / 100).toFixed(2)} ${(order.currency || "usd").toUpperCase()}\n` +
    `Order: <code>${order.id.slice(0, 8)}</code>`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: "✉️ Send Credentials", callback_data: `creds:start:${order.id}` }],
    ],
  };

  try {
    if (profile?.avatar_url) {
      await tgCall(
        "sendPhoto",
        {
          chat_id: bossChat,
          photo: profile.avatar_url,
          caption,
          parse_mode: "HTML",
          reply_markup,
        },
        { tag: "tg.creds.card" },
      );
    } else {
      await tgCall(
        "sendMessage",
        {
          chat_id: bossChat,
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup,
        },
        { tag: "tg.creds.card" },
      );
    }
  } catch (e) {
    logError("creds.notify_purchase_failed", { orderId, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Handle the "Send Credentials" button tap. */
export async function handleCredsCallback(cb: any): Promise<boolean> {
  const data: string | undefined = cb?.data;
  if (!data || !data.startsWith("creds:")) return false;
  const [, action, orderId] = data.split(":");
  const bossChat = Number(cb?.from?.id ?? cb?.message?.chat?.id);
  if (!bossChat || !orderId) return true;

  const expectedBoss = getBossChatId();
  if (expectedBoss && String(bossChat) !== String(expectedBoss)) {
    await tgCall("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: "Boss only",
      show_alert: true,
    }, { tag: "tg.creds.cb" }).catch(() => {});
    return true;
  }

  if (action !== "start") return true;

  const ctx = await fetchOrderWithProfile(orderId);
  if (!ctx) {
    await tgCall("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: "Order not found",
      show_alert: true,
    }, { tag: "tg.creds.cb" }).catch(() => {});
    return true;
  }

  // Mark order awaiting username
  await sb()
    .from("pass_orders")
    .update({
      boss_chat_id: bossChat,
      boss_draft_state: "awaiting_username",
      boss_draft_username: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await tgCall("answerCallbackQuery", { callback_query_id: cb.id }, { tag: "tg.creds.cb" }).catch(() => {});

  const who = ctx.profile?.display_name || ctx.profile?.email || ctx.order.user_id;
  await tgCall(
    "sendMessage",
    {
      chat_id: bossChat,
      text: buildPrompt("username", orderId, `Username for ${escapeHtml(String(who))}`),
      parse_mode: "HTML",
      reply_markup: { force_reply: true, selective: true, input_field_placeholder: "Stream username" },
    },
    { tag: "tg.creds.prompt" },
  );
  return true;
}

/** Handle the boss replying to one of our force-reply prompts. */
export async function handleBossCredsReply(msg: any): Promise<boolean> {
  const replyText: string | undefined = msg?.reply_to_message?.text;
  const parsed = parseBossPromptReply(replyText);
  if (!parsed) return false;

  const bossChat = Number(msg?.chat?.id);
  const expectedBoss = getBossChatId();
  if (expectedBoss && String(bossChat) !== String(expectedBoss)) return false;

  const value = String(msg?.text ?? "").trim();
  if (!value) {
    await tgSendMessage(bossChat, "Empty reply — nothing saved.");
    return true;
  }

  const ctx = await fetchOrderWithProfile(parsed.orderId);
  if (!ctx) {
    await tgSendMessage(bossChat, "Order not found.");
    return true;
  }
  const who = ctx.profile?.display_name || ctx.profile?.email || ctx.order.user_id;

  if (parsed.field === "username") {
    await sb()
      .from("pass_orders")
      .update({
        boss_draft_state: "awaiting_password",
        boss_draft_username: value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.orderId);

    await tgCall(
      "sendMessage",
      {
        chat_id: bossChat,
        text: buildPrompt("password", parsed.orderId, `Password for ${escapeHtml(String(who))}`),
        parse_mode: "HTML",
        reply_markup: { force_reply: true, selective: true, input_field_placeholder: "Stream password" },
      },
      { tag: "tg.creds.prompt" },
    );
    return true;
  }

  // password field — we have everything; record + deliver.
  const username = ctx.order.boss_draft_username;
  if (!username) {
    await tgSendMessage(bossChat, "Lost the username draft — tap “Send Credentials” again.");
    return true;
  }

  const { data, error } = await sb().rpc("boss_record_stream_credentials", {
    _order_id: parsed.orderId,
    _username: username,
    _password: value,
  });
  if (error) {
    logError("creds.record_failed", { orderId: parsed.orderId, error: error.message });
    await tgSendMessage(bossChat, `Could not save: ${escapeHtml(error.message)}`);
    return true;
  }

  const result = data as { ok?: boolean; chat_id?: number | null; email?: string | null };
  const memberChat = result?.chat_id ?? null;
  const memberMsg =
    `🎬 <b>Your stream profile is ready</b>\n\n` +
    `Username: <code>${escapeHtml(username)}</code>\n` +
    `Password: <code>${escapeHtml(value)}</code>\n\n` +
    `Tap-and-hold to copy. You can also view these any time on your <b>dashboard</b>.\n` +
    `<i>Welcome to OG-Streamz.</i>`;

  let dmStatus = "no telegram link";
  if (memberChat) {
    try {
      await tgSendMessage(memberChat, memberMsg);
      dmStatus = `DM sent to chat …${String(memberChat).slice(-6)}`;
    } catch (e) {
      dmStatus = `DM failed: ${e instanceof Error ? e.message : String(e)}`;
      logError("creds.member_dm_failed", { orderId: parsed.orderId, error: dmStatus });
    }
  }

  await tgSendMessage(
    bossChat,
    `✅ <b>Credentials delivered</b>\n` +
      `Member: ${escapeHtml(String(who))}\n` +
      `Tag: <code>OG-STREAMZ MEMBER · BELOW VIP STATUS</code>\n` +
      `${escapeHtml(dmStatus)}`,
  );

  logInfo("creds.delivered", { orderId: parsed.orderId, memberChat: memberChat ?? null });
  return true;
}