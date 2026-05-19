import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

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
  const { error } = await admin().from("telegram_auth_tokens").insert({
    token,
    user_id: userId,
    dest_path: dest,
    chat_id: opts.chatId ?? null,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`telegram_auth_token insert failed: ${error.message}`);
  return `${siteBase()}/api/public/telegram/auth?t=${encodeURIComponent(token)}`;
}
