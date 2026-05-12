import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Tag a user as a verified stream user (rank='stream_user') after either
 * a successful vault portal login OR a successful proxied M3U fetch.
 *
 * Idempotent. Never downgrades 'vip' or 'boss'. Only promotes from
 * 'prospect' / 'enforcer' / null.
 */
export async function tagOgStreamzUser(
  userId: string,
  source: "vault_login" | "m3u_fetch",
  opts: { expiresAt?: string | null; status?: string | null } = {},
): Promise<void> {
  if (!userId) return;
  try {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("rank")
      .eq("id", userId)
      .maybeSingle();

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      stream_verified_at: now,
      stream_auto_checked_at: now,
    };
    if (opts.status) patch.stream_status = opts.status;
    if (opts.expiresAt) patch.stream_expires_at = opts.expiresAt;

    const currentRank = (prof?.rank ?? null) as string | null;
    if (currentRank !== "vip" && currentRank !== "boss") {
      patch.rank = "stream_user";
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch as never)
      .eq("id", userId);
    if (error) {
      console.error(`[stream-tag:${source}] update failed:`, error.message);
    }
  } catch (e: any) {
    console.error(`[stream-tag:${source}] threw:`, e?.message || e);
  }
}
