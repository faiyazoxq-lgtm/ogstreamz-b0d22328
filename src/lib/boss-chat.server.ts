/**
 * Returns the boss Telegram chat ID for the current environment.
 *
 *   - Production build (`NODE_ENV === 'production'`)  → BOSS_TELEGRAM_CHAT_ID
 *   - Anything else (dev / preview)                   → BOSS_TELEGRAM_CHAT_ID_TEST
 *
 * Override the auto-detection by setting `TELEGRAM_ENV`:
 *   - `TELEGRAM_ENV=prod` (or `production` / `live`) → force production chat
 *   - `TELEGRAM_ENV=test` (or `dev` / `staging`)     → force test chat
 *
 * Falls back to the other key if the selected one is unset, so a partially
 * configured environment still notifies somewhere instead of silently
 * dropping every message.
 */
export function getBossChatId(): string | undefined {
  const prodKey = process.env.BOSS_TELEGRAM_CHAT_ID;
  const testKey = process.env.BOSS_TELEGRAM_CHAT_ID_TEST;

  const override = (process.env.TELEGRAM_ENV || "").toLowerCase();
  if (override === "prod" || override === "production" || override === "live") {
    return prodKey || testKey;
  }
  if (override === "test" || override === "dev" || override === "staging") {
    return testKey || prodKey;
  }

  const isProd = process.env.NODE_ENV === "production";
  return isProd ? (prodKey || testKey) : (testKey || prodKey);
}

/** Same as {@link getBossChatId} but throws when no chat ID is configured. */
export function requireBossChatId(): string {
  const id = getBossChatId();
  if (!id) {
    throw new Error(
      "Boss Telegram chat ID missing — set BOSS_TELEGRAM_CHAT_ID (prod) or BOSS_TELEGRAM_CHAT_ID_TEST (test).",
    );
  }
  return id;
}