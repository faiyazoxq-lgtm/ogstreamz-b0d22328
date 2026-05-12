// Hub section schema — the building blocks the boss can stack inside a
// custom hub. Kept in one file so the editor, renderer, and validator
// stay in lock-step.

import { z } from "zod";

export const HUB_SECTION_TYPES = [
  { value: "hero",        label: "Hero",         desc: "Big AI-generated header (cinematic)" },
  { value: "text",        label: "Text block",   desc: "Heading + paragraph copy" },
  { value: "link_grid",   label: "Link grid",    desc: "Grid of card-style links" },
  { value: "embed",       label: "Embed",        desc: "Embedded iframe (Twitch, YouTube, doc, app)" },
  { value: "media",       label: "Image",        desc: "Single image with optional caption" },
  { value: "portal_grid", label: "Portal grid",  desc: "Auto-list spawned portals of a kind" },
] as const;

export type HubSectionType = typeof HUB_SECTION_TYPES[number]["value"];

export const HeroSectionZ = z.object({
  type: z.literal("hero"),
  tagline: z.string().max(80).optional(),
  seed: z.string().max(280).optional(),
});
export const TextSectionZ = z.object({
  type: z.literal("text"),
  heading: z.string().max(120).optional(),
  body: z.string().max(2000),
});
export const LinkGridItemZ = z.object({
  label: z.string().min(1).max(60),
  href: z.string().min(1).max(400),
  desc: z.string().max(120).optional(),
  icon: z.string().max(32).optional(),
});
export const LinkGridSectionZ = z.object({
  type: z.literal("link_grid"),
  heading: z.string().max(120).optional(),
  items: z.array(LinkGridItemZ).min(1).max(24),
});
export const EmbedSectionZ = z.object({
  type: z.literal("embed"),
  url: z.string().url().max(500),
  height: z.number().int().min(160).max(1200).default(420),
  title: z.string().max(120).optional(),
});
export const MediaSectionZ = z.object({
  type: z.literal("media"),
  src: z.string().url().max(500),
  alt: z.string().max(200).optional(),
  caption: z.string().max(200).optional(),
});
export const PortalGridSectionZ = z.object({
  type: z.literal("portal_grid"),
  heading: z.string().max(120).optional(),
  kind: z.enum(["joke", "music", "trade", "connect", "battle", "tool"]).default("joke"),
  limit: z.number().int().min(1).max(24).default(6),
});

export const HubSectionZ = z.discriminatedUnion("type", [
  HeroSectionZ, TextSectionZ, LinkGridSectionZ,
  EmbedSectionZ, MediaSectionZ, PortalGridSectionZ,
]);
export type HubSection = z.infer<typeof HubSectionZ>;

export const HubSectionsZ = z.array(HubSectionZ).max(20);

/** Build a starter `sections` array from a template label. */
export function templateToSections(
  template: string,
  ctx: { title: string; tagline: string },
): HubSection[] {
  switch (template) {
    case "links":
      return [
        { type: "hero", tagline: ctx.tagline },
        {
          type: "link_grid",
          heading: "Quick links",
          items: [
            { label: "Open dashboard", href: "/dashboard" },
            { label: "Browse portals", href: "/portals" },
          ],
        },
      ];
    case "media":
      return [
        { type: "hero", tagline: ctx.tagline },
        { type: "media", src: "https://placehold.co/1200x600/0a0f1a/3ad6ff?text=Drop+image+URL", alt: ctx.title },
        { type: "text", heading: "About this hub", body: `Tell people what ${ctx.title} is about — keep it short and punchy.` },
      ];
    case "embed":
      return [
        { type: "hero", tagline: ctx.tagline },
        { type: "embed", url: "https://example.com", height: 480, title: ctx.title },
      ];
    case "portals":
      return [
        { type: "hero", tagline: ctx.tagline },
        { type: "portal_grid", heading: "Latest portals", kind: "joke", limit: 6 },
      ];
    case "generic":
    default:
      return [{ type: "hero", tagline: ctx.tagline }];
  }
}

/** Make a fresh, valid section instance for a chosen type. */
export function newSection(type: HubSectionType): HubSection {
  switch (type) {
    case "hero":        return { type: "hero" };
    case "text":        return { type: "text", body: "" };
    case "link_grid":   return { type: "link_grid", items: [{ label: "", href: "" }] };
    case "embed":       return { type: "embed", url: "https://", height: 420 };
    case "media":       return { type: "media", src: "https://" };
    case "portal_grid": return { type: "portal_grid", kind: "joke", limit: 6 };
  }
}