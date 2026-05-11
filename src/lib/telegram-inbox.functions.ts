import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tgSendMessage } from "@/lib/telegram-bot.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

export type TgChatSummary = {
  chat_id: number;
  chat_type: string | null;
  chat_title: string | null;
  last_text: string | null;
  last_from: string | null;
  last_date: string;
  message_count: number;
};

export type TgMessage = {
  update_id: number;
  chat_id: number;
  from_username: string | null;
  from_name: string | null;
  text: string | null;
  message_date: string;
};

/** List the most recent chat per chat_id, newest first. Admin-only. */
export const listTelegramChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertAdmin(supabase, userId);

    // Pull a generous window then collapse to one row per chat client-side.
    const { data, error } = await supabase
      .from("telegram_messages")
      .select(
        "update_id, chat_id, chat_type, chat_title, from_username, from_name, text, message_date",
      )
      .order("message_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const byChat = new Map<number, TgChatSummary>();
    for (const row of (data ?? []) as any[]) {
      const existing = byChat.get(row.chat_id);
      if (existing) {
        existing.message_count += 1;
        continue;
      }
      byChat.set(row.chat_id, {
        chat_id: row.chat_id,
        chat_type: row.chat_type,
        chat_title: row.chat_title,
        last_text: row.text,
        last_from: row.from_name || row.from_username || null,
        last_date: row.message_date,
        message_count: 1,
      });
    }
    const chats = [...byChat.values()].sort(
      (a, b) => +new Date(b.last_date) - +new Date(a.last_date),
    );
    return { chats };
  });

/** List messages for one chat, oldest first. Admin-only. */
export const listTelegramMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chatId: number; limit?: number }) =>
    z
      .object({
        chatId: z.number().int(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertAdmin(supabase, userId);

    const { data: rows, error } = await supabase
      .from("telegram_messages")
      .select(
        "update_id, chat_id, from_username, from_name, text, message_date",
      )
      .eq("chat_id", data.chatId)
      .order("message_date", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);

    const messages = ((rows ?? []) as any[]).reverse() as TgMessage[];
    return { messages };
  });

/** Send a reply from the bot into a chat. Admin-only. */
export const sendTelegramReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chatId: number; text: string }) =>
    z
      .object({
        chatId: z.number().int(),
        text: z.string().min(1).max(4096),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertAdmin(supabase, userId);
    const result = await tgSendMessage(data.chatId, data.text);
    return { ok: true, message_id: (result as any)?.message_id ?? null };
  });