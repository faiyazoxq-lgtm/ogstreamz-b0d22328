import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tgCall, tgSendMessage } from "./telegram-bot.server";
import { getBossChatId } from "./boss-chat.server";

/**
 * Boss-only Telegram bot health check.
 *
 * Verifies, in order:
 *   1. `getMe`             — bot token + connector auth are valid.
 *   2. `getWebhookInfo`    — webhook URL is registered, no last_error,
 *                            pending_update_count is sane.
 *   3. telegram_messages   — most recent update timestamp (proves inbound
 *                            traffic is reaching our handler).
 *   4. sendMessage         — a fresh test ping is delivered to the boss
 *                            chat (proves outbound delivery works).
 *
 * Returns a structured report instead of throwing on individual failures
 * so the UI can render a per-check status.
 */
type CheckResult =
  | { ok: true; detail?: Record<string, unknown> }
  | { ok: false; error: string; detail?: Record<string, unknown> };

function fail(error: unknown, detail?: Record<string, unknown>): CheckResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    ...(detail ? { detail } : {}),
  };
}

export const bossBotHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .handler(async () => {
    const startedAt = Date.now();

    // 1. getMe
    let getMe: CheckResult;
    let botUsername: string | null = null;
    try {
      const me = (await tgCall("getMe", {}, { tag: "tg.health.getMe", silent: true })) as {
        id: number;
        username?: string;
        first_name?: string;
        can_read_all_group_messages?: boolean;
      };
      botUsername = me?.username ?? null;
      getMe = {
        ok: true,
        detail: {
          id: me?.id,
          username: me?.username ?? null,
          first_name: me?.first_name ?? null,
        },
      };
    } catch (e) {
      getMe = fail(e);
    }

    // 2. getWebhookInfo
    let webhook: CheckResult;
    try {
      const info = (await tgCall(
        "getWebhookInfo",
        {},
        { tag: "tg.health.getWebhookInfo", silent: true },
      )) as {
        url?: string;
        pending_update_count?: number;
        last_error_date?: number;
        last_error_message?: string;
        last_synchronization_error_date?: number;
        max_connections?: number;
        ip_address?: string;
      };
      const hasUrl = Boolean(info?.url);
      const lastErrorAgeSec = info?.last_error_date
        ? Math.max(0, Math.floor(Date.now() / 1000) - info.last_error_date)
        : null;
      const detail = {
        url: info?.url ?? null,
        pending_update_count: info?.pending_update_count ?? 0,
        last_error_message: info?.last_error_message ?? null,
        last_error_age_sec: lastErrorAgeSec,
        ip_address: info?.ip_address ?? null,
        max_connections: info?.max_connections ?? null,
      };
      if (!hasUrl) {
        webhook = { ok: false, error: "Webhook URL is not registered", detail };
      } else if (info?.last_error_message && (lastErrorAgeSec ?? Infinity) < 600) {
        webhook = {
          ok: false,
          error: `Recent webhook delivery error: ${info.last_error_message}`,
          detail,
        };
      } else {
        webhook = { ok: true, detail };
      }
    } catch (e) {
      webhook = fail(e);
    }

    // 3. Last inbound update (telegram_messages.created_at)
    let inbound: CheckResult;
    try {
      const { data, error } = await supabaseAdmin
        .from("telegram_messages")
        .select("update_id, chat_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        inbound = {
          ok: false,
          error:
            "No inbound updates ever recorded — send /start to the bot to confirm webhook delivery.",
        };
      } else {
        const ageSec = Math.max(
          0,
          Math.floor((Date.now() - new Date(data.created_at as string).getTime()) / 1000),
        );
        inbound = {
          ok: true,
          detail: {
            last_update_id: data.update_id,
            last_chat_id_suffix: String(data.chat_id).slice(-6),
            last_received_at: data.created_at,
            age_seconds: ageSec,
          },
        };
      }
    } catch (e) {
      inbound = fail(e);
    }

    // 4. Outbound test message to the boss chat
    let outbound: CheckResult;
    const bossChatId = getBossChatId();
    if (!bossChatId) {
      outbound = {
        ok: false,
        error:
          "Boss chat ID not configured (BOSS_TELEGRAM_CHAT_ID / BOSS_TELEGRAM_CHAT_ID_TEST).",
      };
    } else {
      try {
        const stamp = new Date().toISOString();
        const sent = (await tgSendMessage(
          bossChatId,
          `🩺 <b>Bot health check</b>\n` +
            `Bot: <code>@${botUsername ?? "unknown"}</code>\n` +
            `Time: <code>${stamp}</code>\n` +
            `Triggered from the boss admin panel.`,
        )) as { message_id?: number } | undefined;
        outbound = {
          ok: true,
          detail: {
            chat_id_suffix: String(bossChatId).slice(-6),
            message_id: sent?.message_id ?? null,
            sent_at: stamp,
          },
        };
      } catch (e) {
        outbound = fail(e);
      }
    }

    const checks = { getMe, webhook, inbound, outbound };
    const healthy = Object.values(checks).every((c) => c.ok);

    return {
      healthy,
      checked_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      checks,
    };
  });