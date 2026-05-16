/**
 * Boss-chat notification helpers.
 *
 * Thin wrappers around tgSendMessage + getBossChatId for use from server
 * functions (login alerts, payment webhooks, system events). All calls are
 * fire-and-forget and log errors rather than throwing.
 */
import { tgSendMessage } from "./telegram-bot.server";
import { getBossChatId } from "./boss-chat.server";
import { logError, logWarn } from "./server-log.server";

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyBoss(htmlMessage: string): Promise<void> {
  const chat = getBossChatId();
  if (!chat) {
    logWarn("boss-notify.no_chat", {});
    return;
  }
  try {
    await tgSendMessage(chat, htmlMessage);
  } catch (e) {
    logError("boss-notify.send_failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

export async function sendBossLoginAlert(opts: {
  email: string;
  device: string;
  browser: string;
  ipCountry: string;
  isNewDevice: boolean;
  isOddHour: boolean;
}): Promise<void> {
  const flags: string[] = [];
  if (opts.isNewDevice) flags.push("🆕 New device");
  if (opts.isOddHour) flags.push("🌙 Odd hour (2–5am UTC)");
  const severity = flags.length > 0 ? "⚠️" : "✅";
  await notifyBoss(
    `${severity} <b>Boss Sign-In</b>\n\n` +
      `<b>Account:</b> ${escapeHtml(opts.email)}\n` +
      `<b>Device:</b> ${escapeHtml(opts.device)}\n` +
      `<b>Browser:</b> ${escapeHtml(opts.browser)}\n` +
      `<b>Country:</b> ${escapeHtml(opts.ipCountry)}` +
      (flags.length ? `\n\n<b>Flags:</b> ${escapeHtml(flags.join(" · "))}` : ""),
  );
}

type CreditEvent = "topup" | "vip_activated" | "purchase" | "gift" | "low_balance";

export async function sendCreditAlert(opts: {
  event: CreditEvent;
  email: string;
  amount?: number;
  details?: string;
}): Promise<void> {
  const icons: Record<CreditEvent, string> = {
    topup: "💰",
    vip_activated: "⭐",
    purchase: "🪙",
    gift: "🎁",
    low_balance: "⚠️",
  };
  const labels: Record<CreditEvent, string> = {
    topup: "Top-up completed",
    vip_activated: "VIP activated",
    purchase: "Credit purchase",
    gift: "Boss gift sent",
    low_balance: "Low balance alert",
  };
  await notifyBoss(
    `${icons[opts.event]} <b>${labels[opts.event]}</b>\n\n` +
      `<b>Account:</b> ${escapeHtml(opts.email)}\n` +
      (opts.amount !== undefined ? `<b>Amount:</b> ${Number(opts.amount).toLocaleString()} 🪙\n` : "") +
      (opts.details ? `<b>Details:</b> ${escapeHtml(opts.details)}` : ""),
  );
}

export async function sendSystemAlert(opts: {
  category: string;
  message: string;
  severity?: "info" | "warn" | "error";
}): Promise<void> {
  const icon =
    opts.severity === "error" ? "🚨" : opts.severity === "warn" ? "⚠️" : "ℹ️";
  await notifyBoss(
    `${icon} <b>System Alert · ${escapeHtml(opts.category)}</b>\n\n${escapeHtml(opts.message)}`,
  );
}
