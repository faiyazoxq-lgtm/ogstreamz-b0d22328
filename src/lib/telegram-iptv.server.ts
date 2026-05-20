import { createClient } from "@supabase/supabase-js";
import { tgCall, tgSendMessage, type TgInlineKeyboard } from "./telegram-bot.server";
import { logError, logInfo } from "./server-log.server";

const IPTV_HOST_DEFAULT = "xiu96ctyh6-system.xyz";

function getHost(): string {
  return (process.env.IPTV_HOST || IPTV_HOST_DEFAULT)
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

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

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PROMPT_TAG_RX = /\[iptv:(user|pass)\]/i;

export function parseIptvPromptReply(replyText: string | undefined | null) {
  if (!replyText) return null;
  const m = replyText.match(PROMPT_TAG_RX);
  if (!m) return null;
  return { field: m[1].toLowerCase() as "user" | "pass" };
}

/** Probe upstream Xtream player_api.php. Returns parsed user_info or error. */
async function probeIptv(username: string, password: string): Promise<
  | { ok: true; status: string | null; expiresAt: string | null; active: number | null; max: number | null; isTrial: boolean }
  | { ok: false; error: string }
> {
  const host = getHost();
  const url =
    `http://${host}/player_api.php` +
    `?username=${encodeURIComponent(username)}` +
    `&password=${encodeURIComponent(password)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "OGStreamz/1.0" },
    });
    if (!res.ok) return { ok: false, error: `Upstream ${res.status}` };
    const text = await res.text();
    let j: any;
    try { j = JSON.parse(text); } catch { return { ok: false, error: "Invalid response from provider" }; }
    const info = j?.user_info ?? {};
    const auth = Number(info.auth ?? j?.auth ?? 0);
    if (auth !== 1) return { ok: false, error: "Invalid credentials" };
    const expN = Number(info.exp_date);
    const expiresAt = Number.isFinite(expN) && expN > 0 ? new Date(expN * 1000).toISOString() : null;
    return {
      ok: true,
      status: typeof info.status === "string" ? info.status : null,
      expiresAt,
      active: info.active_cons != null ? Number(info.active_cons) : null,
      max: info.max_connections != null ? Number(info.max_connections) : null,
      isTrial: info.is_trial === "1" || info.is_trial === 1,
    };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "Timeout" : "Network error" };
  } finally {
    clearTimeout(t);
  }
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const d = new Date(expiresAt);
  const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toISOString().slice(0, 10);
  if (days < 0) return `${date} (expired ${-days}d ago)`;
  if (days === 0) return `${date} (expires today)`;
  return `${date} (in ${days}d)`;
}

const reCheckKb = (): TgInlineKeyboard => ({
  inline_keyboard: [
    [{ text: "🔄 Re-check expiry", callback_data: "iptv:check" }],
    [{ text: "🔁 Update credentials", callback_data: "iptv:relink" }],
  ],
});

function statusMessage(opts: {
  status: string | null;
  expiresAt: string | null;
  active: number | null;
  max: number | null;
  isTrial: boolean;
}) {
  const s = (opts.status || "—").toLowerCase();
  const dot = s === "active" ? "🟢" : s === "expired" ? "🔴" : "🟡";
  const lines = [
    `${dot} <b>Stream line status</b>`,
    `Status: <b>${esc(opts.status || "—")}</b>${opts.isTrial ? " · trial" : ""}`,
    `Expiry: <b>${esc(formatExpiry(opts.expiresAt))}</b>`,
  ];
  if (opts.max != null) {
    lines.push(`Lines: <b>${opts.active ?? 0}/${opts.max}</b>`);
  }
  lines.push("", "<i>Saved securely. Tap below any time.</i>");
  return lines.join("\n");
}

/** Send the first force-reply prompt asking for the IPTV username. */
export async function startIptvCapture(chatId: number) {
  await sb().from("telegram_user_links")
    .update({ iptv_draft_username: null, updated_at: new Date().toISOString() })
    .eq("chat_id", chatId);
  await tgCall(
    "sendMessage",
    {
      chat_id: chatId,
      text:
        `📺 <b>Link your stream line</b>\n\n` +
        `Reply with your <b>IPTV username</b> to see your status & expiry here.\n` +
        `<i>(Credentials are stored encrypted. Server URL stays private.)</i>\n` +
        `[iptv:user]`,
      parse_mode: "HTML",
      reply_markup: { force_reply: true, selective: true, input_field_placeholder: "IPTV username" },
    },
    { tag: "tg.iptv.prompt" },
  );
}

async function promptPassword(chatId: number) {
  await tgCall(
    "sendMessage",
    {
      chat_id: chatId,
      text:
        `🔑 Now reply with your <b>IPTV password</b>.\n` +
        `<i>Stored encrypted at rest — never shown back to you.</i>\n` +
        `[iptv:pass]`,
      parse_mode: "HTML",
      reply_markup: { force_reply: true, selective: true, input_field_placeholder: "IPTV password" },
    },
    { tag: "tg.iptv.prompt" },
  );
}

/**
 * Process a reply to one of our IPTV force-reply prompts. Returns true if
 * the message was consumed.
 */
export async function handleIptvReply(msg: any): Promise<boolean> {
  const parsed = parseIptvPromptReply(msg?.reply_to_message?.text);
  if (!parsed) return false;
  const chatId = Number(msg?.chat?.id);
  if (!chatId) return false;
  const value = String(msg?.text ?? "").trim();
  if (!value) {
    await tgSendMessage(chatId, "Empty reply — nothing saved. Send /linkstream to try again.");
    return true;
  }

  if (parsed.field === "user") {
    if (value.length < 2 || value.length > 120 || /\s/.test(value)) {
      await tgSendMessage(chatId, "Username looks invalid. Send /linkstream to try again.");
      return true;
    }
    await sb().from("telegram_user_links")
      .update({ iptv_draft_username: value, updated_at: new Date().toISOString() })
      .eq("chat_id", chatId);
    await promptPassword(chatId);
    return true;
  }

  // Password reply — pair with stored draft username, probe, persist.
  const { data: row } = await sb().from("telegram_user_links")
    .select("iptv_draft_username")
    .eq("chat_id", chatId)
    .maybeSingle();
  const username = (row as any)?.iptv_draft_username as string | null;
  if (!username) {
    await tgSendMessage(chatId, "Lost the username draft — send /linkstream to start over.");
    return true;
  }
  if (value.length < 2 || value.length > 200) {
    await tgSendMessage(chatId, "Password looks invalid. Send /linkstream to try again.");
    return true;
  }

  try {
    await tgCall("sendChatAction", { chat_id: chatId, action: "typing" }, { tag: "tg.typing", silent: true });
  } catch { /* non-fatal */ }

  const probe = await probeIptv(username, value);
  if (!probe.ok) {
    await tgSendMessage(
      chatId,
      `❌ <b>Couldn’t verify line</b>\n${esc(probe.error)}\n\nSend /linkstream to try again.`,
    );
    return true;
  }

  const { error } = await sb().rpc("tg_set_iptv_creds", {
    _chat_id: chatId,
    _username: username,
    _password: value,
    _status: probe.status,
    _expires_at: probe.expiresAt,
  });
  if (error) {
    logError("tg.iptv.save_failed", { chatIdSuffix: String(chatId).slice(-6), error: error.message });
    await tgSendMessage(chatId, "Verified, but couldn’t save securely. Please try again later.");
    return true;
  }

  await tgSendMessage(chatId, statusMessage(probe), { reply_markup: reCheckKb() });
  logInfo("tg.iptv.linked", { chatIdSuffix: String(chatId).slice(-6), status: probe.status });
  return true;
}

/** /expiry command + "Re-check expiry" inline button. */
export async function showIptvExpiry(chatId: number) {
  const { data, error } = await sb().rpc("tg_get_iptv_creds", { _chat_id: chatId });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row?.username || !row?.password) {
    await tgSendMessage(
      chatId,
      `📺 <b>No stream line on file</b>\n\nSend /linkstream to add your IPTV username & password and see expiry here.`,
    );
    return;
  }
  try {
    await tgCall("sendChatAction", { chat_id: chatId, action: "typing" }, { tag: "tg.typing", silent: true });
  } catch { /* non-fatal */ }
  const probe = await probeIptv(row.username, row.password);
  if (!probe.ok) {
    // Fall back to last-known cached values.
    await tgSendMessage(
      chatId,
      `⚠️ <b>Couldn’t reach provider</b> (${esc(probe.error)})\n\n` +
        `Last known status: <b>${esc(row.status || "—")}</b>\n` +
        `Last known expiry: <b>${esc(formatExpiry(row.expires_at))}</b>`,
      { reply_markup: reCheckKb() },
    );
    return;
  }
  await sb().rpc("tg_set_iptv_status", {
    _chat_id: chatId,
    _status: probe.status,
    _expires_at: probe.expiresAt,
  });
  await tgSendMessage(chatId, statusMessage(probe), { reply_markup: reCheckKb() });
}

/** Inline button taps with prefix "iptv:" */
export async function handleIptvCallback(cb: any): Promise<boolean> {
  const data: string = cb?.data ?? "";
  if (!data.startsWith("iptv:")) return false;
  const chatId = Number(cb?.message?.chat?.id);
  const cbId = cb?.id;
  if (!chatId || !cbId) return true;
  try {
    await tgCall("answerCallbackQuery", { callback_query_id: cbId }, { tag: "tg.iptv.cb", silent: true });
  } catch { /* non-fatal */ }
  const action = data.slice("iptv:".length);
  if (action === "check") {
    await showIptvExpiry(chatId);
    return true;
  }
  if (action === "relink") {
    await startIptvCapture(chatId);
    return true;
  }
  return true;
}
