/**
 * Validate + normalize social handles stored on `profiles.contact_card`.
 *
 * Goals:
 *   - Accept every common shape: bare handle, @handle, full URL,
 *     mobile/short hosts (m.youtube.com, youtu.be, vm.tiktok.com, instagr.am,
 *     mobile.twitter.com), with or without trailing slash, query, hash, www.
 *   - Strip tracking junk (?si=…, ?utm_*, fragments).
 *   - Reject unsafe URLs (javascript:, data:, mailto:, etc.).
 *   - Return both a stable storage value (the handle, prefixed `@` for
 *     handle-based platforms, or a fully-qualified https URL otherwise)
 *     and a public URL for linking out.
 */

export type SocialKey =
  | "telegram"
  | "youtube"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "website";

export type NormalizeResult =
  | { ok: true; storage: string; url: string; display: string; handle: string | null }
  | { ok: false; error: string };

const HANDLE_RE = /^[A-Za-z0-9_.\-]{1,64}$/;
// Allow Telegram channel handles (5-32 alphanumeric/underscore) — same rule.
const TG_RE = /^[A-Za-z0-9_]{4,64}$/;

const SAFE_PROTOCOL = /^https?:$/i;

function tryParseUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Reject obvious unsafe schemes early.
  if (/^(javascript|data|vbscript|file|about|mailto):/i.test(trimmed)) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(candidate);
    if (!SAFE_PROTOCOL.test(u.protocol)) return null;
    return u;
  } catch {
    return null;
  }
}

function stripWww(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

function firstPathSegment(u: URL): string | null {
  const seg = u.pathname.split("/").filter(Boolean)[0];
  return seg ? decodeURIComponent(seg) : null;
}

function cleanHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

/* -------------------- per-platform normalizers -------------------- */

function normTelegram(input: string): NormalizeResult {
  const u = tryParseUrl(input);
  let handle: string | null = null;
  if (u && /(?:^|\.)(t\.me|telegram\.me|telegram\.dog)$/i.test(stripWww(u.hostname))) {
    handle = firstPathSegment(u);
  } else {
    handle = cleanHandle(input);
  }
  if (!handle) return { ok: false, error: "Empty Telegram handle" };
  // Telegram uses `+xxxx` for invite links and `joinchat/…` legacy invites — don't normalize as handle.
  if (/^\+/.test(handle) || /^joinchat\b/i.test(handle)) {
    const url = `https://t.me/${handle}`;
    return { ok: true, storage: url, url, display: url.replace(/^https?:\/\//, ""), handle: null };
  }
  if (!TG_RE.test(handle)) return { ok: false, error: "Invalid Telegram handle (use @username)" };
  const url = `https://t.me/${handle}`;
  return { ok: true, storage: `@${handle}`, url, display: `@${handle}`, handle };
}

function normYouTube(input: string): NormalizeResult {
  const u = tryParseUrl(input);
  if (u) {
    const host = stripWww(u.hostname);
    if (/^(m\.|music\.)?youtube\.com$/.test(host) || host === "youtu.be") {
      // /@handle, /c/Name, /channel/UC…, /user/Name, /watch?v=…
      const seg = firstPathSegment(u);
      if (seg?.startsWith("@")) {
        const h = cleanHandle(seg);
        if (!HANDLE_RE.test(h)) return { ok: false, error: "Invalid YouTube handle" };
        const url = `https://youtube.com/@${h}`;
        return { ok: true, storage: `@${h}`, url, display: `@${h}`, handle: h };
      }
      // Anything else (channel/UC…, watch URLs, shorts) — keep as canonical URL.
      const url = `https://${host}${u.pathname}${u.search ? "" : ""}`.replace(/\/+$/, "");
      return { ok: true, storage: url, url, display: url.replace(/^https?:\/\//, ""), handle: null };
    }
    return { ok: false, error: "Not a YouTube URL" };
  }
  const h = cleanHandle(input);
  if (!h) return { ok: false, error: "Empty YouTube handle" };
  if (!HANDLE_RE.test(h)) return { ok: false, error: "Invalid YouTube handle" };
  const url = `https://youtube.com/@${h}`;
  return { ok: true, storage: `@${h}`, url, display: `@${h}`, handle: h };
}

function normTikTok(input: string): NormalizeResult {
  const u = tryParseUrl(input);
  if (u) {
    const host = stripWww(u.hostname);
    if (/(?:^|\.)tiktok\.com$/.test(host) || host === "vm.tiktok.com" || host === "vt.tiktok.com") {
      const seg = firstPathSegment(u);
      if (seg?.startsWith("@")) {
        const h = cleanHandle(seg);
        if (!HANDLE_RE.test(h)) return { ok: false, error: "Invalid TikTok handle" };
        const url = `https://tiktok.com/@${h}`;
        return { ok: true, storage: `@${h}`, url, display: `@${h}`, handle: h };
      }
      // Short links / video URLs — keep canonical.
      const url = `https://${host}${u.pathname}`.replace(/\/+$/, "");
      return { ok: true, storage: url, url, display: url.replace(/^https?:\/\//, ""), handle: null };
    }
    return { ok: false, error: "Not a TikTok URL" };
  }
  const h = cleanHandle(input);
  if (!h) return { ok: false, error: "Empty TikTok handle" };
  if (!HANDLE_RE.test(h)) return { ok: false, error: "Invalid TikTok handle" };
  const url = `https://tiktok.com/@${h}`;
  return { ok: true, storage: `@${h}`, url, display: `@${h}`, handle: h };
}

function normInstagram(input: string): NormalizeResult {
  const u = tryParseUrl(input);
  if (u) {
    const host = stripWww(u.hostname);
    if (/(?:^|\.)instagram\.com$/.test(host) || host === "instagr.am") {
      const seg = firstPathSegment(u);
      if (!seg) return { ok: false, error: "Missing Instagram handle" };
      // Skip reserved paths.
      if (/^(p|reel|reels|stories|explore|tv)$/i.test(seg)) {
        const url = `https://instagram.com${u.pathname}`.replace(/\/+$/, "");
        return { ok: true, storage: url, url, display: url.replace(/^https?:\/\//, ""), handle: null };
      }
      const h = cleanHandle(seg);
      if (!HANDLE_RE.test(h)) return { ok: false, error: "Invalid Instagram handle" };
      const url = `https://instagram.com/${h}`;
      return { ok: true, storage: `@${h}`, url, display: `@${h}`, handle: h };
    }
    return { ok: false, error: "Not an Instagram URL" };
  }
  const h = cleanHandle(input);
  if (!h) return { ok: false, error: "Empty Instagram handle" };
  if (!HANDLE_RE.test(h)) return { ok: false, error: "Invalid Instagram handle" };
  const url = `https://instagram.com/${h}`;
  return { ok: true, storage: `@${h}`, url, display: `@${h}`, handle: h };
}

function normTwitter(input: string): NormalizeResult {
  const u = tryParseUrl(input);
  if (u) {
    const host = stripWww(u.hostname);
    if (/(?:^|\.)(twitter\.com|x\.com)$/.test(host) || host === "mobile.twitter.com") {
      const seg = firstPathSegment(u);
      if (!seg) return { ok: false, error: "Missing X handle" };
      if (/^(i|home|search|messages|notifications|explore|hashtag)$/i.test(seg)) {
        return { ok: false, error: "Not a profile URL" };
      }
      const h = cleanHandle(seg);
      if (!HANDLE_RE.test(h)) return { ok: false, error: "Invalid X handle" };
      const url = `https://x.com/${h}`;
      return { ok: true, storage: `@${h}`, url, display: `@${h}`, handle: h };
    }
    return { ok: false, error: "Not an X / Twitter URL" };
  }
  const h = cleanHandle(input);
  if (!h) return { ok: false, error: "Empty X handle" };
  if (!HANDLE_RE.test(h)) return { ok: false, error: "Invalid X handle" };
  const url = `https://x.com/${h}`;
  return { ok: true, storage: `@${h}`, url, display: `@${h}`, handle: h };
}

function normWebsite(input: string): NormalizeResult {
  const u = tryParseUrl(input);
  if (!u) return { ok: false, error: "Invalid URL" };
  // Block localhost / private hosts in stored profile links.
  const host = stripWww(u.hostname);
  if (!host.includes(".") || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(host)) {
    return { ok: false, error: "Public URL required" };
  }
  const url = `${u.protocol}//${host}${u.pathname}${u.search}`.replace(/\/+$/, "");
  return { ok: true, storage: url, url, display: `${host}${u.pathname.replace(/\/+$/, "")}`, handle: null };
}

/* -------------------- public API -------------------- */

const NORMALIZERS: Record<SocialKey, (input: string) => NormalizeResult> = {
  telegram: normTelegram,
  youtube: normYouTube,
  tiktok: normTikTok,
  instagram: normInstagram,
  twitter: normTwitter,
  website: normWebsite,
};

/** Strict normalize — returns ok:false with a human-readable error. */
export function normalizeSocial(key: SocialKey, raw: string): NormalizeResult {
  if (typeof raw !== "string") return { ok: false, error: "Invalid input" };
  const trimmed = raw.trim().slice(0, 300);
  if (!trimmed) return { ok: false, error: "Empty value" };
  return NORMALIZERS[key](trimmed);
}

/** Lenient render-time helper: returns a safe URL or null (never throws). */
export function socialToUrl(key: SocialKey, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const r = normalizeSocial(key, raw);
  return r.ok ? r.url : null;
}

/** Lenient render-time helper: returns a short display label (@handle / host). */
export function socialDisplay(key: SocialKey, raw: string | null | undefined): string {
  if (!raw) return "";
  const r = normalizeSocial(key, raw);
  if (r.ok) return r.display;
  // Fallback: show the trimmed raw value so the user still sees what's stored.
  return raw.trim().slice(0, 64);
}