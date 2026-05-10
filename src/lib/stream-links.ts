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
  // Handle-based platforms: allow URL OR a bare handle.
  if (/^https?:\/\//i.test(v)) {
    try { new URL(v); } catch { return "Invalid URL"; }
    return null;
  }
  const handle = v.replace(/^@/, "");
  if (!/^[a-zA-Z0-9_.-]{2,50}$/.test(handle)) {
    return "Use 2–50 letters, numbers, '_', '.' or '-' (or paste a full URL)";
  }
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

    // Handle platforms: parse URL if present, otherwise treat as handle.
    let handle = raw.replace(/^@/, "");
    let isUrl = /^https?:\/\//i.test(raw) || /^[\w-]+\.[\w.-]+\//.test(raw);
    if (isUrl) {
      const u = new URL(ensureUrl(raw));
      handle = handleFromPath(u.pathname);
    }
    handle = handle.replace(/^@/, "");

    switch (entry.platform) {
      case "twitch":
        return { ...entry, value: `https://twitch.tv/${handle.toLowerCase()}` };
      case "kick":
        return { ...entry, value: `https://kick.com/${handle.toLowerCase()}` };
      case "youtube": {
        // Preserve channel-style paths if user pasted a full URL.
        if (isUrl) {
          const u = new URL(ensureUrl(raw));
          const path = u.pathname.replace(/\/+$/, "");
          if (/^\/(channel|c|user)\//i.test(path)) {
            return { ...entry, value: `https://youtube.com${path}` };
          }
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
