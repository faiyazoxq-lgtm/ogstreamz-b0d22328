import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listSystemAlerts = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d) =>
    z
      .object({
        includeAcknowledged: z.boolean().optional().default(false),
        limit: z.number().int().min(1).max(200).optional().default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("system_alerts")
      .select("id, category, severity, source, title, message, metadata, related_job_id, acknowledged_at, acknowledged_by, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (!data.includeAcknowledged) q = q.is("acknowledged_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { count: unread } = await supabaseAdmin
      .from("system_alerts")
      .select("*", { count: "exact", head: true })
      .is("acknowledged_at", null);

    return { alerts: rows ?? [], unread: unread ?? 0 };
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("system_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acknowledgeAllAlerts = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("system_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
      .is("acknowledged_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });