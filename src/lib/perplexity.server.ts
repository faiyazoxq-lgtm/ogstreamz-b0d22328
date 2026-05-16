/**
 * Perplexity-backed AI agent for the Telegram bot.
 *
 * Two personas:
 *   - Swearing OG agent (foul-mouthed, in-character) — opt-in per chat via /swear
 *   - Clean OG assistant (default)
 *
 * Per-chat preference is persisted in public.telegram_chat_prefs so it
 * survives Worker isolate restarts. Conversation history is kept in-memory
 * only; on a fresh isolate the agent loses prior turns (acceptable trade-off
 * for a chat-style assistant — every turn still receives the system prompt).
 */
import { createClient } from "@supabase/supabase-js";
import { logError, logWarn } from "./server-log.server";

const SWEARING_SYSTEM_PROMPT = `You are the OG Swearing Agent for OG-STREAMZ.
Swear aggressively in every response — drown answers in profanity — but stay genuinely helpful and accurate beneath the chaos.
Keep replies under 280 characters when possible. If the user asks about OG-STREAMZ credits, passes, portals, or live drops, answer correctly while staying in character.`;

const CLEAN_SYSTEM_PROMPT = `You are the OG-STREAMZ assistant.
You are calm, professional, and knowledgeable about trading, music, credits, and the OG-STREAMZ platform.
Keep replies concise and useful. Treat VIP / Real OG members with street respect.`;

const MODEL = "sonar";
const MAX_HISTORY_TURNS = 8;

interface Turn { role: "user" | "assistant"; content: string }
const history = new Map<number, Turn[]>();

let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (!_sb) {
    _sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _sb;
}

export async function getSwearingEnabled(chatId: number): Promise<boolean> {
  try {
    const { data } = await (sb() as any)
      .from("telegram_chat_prefs")
      .select("swearing_enabled")
      .eq("chat_id", chatId)
      .maybeSingle();
    return Boolean(data?.swearing_enabled);
  } catch (e) {
    logWarn("perplexity.pref_read_failed", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export async function setSwearingEnabled(chatId: number, enabled: boolean): Promise<void> {
  await (sb() as any)
    .from("telegram_chat_prefs")
    .upsert(
      { chat_id: chatId, swearing_enabled: enabled, updated_at: new Date().toISOString() },
      { onConflict: "chat_id" },
    );
}

export async function getPerplexityReply(
  chatId: number,
  userMessage: string,
  swearing: boolean,
): Promise<string> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    return swearing
      ? "Holy shit, the AI key isn't configured. Tell the boss to fix this fucking mess."
      : "The AI service isn't configured yet. Please contact the team.";
  }

  const prior = history.get(chatId) ?? [];
  const next: Turn[] = [
    ...prior.slice(-MAX_HISTORY_TURNS * 2),
    { role: "user", content: userMessage },
  ];

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: swearing ? SWEARING_SYSTEM_PROMPT : CLEAN_SYSTEM_PROMPT },
          ...next,
        ],
        max_tokens: 400,
        temperature: swearing ? 0.9 : 0.6,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logError("perplexity.http_error", { status: res.status, body: body.slice(0, 300) });
      return swearing
        ? "Perplexity's being a piece of shit right now. Try again in a sec."
        : "The AI service returned an error. Please try again shortly.";
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (reply) {
      history.set(chatId, [...next, { role: "assistant", content: reply }]);
      return reply;
    }
    return swearing ? "Got fuck all back. Try asking differently." : "No response. Try again.";
  } catch (e) {
    logError("perplexity.fetch_failed", { error: e instanceof Error ? e.message : String(e) });
    return swearing
      ? "Something's fucked on the AI side. Try again later."
      : "AI service unavailable. Please try again.";
  }
}
