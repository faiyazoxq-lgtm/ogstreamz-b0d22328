import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Boss-only: get the global favourite OG-Pass action keys for the
 * currently signed-in Boss. Returns [] if none have been pinned yet.
 */
export const getOgPassFavourites = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { data, error } = await supabaseAdmin
      .from("boss_action_favourites")
      .select("action_keys")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { keys: (data?.action_keys ?? []) as string[] };
  });

/**
 * Boss-only: replace the favourite OG-Pass action keys for this Boss.
 * Caps at 24 keys; deduplicates; trims/uppercases each key for stability.
 */
export const setOgPassFavourites = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { keys: string[] }) => ({
    keys: Array.from(
      new Set(
        (Array.isArray(d?.keys) ? d.keys : [])
          .map((k) => String(k ?? "").trim())
          .filter((k) => /^[a-z0-9._-]{1,64}$/i.test(k)),
      ),
    ).slice(0, 24),
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { error } = await supabaseAdmin
      .from("boss_action_favourites")
      .upsert(
        { user_id: userId, action_keys: data.keys, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, keys: data.keys };
  });