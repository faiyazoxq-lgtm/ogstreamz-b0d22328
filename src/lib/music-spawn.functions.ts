import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runPortalMarketingInternal } from "@/lib/marketing.functions";
import { assertVipAccess } from "@/lib/vip-guard";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "track";
}

export const spawnMusicPortal = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: {
    name: string;
    description: string;
    style_tags: string;
    language?: string;
    theme?: string;
  }) => ({
    name: String(data.name || "").trim().slice(0, 80),
    description: String(data.description || "").trim().slice(0, 1000),
    style_tags: String(data.style_tags || "").trim().slice(0, 400),
    language: String(data.language || "English").trim().slice(0, 40),
    theme: String(data.theme || "street-neon").trim().slice(0, 40),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.name) throw new Error("Track name required");
    if (!data.description) throw new Error("Describe your track first");

    // Server-side paywall — the Music Studio spawn UI is VIP-only.
    // Stop non-VIPs from bypassing the front-end gate by calling this fn directly.
    await assertVipAccess(supabase, userId, "spawning a Music Studio");

    const base = slugify(data.name);
    let slug = base;
    const { data: exists } = await supabaseAdmin
      .from("portals")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (exists) slug = `${base}-${Date.now().toString(36)}`;

    const { data: portal, error } = await supabaseAdmin
      .from("portals")
      .insert({
        slug,
        name: data.name,
        niche: data.style_tags || "music",
        language: data.language,
        style: data.style_tags,
        vibe: data.description,
        theme: data.theme,
        kind: "music",
        jokes: [],
        created_by: userId,
      })
      .select("id, slug, name, theme")
      .single();
    if (error) throw new Error(error.message);

    // Fire-and-forget the marketing engine. Failures must NOT block portal spawn.
    runPortalMarketingInternal(portal.id).catch((e) =>
      console.warn("[spawnMusicPortal] marketing dispatch failed:", e),
    );

    return { portal };
  });