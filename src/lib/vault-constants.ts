/**
 * Shared vault constants. Keep values here so client, server, and tests
 * all agree on the same freshness window.
 */

/** Re-auth freshness window for vault credential reveals: 12 hours. */
export const VAULT_REAUTH_WINDOW_MS = 12 * 60 * 60 * 1000;