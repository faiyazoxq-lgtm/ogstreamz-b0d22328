import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeEmail, shouldPromoteToBoss } from "./boss-policy";
import { tgSendMessage } from "./telegram-bot.server";

/**
 * Parse a user-agent string into a coarse device + OS + browser label.
 * Pure string heuristics — no third-party UA parser to keep the Worker
 * bundle small. Good enough for "iPhone · iOS · Safari" style summaries.
 */
function classifyUserAgent(ua: string): {
  device: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  os: string;
  browser: string;
} {
  const u = ua.toLowerCase();
  const isBot = /bot|crawler|spider|headless|preview|monitor/.test(u);
  if (isBot) return { device: "bot", os: "—", browser: ua.slice(0, 40) };

  const isTablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(u);
  const isMobile = !isTablet && /mobi|iphone|ipod|android|blackberry|opera mini|windows phone/.test(u);
  const device = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let os = "Unknown";
  if (/windows nt/.test(u)) os = "Windows";
  else if (/mac os x|macintosh/.test(u)) os = /iphone|ipad|ipod/.test(u) ? "iOS" : "macOS";
  else if (/iphone|ipad|ipod/.test(u)) os = "iOS";
  else if (/android/.test(u)) os = "Android";
  else if (/cros/.test(u)) os = "ChromeOS";
  else if (/linux/.test(u)) os = "Linux";

  let browser = "Browser";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/opr\/|opera/.test(u)) browser = "Opera";
  else if (/chrome\//.test(u) && !/edg\//.test(u)) browser = "Chrome";
  else if (/firefox\//.test(u)) browser = "Firefox";
  else if (/safari\//.test(u) && !/chrome\//.test(u)) browser = "Safari";

  return { device, os, browser };
}

/**
 * Best-effort IP → country lookup. Cloudflare Workers expose the country in
 * the `CF-IPCountry` request header for free. If absent (local dev, other
 * runtimes) we fall back to a single ipapi.co call. Never throws.
 */
async function lookupCountry(ip: string | null): Promise<{ country: string; flag: string }> {
  const cf = (getRequestHeader("cf-ipcountry") || "").toString().toUpperCase();
  let cc = cf && cf !== "XX" && cf !== "T1" ? cf : "";

  if (!cc && ip) {
    try {
      const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
        signal: AbortSignal.timeout(3000),
      });
      const txt = (await r.text()).trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(txt)) cc = txt;
    } catch {
      /* silent — geo is best-effort */
    }
  }

  if (!/^[A-Z]{2}$/.test(cc)) return { country: "Unknown", flag: "🏳️" };
  // Convert ISO-3166-1 alpha-2 to a regional indicator flag emoji.
  const flag = String.fromCodePoint(
    ...cc.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
  return { country: cc, flag };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Auto-fires after the boss signs in: verifies the caller is the configured
 * BOSS_EMAIL, then DMs the boss's Telegram chat (BOSS_TELEGRAM_API_KEY) with
 * device type + IP country of the new session. No-ops silently for any
 * non-boss caller so it's safe to invoke on every sign-in.
 */
export const notifyBossLoginIfNeeded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as { userAgent?: string; timezone?: string };
    return {
      userAgent: String(d.userAgent || "").slice(0, 500),
      timezone: String(d.timezone || "").slice(0, 60),
    };
  })
  .handler(async ({ data, context }) => {
    const userEmail = normalizeEmail(context.claims?.email as string | undefined);
    const bossEmail = normalizeEmail(process.env.BOSS_EMAIL);
    if (!shouldPromoteToBoss(userEmail, bossEmail)) {
      return { notified: false, reason: "not_boss" };
    }

    const chatId = process.env.BOSS_TELEGRAM_API_KEY;
    if (!chatId) return { notified: false, reason: "no_chat_id" };

    const ua =
      data.userAgent || (getRequestHeader("user-agent") || "").toString();
    const ip = getRequestIP({ xForwardedFor: true }) || null;
    const { device, os, browser } = classifyUserAgent(ua);
    const { country, flag } = await lookupCountry(ip);

    const when = new Date().toISOString().replace("T", " ").slice(0, 19);
    const text =
      `🛡️ <b>Boss session opened</b>\n` +
      `👤 <code>${escapeHtml(userEmail)}</code>\n` +
      `📱 ${escapeHtml(device)} · ${escapeHtml(os)} · ${escapeHtml(browser)}\n` +
      `🌍 ${flag} ${escapeHtml(country)}` +
      (ip ? ` · <code>${escapeHtml(ip)}</code>` : "") +
      (data.timezone ? ` · ${escapeHtml(data.timezone)}` : "") +
      `\n🕒 <code>${when} UTC</code>`;

    try {
      await tgSendMessage(chatId, text);
      return { notified: true, device, country };
    } catch (e) {
      console.error("[boss-login-notify] tgSendMessage failed", e);
      return { notified: false, reason: "telegram_failed" };
    }
  });