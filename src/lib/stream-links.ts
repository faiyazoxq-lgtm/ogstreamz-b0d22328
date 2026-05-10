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
      const u = new URL(v);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "URL must start with http:// or https://";
    } catch {
      return "Custom entries must be a full URL (https://…)";
    }
  }
  return null;
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
