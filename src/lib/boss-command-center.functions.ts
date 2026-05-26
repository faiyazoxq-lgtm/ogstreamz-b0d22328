import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Boss Mega Command Center server functions.
 *
 * These wrap the multi-table reads/writes the Command Center needs that
 * aren't already exposed elsewhere: portal grid, VIP gate toggle, domain
 * denylist CRUD, maintenance flag, and security_events purge.
 */

/* ── Portals & Calculators ─────────────────────────────────────────── */

export const listPortalsForBoss = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("portals")
      .select("id, slug, name, niche, kind, vip, published, view_count, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as Array<{
      id: string;
      slug: string;
      name: string;
      niche: string | null;
      kind: string | null;
      vip: boolean;
      published: boolean;
      view_count: number;
      created_at: string;
    }> };
  });

export const listCalculatorsForBoss = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("calculators")
      .select("id, slug, name, description, vip, published, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as Array<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      vip: boolean;
      published: boolean;
      created_at: string;
    }> };
  });

export const bossSetPortalVip = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({ portal_id: z.string().uuid(), vip: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("portals")
      .update({ vip: data.vip })
      .eq("id", data.portal_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bossSetCalculatorPublished = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("calculators")
      .update({ published: data.published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ── Domain Denylist ───────────────────────────────────────────────── */

export const listDomainDenylist = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("domain_denylist")
      .select("id, domain, note, created_at")
      .order("domain", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as Array<{
      id: string; domain: string; note: string; created_at: string;
    }> };
  });

export const addDomainToDenylist = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({
      domain: z.string().trim().min(3).max(253).regex(/^[a-z0-9.-]+$/i),
      note: z.string().max(240).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { error } = await supabaseAdmin
      .from("domain_denylist")
      .insert({
        domain: data.domain.toLowerCase(),
        note: data.note ?? "",
        created_by: userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeDomainFromDenylist = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("domain_denylist")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ── Maintenance flag (app_settings.app_maintenance) ───────────────── */

export const getMaintenanceMode = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("app_settings" as never)
      .select("value, updated_at")
      .eq("key", "app_maintenance")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { value: any; updated_at: string } | null;
    const enabled = !!(row?.value?.enabled);
    return { enabled, updated_at: row?.updated_at ?? null };
  });

export const setMaintenanceMode = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({ enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { error } = await supabaseAdmin
      .from("app_settings" as never)
      .upsert(
        {
          key: "app_maintenance",
          value: { enabled: data.enabled },
          updated_by: userId,
        } as never,
        { onConflict: "key" } as never,
      );
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

/* ── Security events purge (older than 30 days) ────────────────────── */

export const purgeOldSecurityEvents = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .handler(async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error, count } = await supabaseAdmin
      .from("security_events")
      .delete({ count: "exact" })
      .lt("created_at", cutoff);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: count ?? 0, cutoff };
  });