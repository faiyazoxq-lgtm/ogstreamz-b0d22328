// Hub style constraints. Single source of truth used by the New Hub form
// and the inline edit form on /boss/hubs.

export const HUB_ICON_KEYS = [
  "Sparkles", "Music2", "Smile", "Wrench", "TrendingUp", "Rocket", "Radio",
  "Bot", "Brain", "Zap", "Star", "Megaphone", "Disc3", "Satellite", "Radar",
] as const;
export type HubIconKey = typeof HUB_ICON_KEYS[number];

export const HUB_TITLE_MAX = 24;
export const HUB_TAGLINE_MAX = 60;

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

  return errors;
}

export function isOklch(value: string): boolean {
  return OKLCH_RE.test(value.trim());
}