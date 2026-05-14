import { logInfo, logWarn, logError } from "./server-log.server";
import { getBossChatId } from "./boss-chat.server";

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

// Boss-alert throttle: at most one alert per error key per cooldown window.
// Keyed by `${method}:${status}:${shortDescription}` so a sustained outage
// produces one alert, not one per failed delivery.
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

function shouldAlert(key: string): boolean {
  const now = Date.now();
  const last = lastAlertAt.get(key) ?? 0;
  if (now - last < ALERT_COOLDOWN_MS) return false;
  lastAlertAt.set(key, now);
  return true;
}

function shortenChatId(id: number | string): string {
  return String(id).slice(-8);
}

interface TgCallOptions {
  /** Skip boss alerts on failure (used by the alert path to avoid recursion). */
  silent?: boolean;
  /** Tag for log lines, e.g. "tg.send", "tg.alert". Defaults to "tg.call". */
  tag?: string;
}

export async function tgCall(
  method: string,
  body: Record<string, unknown>,
  opts: TgCallOptions = {},
) {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  const TG = process.env.TELEGRAM_API_KEY;
  const tag = opts.tag ?? "tg.call";
  const chatId = body.chat_id as number | string | undefined;
  const ctx = {
    method,
    chatIdSuffix: chatId !== undefined ? shortenChatId(chatId) : null,
  };

  if (!LOVABLE) {
    logError(tag, { ...ctx, reason: "missing_lovable_api_key" });
    throw new Error("LOVABLE_API_KEY missing");
  }
  if (!TG) {
    logError(tag, { ...ctx, reason: "missing_telegram_api_key" });
    throw new Error("TELEGRAM_API_KEY missing");
  }

  const startedAt = Date.now();
  let status = 0;
  let r: Response | null = null;
  let j: any = {};
  try {
    r = await fetch(`${TG_GATEWAY}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE}`,
        "X-Connection-Api-Key": TG,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    status = r.status;
    j = await r.json().catch(() => ({}));
  } catch (e) {
    const ms = Date.now() - startedAt;
    const msg = e instanceof Error ? e.message : String(e);
    logError(tag, { ...ctx, ms, reason: "network_error", error: msg });
    if (!opts.silent) {
      void alertBossDeliveryFailure({
        method,
        status: 0,
        description: `network: ${msg}`,
        chatId,
      });
    }
    throw new Error(`Telegram ${method} network error: ${msg}`);
  }

  const ms = Date.now() - startedAt;

  if (!r.ok || j?.ok === false) {
    const description = String(j?.description ?? `http ${status}`);
    logError(tag, {
      ...ctx,
      ms,
      status,
      reason: "telegram_error",
      description,
      error_code: j?.error_code ?? null,
      retry_after: j?.parameters?.retry_after ?? null,
    });
    if (!opts.silent) {
      void alertBossDeliveryFailure({ method, status, description, chatId });
    }
    throw new Error(
      `Telegram ${method} failed [${status}]: ${j?.description ?? JSON.stringify(j)}`,
    );
  }

  logInfo(tag, { ...ctx, ms, status });
  return j.result;
}

export async function tgSendMessage(chatId: number | string, text: string) {
  return tgCall(
    "sendMessage",
    {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    },
    { tag: "tg.send" },
  );
}

/**
 * Multipart upload to the Telegram gateway. Used for sendPhoto / sendDocument
 * with raw file bytes. `fileField` is the Telegram form field name, e.g.
 * "photo" for sendPhoto or "document" for sendDocument. `fields` are extra
 * form fields like chat_id and caption.
 */
export async function tgSendMultipart(
  method: "sendPhoto" | "sendDocument",
  fileField: "photo" | "document",
  file: { bytes: Uint8Array; filename: string; mime: string },
  fields: Record<string, string | number>,
) {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  const TG = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");
  if (!TG) throw new Error("TELEGRAM_API_KEY missing");

  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  const buf = file.bytes.buffer.slice(
    file.bytes.byteOffset,
    file.bytes.byteOffset + file.bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buf], { type: file.mime || "application/octet-stream" });
  form.append(fileField, blob, file.filename || "upload");

  const startedAt = Date.now();
  const r = await fetch(`${TG_GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": TG,
    },
    body: form,
  });
  const j: any = await r.json().catch(() => ({}));
  const ms = Date.now() - startedAt;
  const ctx = { method, ms, status: r.status };
  if (!r.ok || j?.ok === false) {
    const description = String(j?.description ?? `http ${r.status}`);
    logError("tg.upload", { ...ctx, reason: "telegram_error", description });
    throw new Error(`Telegram ${method} failed [${r.status}]: ${j?.description ?? JSON.stringify(j)}`);
  }
  logInfo("tg.upload", ctx);
  return j.result;
}

/**
 * DM the boss chat that a Telegram delivery failed. Throttled per
 * `${method}:${status}:${shortDescription}` so a sustained outage produces
 * one alert per cooldown window instead of one per failed call. Uses
 * `silent: true` internally so a failing alert never recursively alerts.
 */
async function alertBossDeliveryFailure(args: {
  method: string;
  status: number;
  description: string;
  chatId: number | string | undefined;
}) {
  const { method, status, description, chatId } = args;
  const bossChat = getBossChatId();
  if (!bossChat) {
    logWarn("tg.alert", { reason: "no_boss_chat_configured" });
    return;
  }
  // Don't alert about failures to the boss chat itself — that loops noisily.
  if (chatId !== undefined && String(chatId) === String(bossChat)) return;

  const key = `${method}:${status}:${description.slice(0, 60)}`;
  if (!shouldAlert(key)) {
    logInfo("tg.alert", { reason: "throttled", key });
    return;
  }

  const safeDesc = description
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 500);
  const target = chatId !== undefined ? `…${shortenChatId(chatId)}` : "—";
  const text =
    `🚨 <b>Telegram delivery failed</b>\n` +
    `Method: <code>${method}</code>\n` +
    `Status: <code>${status}</code>\n` +
    `Target: <code>${target}</code>\n` +
    `Reason: ${safeDesc}\n` +
    `<i>Further alerts for this error are throttled for ${
      ALERT_COOLDOWN_MS / 60000
    }m.</i>`;

  try {
    await tgCall(
      "sendMessage",
      {
        chat_id: bossChat,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      },
      { silent: true, tag: "tg.alert" },
    );
  } catch (e) {
    logError("tg.alert", {
      reason: "alert_send_failed",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function deriveTelegramWebhookSecret(apiKey: string): string {
  // Stable secret derived from the Lovable connection key, matches the
  // one we register with Telegram via setWebhook.
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(`telegram-webhook:${apiKey}`).digest("base64url");
}
