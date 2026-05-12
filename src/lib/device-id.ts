/**
 * Stable per-browser device identifier used for new-device detection.
 * - First call generates a random UUID and stores it in localStorage.
 * - Returned as a SHA-256 hex hash so the raw id never leaves the browser.
 * - Falls back to a hash of UA+timezone if localStorage is unavailable.
 */
const KEY = "ogs:device-id";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getDeviceHash(): Promise<string> {
  let raw = "";
  try {
    raw = localStorage.getItem(KEY) ?? "";
    if (!raw) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      raw = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      localStorage.setItem(KEY, raw);
    }
  } catch {
    raw = `${navigator.userAgent}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  }
  return sha256Hex(raw);
}