import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * VIP perk: when a VIP buys a HUB portal, mint a personalised clone of that
 * portal owned by the buyer and seeded from their profile bio.
 *
 * Outcomes:
 *   - { ok: true, slug, name, kind } — clone created, point user at /p/$slug
 *     (or hub-specific prefix on the client).
 *   - { ok: false, reason: "no_bio" } — buyer is VIP but has no bio yet;
 *     client should prompt them to add one to their profile card.
 *   - { ok: false, reason: "not_vip" } — silently no-op for non-VIP buyers.
 *   - { ok: false, reason: "missing"|"unknown", message } — source portal
 *     missing or unexpected error.
 *
 * NOTE: this is a free perk that only fires AFTER a successful coin charge,
 * so we do not double-charge here. Source row is read with the user's
 * RLS-scoped client; insert is the same — RLS allows authenticated users
 * to insert their own portal rows (created_by = auth.uid()).
 */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "portal";
}

async function isVip(supabase: any, userId: string): Promise<boolean> {
  const [profileRes, roleRes, passRes] = await Promise.all([
    supabase.from("profiles").select("status, rank").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabase.from("vip_passes").select("id")
      .eq("user_id", userId).is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()).limit(1).maybeSingle(),
  ]);
  const p = profileRes?.data ?? null;
  return (
    !!roleRes?.data ||
    p?.rank === "boss" || p?.rank === "vip" ||
    p?.status === "vip" || !!passRes?.data
  );
}

export type CloneResult =
  | { ok: true; slug: string; name: string; kind: string; prefix: string }
  | { ok: false; reason: "no_bio" | "not_vip" | "missing" | "unknown"; message?: string };

const PREFIX_BY_KIND: Record<string, string> = {
  joke: "/p/", jokes: "/p/", music: "/m/", trade: "/td/",
  connect: "/connect", battle: "/b/", tool: "/t/", tools: "/t/",
};

export const cloneHubPortalForMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { portalId: string }) => ({
    portalId: String(d.portalId || "").trim(),
  }))
  .handler(async ({ data, context }): Promise<CloneResult> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.portalId) return { ok: false, reason: "missing", message: "Portal id required" };

    if (!(await isVip(supabase, userId))) {
      return { ok: false, reason: "not_vip" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("bio, display_name")
      .eq("id", userId)
      .maybeSingle();

    const bio = String(profile?.bio || "").trim();
    if (!bio) return { ok: false, reason: "no_bio" };

    const { data: src, error: srcErr } = await supabase
      .from("portals")
      .select("id, name, niche, language, vibe, theme, kind, theme_config, scout_meta, jokes, music_hooks, trade_briefs, connect_openers, tool_ideas")
      .eq("id", data.portalId)
      .maybeSingle();
    if (srcErr || !src) {
      return { ok: false, reason: "missing", message: "Source portal not found" };
    }

    const handle = (profile?.display_name as string | null)?.trim() || userId.slice(0, 6);
    const cloneName = `${src.name} · ${handle}`;
    const baseSlug = slugify(`${src.name}-${handle}`);
    let slug = `${baseSlug}-${Date.now().toString(36)}`;
    // Defensive: if collision (race), retry once with extra entropy.
    const { data: clash } = await supabase.from("portals").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const personalisedVibe = `${src.vibe || ""}${src.vibe ? " — " : ""}Personalised for ${handle}: ${bio}`.slice(0, 200);
    const personalisedNiche = `${src.niche} (tuned to: ${bio})`.slice(0, 400);

    const insertRow = {
      slug,
      name: cloneName.slice(0, 80),
      niche: personalisedNiche,
      language: src.language ?? "English",
      vibe: personalisedVibe,
      theme: src.theme ?? "street",
      kind: src.kind ?? "joke",
      vip: true,
      theme_config: src.theme_config ?? {},
      scout_meta: src.scout_meta ?? {},
      jokes: src.jokes ?? [],
      music_hooks: src.music_hooks ?? [],
      trade_briefs: src.trade_briefs ?? [],
      connect_openers: src.connect_openers ?? [],
      tool_ideas: src.tool_ideas ?? [],
      created_by: userId,
      metadata: { cloned_from: src.id, cloned_at: new Date().toISOString(), source: "hub_buy_perk" },
      published: true,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("portals")
      .insert(insertRow)
      .select("slug, name, kind")
      .single();
    if (insErr || !inserted) {
      return { ok: false, reason: "unknown", message: insErr?.message || "Could not create clone" };
    }

    const prefix = PREFIX_BY_KIND[inserted.kind] ?? "/p/";
    return { ok: true, slug: inserted.slug, name: inserted.name, kind: inserted.kind, prefix };
  });