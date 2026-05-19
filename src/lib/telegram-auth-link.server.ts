import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { logWarn } from "./server-log.server";

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _admin;
}

/**
 * Append an event to `telegram_auth_audit`. Best-effort: never throws,
 * so a logging hiccup can't break the auth flow.
 */
export async function logTelegramAuthEvent(event: {
  event:
    | "issued"
    | "exchanged"
    | "rejected_missing"
    | "rejected_not_found"
    | "rejected_already_used"
    | "rejected_expired"
    | "rejected_no_email"
    | "rejected_generate_link_failed"
    | "rejected_exception";
  user_id?: string | null;
  chat_id?: number | null;
  dest_path?: string | null;
  token_prefix?: string | null;
  reason?: string | null;
  ip?: string | null;
  user_agent?: string | null;
}) {
  try {
    await (admin().from("telegram_auth_audit") as any).insert({
      event: event.event,
      user_id: event.user_id ?? null,
      chat_id: event.chat_id ?? null,
      dest_path: event.dest_path ?? null,
      token_prefix: event.token_prefix ?? null,
      reason: event.reason ? String(event.reason).slice(0, 500) : null,
      ip: event.ip ?? null,
      user_agent: event.user_agent ? String(event.user_agent).slice(0, 500) : null,
    });
  } catch (e) {
    logWarn("tg.auth.audit_insert_failed", {
      event: event.event,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function siteBase(): string {
  return (process.env.PUBLIC_SITE_URL || "https://ogstreamz.co.uk").replace(/\/$/, "");
}

/**
 * Only allow internal app paths as deep-link destinations so the magic-auth
 * exchange can't be turned into an open redirect.
 */
function safeDestPath(dest: string): string {
  if (!dest || typeof dest !== "string") return "/";
  if (!dest.startsWith("/")) return "/";
  if (dest.startsWith("//")) return "/";
  return dest.slice(0, 512);
}

/**
 * Mint a single-use Telegram → website sign-in URL for `userId` that lands
 * the user on `destPath` already authenticated. Tokens expire in 10 minutes
 * and are burned on first use.
 */
export async function mintTelegramAuthUrl(
  userId: string,
  destPath: string,
  opts: { chatId?: number; ttlSeconds?: number } = {},
): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const ttl = Math.max(60, Math.min(opts.ttlSeconds ?? 600, 60 * 60));
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const dest = safeDestPath(destPath);
  const { error } = await (admin().from("telegram_auth_tokens") as any).insert({
    token,
    user_id: userId,
    dest_path: dest,
    chat_id: opts.chatId ?? null,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`telegram_auth_token insert failed: ${error.message}`);
  await logTelegramAuthEvent({
    event: "issued",
    user_id: userId,
    chat_id: opts.chatId ?? null,
    dest_path: dest,
    token_prefix: token.slice(0, 8),
  });
  return `${siteBase()}/api/public/telegram/auth?t=${encodeURIComponent(token)}`;
}
