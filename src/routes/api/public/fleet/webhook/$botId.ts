import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function tg(token: string, method: string, body: any) {
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export const Route = createFileRoute("/api/public/fleet/webhook/$botId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const botId = params.botId;
        const provided = request.headers.get("x-telegram-bot-api-secret-token") || "";
        const admin = adminClient();
        const { data: bot } = await admin
          .from("bot_factory")
          .select("id, telegram_bot_token, webhook_secret, pair_label, tier, channel_chat_id")
          .eq("id", botId)
          .maybeSingle();
        if (!bot) return new Response("Not found", { status: 404 });
        if (provided !== bot.webhook_secret) return new Response("Unauthorized", { status: 401 });

        const update: any = await request.json().catch(() => ({}));
        const msg = update.message || update.edited_message || update.channel_post;
        const chatId = msg?.chat?.id;
        const text: string = (msg?.text || "").trim();

        if (chatId && text) {
          // Tiny built-in command surface — extend later
          if (/^\/start/i.test(text)) {
            await tg(bot.telegram_bot_token, "sendMessage", {
              chat_id: chatId,
              text:
                `🛰️ <b>0G · ${escape(bot.pair_label)}</b>\n` +
                `Bot online. Tier: <b>${bot.tier}</b>.\n` +
                `Use /status to ping.`,
              parse_mode: "HTML",
            });
          } else if (/^\/status/i.test(text)) {
            await tg(bot.telegram_bot_token, "sendMessage", {
              chat_id: chatId,
              text: `✅ ${escape(bot.pair_label)} · ${bot.tier}`,
              parse_mode: "HTML",
            });
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});

function escape(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}