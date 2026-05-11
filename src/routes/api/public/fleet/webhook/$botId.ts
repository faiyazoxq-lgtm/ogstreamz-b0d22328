import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

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
          .select("id, pair_label, tier, channel_chat_id")
          .eq("id", botId)
          .maybeSingle();
        if (!bot) return new Response("Not found", { status: 404 });

        // Decrypt webhook secret + token via service-role-only RPCs.
        const { data: secret } = await admin.rpc("bot_factory_reveal_secret", { p_id: botId });
        if (typeof secret !== "string" || !secret || !safeEqual(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { data: token } = await admin.rpc("bot_factory_reveal_token", { p_id: botId });
        const botToken = typeof token === "string" ? token : "";

        const update: any = await request.json().catch(() => ({}));
        const msg = update.message || update.edited_message || update.channel_post;
        const chatId = msg?.chat?.id;
        const text: string = (msg?.text || "").trim();

        if (chatId && text && botToken) {
          // Tiny built-in command surface — extend later
          if (/^\/start/i.test(text)) {
            await tg(botToken, "sendMessage", {
              chat_id: chatId,
              text:
                `🛰️ <b>0G · ${escape(bot.pair_label)}</b>\n` +
                `Bot online. Tier: <b>${bot.tier}</b>.\n` +
                `Use /status to ping.`,
              parse_mode: "HTML",
            });
          } else if (/^\/status/i.test(text)) {
            await tg(botToken, "sendMessage", {
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