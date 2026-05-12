// Hub style constraints. Single source of truth used by the New Hub form
// and the inline edit form on /boss/hubs.

export const HUB_ICON_KEYS = [
  "Sparkles", "Music2", "Smile", "Wrench", "TrendingUp", "Rocket", "Radio",
  "Bot", "Brain", "Zap", "Star", "Megaphone", "Disc3", "Satellite", "Radar",
] as const;
export type HubIconKey = typeof HUB_ICON_KEYS[number];

export const HUB_TITLE_MAX = 24;
export const HUB_TAGLINE_MAX = 60;
export const HUB_DESCRIPTION_MAX = 280;
export const HUB_SLUG_MAX = 48;

export const HUB_VISIBILITY_OPTIONS = [
  { value: "public",     label: "Public",        hint: "Anyone — including logged-out visitors" },
  { value: "signed_in",  label: "Signed-in only", hint: "Only members who are logged in" },
  { value: "boss_only",  label: "Boss / draft",  hint: "Hidden from everyone except the boss" },
] as const;
export type HubVisibility = typeof HUB_VISIBILITY_OPTIONS[number]["value"];

export const HUB_TEMPLATES = [
  { value: "generic",    label: "Blank",        desc: "Empty canvas — start from scratch" },
  { value: "links",      label: "Link Grid",    desc: "Hero + a grid of curated link cards (ToolHUB style)" },
  { value: "media",      label: "Media Spot",   desc: "Hero + image + descriptive copy (gallery style)" },
  { value: "embed",      label: "Embed",        desc: "Hero + an embedded iframe (e.g. dashboard, video)" },
  { value: "portals",    label: "Portal Grid",  desc: "Hero + auto-listed spawned portals of a kind (jokes/music/etc)" },
] as const;
export type HubTemplate = typeof HUB_TEMPLATES[number]["value"];

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

// PascalCase identifier ending in `HUB`, e.g. SignalHUB, MusicHUB.
const TITLE_RE = /^[A-Z][A-Za-z0-9]*HUB$/;

// oklch( L C H ) or oklch( L C H / A ) — L 0..1, C 0..0.5, H 0..360, A 0..1.
// Whitespace flexible, decimals optional.
const OKLCH_RE = /^oklch\(\s*(0(?:\.\d+)?|1(?:\.0+)?)\s+(0(?:\.\d+)?|0?\.\d+)\s+(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*)?\)$/i;

export type HubFormValues = {
  title: string;
  tagline: string;
  href: string;
  icon: string;
  accent: string;
  slug?: string;
};

export type HubFieldErrors = Partial<Record<keyof HubFormValues, string>>;

export function validateHubForm(v: HubFormValues): HubFieldErrors {
  const errors: HubFieldErrors = {};

  const title = v.title.trim();
  if (!title) errors.title = "Title required";
  else if (title.length > HUB_TITLE_MAX) errors.title = `Max ${HUB_TITLE_MAX} characters`;
  else if (!TITLE_RE.test(title)) errors.title = "PascalCase ending in HUB (e.g. SignalHUB)";

  if (v.tagline.length > HUB_TAGLINE_MAX) errors.tagline = `Max ${HUB_TAGLINE_MAX} characters`;

  if (!v.href.trim()) errors.href = "Link target required";

  if (!HUB_ICON_KEYS.includes(v.icon as HubIconKey)) errors.icon = "Pick an icon from the curated set";

  if (!OKLCH_RE.test(v.accent.trim())) errors.accent = "Accent must be oklch(...) — no hex / rgb";

  if (v.slug && v.slug.trim() && !SLUG_RE.test(v.slug.trim())) {
    errors.slug = "Lowercase letters, numbers, hyphens — 3–48 chars";
  }

  return errors;
}

export function isOklch(value: string): boolean {
  return OKLCH_RE.test(value.trim());
}

/** Auto-derive a URL slug from the hub title (e.g. "SignalHUB" → "signalhub"). */
export function suggestSlugFromTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HUB_SLUG_MAX);
}