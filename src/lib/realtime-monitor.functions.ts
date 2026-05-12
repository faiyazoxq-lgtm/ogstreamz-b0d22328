import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LogSchema = z.object({
  topic: z.string().min(1).max(200),
  status: z.string().min(1).max(64),
  reason: z.string().max(500).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Public — clients (and anonymous visitors) call this when a Realtime
 * subscription is denied / errored so Boss can audit suspicious activity.
 * Uses supabaseAdmin so we can attach the request IP and user agent
 * server-side, but the schema/limits stop spam payloads.
 */
export const logRealtimeDenial = createServerFn({ method: "POST" })
  .inputValidator((d) => LogSchema.parse(d))
  .handler(async ({ data }) => {
    const userAgent = (getRequestHeader("user-agent") ?? "").slice(0, 500);
    const ip = (getRequestIP({ xForwardedFor: true }) ?? "").slice(0, 64);

    const { error } = await supabaseAdmin.from("realtime_denial_log").insert({
      user_id: data.userId ?? null,
      topic: data.topic,
      status: data.status,
      reason: data.reason ?? null,
      user_agent: userAgent || null,
      ip: ip || null,
      metadata: data.metadata ?? {},
    });
    if (error) {
      // Don't surface DB errors to anonymous callers — just log server-side.
      console.error("[realtime-monitor] insert failed", error.message);
      return { ok: false };
    }
    return { ok: true };
  });

/** Boss-only — list recent denial events with optional filters. */
export const listRealtimeDenials = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).optional().default(200),
        topicLike: z.string().max(200).optional(),
        sinceHours: z.number().int().min(1).max(24 * 30).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("realtime_denial_log")
      .select("id, user_id, topic, status, reason, user_agent, ip, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.topicLike) q = q.ilike("topic", `%${data.topicLike}%`);
    if (data.sinceHours) {
      const cutoff = new Date(Date.now() - data.sinceHours * 3600_000).toISOString();
      q = q.gte("created_at", cutoff);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const sinceDay = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count: last24h } = await supabaseAdmin
      .from("realtime_denial_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sinceDay);

    return { denials: rows ?? [], last24h: last24h ?? 0 };
  });