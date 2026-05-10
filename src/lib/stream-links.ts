import type { Twitch as TwitchIcon } from "lucide-react";
import { Twitch, Youtube, Radio, Globe } from "lucide-react";

export type StreamPlatform = "twitch" | "youtube" | "kick" | "custom";

export type StreamEntry = {
  id: string;
  platform: StreamPlatform;
  value: string;
};

/** Stored shape on `profiles.stream_links` (jsonb). */
export type StreamLinks = {
  entries?: StreamEntry[];
  /** Legacy shape — migrated to entries on read. */
  twitch?: string;
  youtube?: string;
  url?: string;
};

export const STREAM_PLATFORMS: Array<{
  value: StreamPlatform;
  label: string;
  placeholder: string;
  Icon: typeof TwitchIcon;
}> = [
  { value: "twitch",  label: "Twitch",     placeholder: "yourname or twitch.tv/yourname", Icon: Twitch },
  { value: "youtube", label: "YouTube",    placeholder: "@yourchannel or full URL",       Icon: Youtube },
  { value: "kick",    label: "Kick",       placeholder: "yourname or kick.com/yourname",  Icon: Radio },
  { value: "custom",  label: "Custom URL", placeholder: "https://your-stream.example",    Icon: Globe },
];

export function platformMeta(p: StreamPlatform) {
  return STREAM_PLATFORMS.find((x) => x.value === p) ?? STREAM_PLATFORMS[3];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Normalize stored value (old or new) into a stable list of entries. */
export function readEntries(raw: unknown): StreamEntry[] {
  const data = (raw ?? {}) as StreamLinks;
  if (Array.isArray(data.entries) && data.entries.length > 0) {
    return data.entries
      .filter((e) => e && typeof e.value === "string" && e.value.trim())
      .map((e) => ({
        id: e.id || uid(),
        platform: (["twitch", "youtube", "kick", "custom"] as StreamPlatform[]).includes(e.platform)
          ? e.platform
          : "custom",
        value: e.value.trim().slice(0, 300),
      }));
  }
  // Legacy migration
  const out: StreamEntry[] = [];
  if (data.twitch?.trim())  out.push({ id: uid(), platform: "twitch",  value: data.twitch.trim() });
  if (data.youtube?.trim()) out.push({ id: uid(), platform: "youtube", value: data.youtube.trim() });
  if (data.url?.trim())     out.push({ id: uid(), platform: "custom",  value: data.url.trim() });
  return out;
}

export function newEntry(platform: StreamPlatform = "twitch"): StreamEntry {
  return { id: uid(), platform, value: "" };
}

/**
 * Platform-specific handle rules.
 * - Twitch:  4-25 chars, letters/digits/underscore, must start with a letter/number.
 *            Ref: https://help.twitch.tv (username rules)
 * - YouTube: 3-30 chars, letters/digits, '.', '_', '-'. (handle rules)
 * - Kick:    3-25 chars, letters/digits/underscore.
 */
const HANDLE_RULES: Record<Exclude<StreamPlatform, "custom">, { re: RegExp; hint: string; expectedHost: RegExp }> = {
  twitch:  { re: /^[a-zA-Z0-9][a-zA-Z0-9_]{3,24}$/, hint: "Twitch handles are 4–25 letters, digits or '_' (must start with a letter/number).", expectedHost: /(^|\.)twitch\.tv$/i },
  youtube: { re: /^[a-zA-Z0-9._-]{3,30}$/,           hint: "YouTube handles are 3–30 letters, digits, '.', '_' or '-'.",                       expectedHost: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i },
  kick:    { re: /^[a-zA-Z0-9_]{3,25}$/,             hint: "Kick handles are 3–25 letters, digits or '_'.",                                    expectedHost: /(^|\.)kick\.com$/i },
};

function extractHandleFromUrl(platform: Exclude<StreamPlatform, "custom">, raw: string): string | null {
  const ensured = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try { u = new URL(ensured); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!HANDLE_RULES[platform].expectedHost.test(host)) return null;

  const segments = u.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (segments.length === 0) return null;

  if (platform === "youtube") {
    // Preserve channel-style URLs by returning a sentinel — caller handles them.
    if (/^(channel|c|user)$/i.test(segments[0]) && segments[1]) return `__path:${segments[0].toLowerCase()}/${decodeURIComponent(segments[1])}`;
    return decodeURIComponent(segments[0]).replace(/^@/, "");
  }
  return decodeURIComponent(segments[0]).replace(/^@/, "");
}

/** Validate one entry. Returns an error message or null if valid. */
export function validateEntry(entry: StreamEntry): string | null {
  const v = entry.value.trim();
  if (!v) return "Value is required";

  if (entry.platform === "custom") {
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return "URL must start with http:// or https://";
      }
      if (!u.hostname.includes(".")) return "Enter a valid URL (e.g. https://your-stream.example)";
    } catch {
      return "Custom entries must be a valid URL";
    }
    return null;
  }

  const rules = HANDLE_RULES[entry.platform];
  const looksLikeUrl = /^https?:\/\//i.test(v) || /^[\w-]+\.[\w.-]+\//.test(v);

  if (looksLikeUrl) {
    const handle = extractHandleFromUrl(entry.platform, v);
    if (handle === null) {
      const expected = entry.platform === "twitch" ? "twitch.tv" : entry.platform === "kick" ? "kick.com" : "youtube.com";
      return `Use a ${expected} URL or just your handle.`;
    }
    if (handle.startsWith("__path:")) return null; // YouTube channel/c/user path — accepted
    if (!rules.re.test(handle)) return rules.hint;
    return null;
  }

  const handle = v.replace(/^@/, "");
  if (!rules.re.test(handle)) return rules.hint;
  return null;
}

/**
 * Normalize an entry into a consistent stored format:
 *  - Twitch:  https://twitch.tv/<handle>
 *  - YouTube: https://youtube.com/@<handle>  (preserves /channel/UC..., /c/..., /user/...)
 *  - Kick:    https://kick.com/<handle>
 *  - Custom:  full https:// URL with lowercase host
 * Falls back to the trimmed input if it can't be parsed.
 */
export function normalizeEntry(entry: StreamEntry): StreamEntry {
  const raw = entry.value.trim();
  if (!raw) return { ...entry, value: "" };

  const ensureUrl = (s: string) =>
    /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
  const handleFromPath = (path: string) =>
    decodeURIComponent(path.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "");

  try {
    if (entry.platform === "custom") {
      const u = new URL(ensureUrl(raw));
      u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
      return { ...entry, value: u.toString().replace(/\/$/, "") };
    }

    const looksLikeUrl = /^https?:\/\//i.test(raw) || /^[\w-]+\.[\w.-]+\//.test(raw);
    let handle = raw.replace(/^@/, "");
    let preservedYoutubePath: string | null = null;
    if (looksLikeUrl) {
      const extracted = extractHandleFromUrl(entry.platform, raw);
      if (extracted?.startsWith("__path:")) {
        preservedYoutubePath = extracted.slice("__path:".length);
      } else if (extracted) {
        handle = extracted;
      } else {
        handle = handleFromPath(new URL(ensureUrl(raw)).pathname).replace(/^@/, "");
      }
    }

    switch (entry.platform) {
      case "twitch":
        return { ...entry, value: `https://twitch.tv/${handle.toLowerCase()}` };
      case "kick":
        return { ...entry, value: `https://kick.com/${handle.toLowerCase()}` };
      case "youtube": {
        if (preservedYoutubePath) {
          return { ...entry, value: `https://youtube.com/${preservedYoutubePath}` };
        }
        return { ...entry, value: `https://youtube.com/@${handle}` };
      }
    }
  } catch {
    /* fall through */
  }
  return { ...entry, value: raw };
}

/** Build a click-through URL for an entry (handle or full URL). */
export function entryHref(entry: StreamEntry): string {
  const v = entry.value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  switch (entry.platform) {
    case "twitch":  return `https://twitch.tv/${handle}`;
    case "youtube": return `https://youtube.com/${v.startsWith("@") ? v : `@${handle}`}`;
    case "kick":    return `https://kick.com/${handle}`;
    default:        return v;
  }
}

/** Pretty short label for display rows. */
export function entryLabel(entry: StreamEntry): string {
  const v = entry.value.trim();
  return v.replace(/^https?:\/\/(www\.)?/i, "");
}

/**
 * Canonical dedupe key for an entry. Two entries with the same key point at
 * the same destination — e.g. `twitch.tv/Foo`, `@foo`, and `https://twitch.tv/foo/`
 * all collapse to `twitch:twitch.tv/foo`.
 */
export function entryKey(entry: StreamEntry): string {
  const normalized = normalizeEntry(entry).value.trim();
  if (!normalized) return "";
  let canonical = normalized;
  try {
    const u = new URL(/^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    canonical = `${host}${path}${u.search.toLowerCase()}`;
  } catch {
    canonical = normalized.toLowerCase();
  }
  return `${entry.platform}:${canonical}`;
}
