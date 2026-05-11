import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { tgSendMessage, deriveTelegramWebhookSecret } from "@/lib/telegram-bot.server";

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

async function handleCommand(text: string, chatId: number, username: string) {
  const trimmed = text.trim();
  // /start CODE   /link CODE   /start  (no arg)
  const m = trimmed.match(/^\/(start|link)(?:@\w+)?(?:\s+(\S+))?/i);
  if (!m) {
    if (/^\/help/i.test(trimmed)) {
      await tgSendMessage(
        chatId,
        "Send <code>/link YOURCODE</code> to bind this Telegram to your OG-Streamz account.\nGenerate a code at /account/passes."
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
          await handleCommand(text, chatId, username);
        } catch (e) {
          console.error("telegram webhook handler error", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});