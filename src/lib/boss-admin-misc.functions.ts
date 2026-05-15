import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Boss-only wrappers for the remaining admin-UI RPCs that previously
 * called supabase.rpc('boss_*') directly from the browser. EXECUTE on
 * those RPCs is now service_role-only, so they must go through here.
 */

export const bossPurgeViewEvents = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .handler(async () => {
    const { data, error } = await supabaseAdmin.rpc("boss_purge_view_events");
    if (error) throw new Error(error.message);
    return { purged: data ?? 0 };
  });

export const bossSetPortalPublished = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({ portal_id: z.string().uuid(), published: z.boolean() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).rpc("boss_set_portal_published", {
      _portal_id: data.portal_id,
      _published: data.published,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bossListStreamRequests = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .inputValidator((d: { status?: string } | undefined) => ({
    status: d?.status ?? "pending",
  }))
  .handler(async ({ data }) => {
    const { data: rows, error } = await (supabaseAdmin as any).rpc("boss_list_stream_requests", {
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

export const bossDecideStreamRequest = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      approve: z.boolean(),
      note: z.string().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).rpc("boss_decide_stream_request", {
      _id: data.id,
      _approve: data.approve,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });