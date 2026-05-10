const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

export async function tgCall(method: string, body: Record<string, unknown>) {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  const TG = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");
  if (!TG) throw new Error("TELEGRAM_API_KEY missing");
  const r = await fetch(`${TG_GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": TG,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(`Telegram ${method} failed [${r.status}]: ${j?.description ?? JSON.stringify(j)}`);
  }
  return j.result;
}

export async function tgSendMessage(chatId: number | string, text: string) {
  return tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export function deriveTelegramWebhookSecret(apiKey: string): string {
  // Stable secret derived from the Lovable connection key, matches the
  // one we register with Telegram via setWebhook.
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(`telegram-webhook:${apiKey}`).digest("base64url");
}