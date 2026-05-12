import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KNOWN_EVENTS = [
  "sign_in",
  "sign_out",
  "password_recovery",
  "password_updated",
  "token_refreshed",
  "user_updated",
] as const;

const LogSchema = z.object({
  event: z.enum(KNOWN_EVENTS),
  deviceHash: z.string().min(8).max(128).optional(),
  timezone: z.string().max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function isUnusualHour(): boolean {
  // Server UTC hour. 02:00–05:00 UTC is the catch-all "deep night" window.
  const h = new Date().getUTCHours();
  return h >= 2 && h < 5;
}

/**
 * Authenticated client → log a security-relevant auth event.
 * Captures IP + user-agent server-side, performs new-device detection
 * against `known_devices`, and (for new device or unusual hour) raises
 * a Boss alert via `system_alerts`.
 */
export const logSecurityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => LogSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const userAgent = (getRequestHeader("user-agent") ?? "").slice(0, 500);
    const ip = (getRequestIP({ xForwardedFor: true }) ?? "").slice(0, 64);

    let isNewDevice = false;
    if (data.deviceHash) {
      const { data: existing } = await supabaseAdmin
        .from("known_devices")
        .select("id")
        .eq("user_id", userId)
        .eq("device_hash", data.deviceHash)
        .maybeSingle();
      if (!existing) {
        isNewDevice = true;
        await supabaseAdmin.from("known_devices").insert({
          user_id: userId,
          device_hash: data.deviceHash,
          user_agent: userAgent || null,
        });
      } else {
        await supabaseAdmin
          .from("known_devices")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", existing.id);
      }
    }

    const unusualHour = data.event === "sign_in" && isUnusualHour();
    const severity = isNewDevice || unusualHour ? "warn" : "info";
    const flags = {
      ...(isNewDevice ? { new_device: true } : {}),
      ...(unusualHour ? { unusual_hour: true } : {}),
    };

    await supabaseAdmin.from("security_events").insert({
      event_type: data.event,
      severity,
      user_id: userId,
      actor_id: userId,
      ip: ip || null,
      user_agent: userAgent || null,
      metadata: {
        ...(data.metadata ?? {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
        ...flags,
      } as never,
    });

    if (isNewDevice || unusualHour) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      const reasons: string[] = [];
      if (isNewDevice) reasons.push("new device");
      if (unusualHour) reasons.push("unusual hour (02–05 UTC)");
      await supabaseAdmin.from("system_alerts").insert({
        category: "security" as never,
        severity: "warn" as never,
        source: "security-monitor",
        title: `Sign-in flagged: ${reasons.join(", ")}`,
        message: `${prof?.email ?? userId} signed in (${reasons.join(", ")}).`,
        metadata: {
          user_id: userId,
          email: prof?.email ?? null,
          ip: ip || null,
          user_agent: userAgent || null,
          timezone: data.timezone ?? null,
          ...flags,
        } as never,
      });
    }

    return { ok: true, isNewDevice, unusualHour };
  });

/** Boss-only — paginated security event feed with optional filters. */
export const listSecurityEvents = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).optional().default(200),
        sinceHours: z.number().int().min(1).max(24 * 30).optional(),
        eventLike: z.string().max(64).optional(),
        userId: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("security_events")
      .select(
        "id, event_type, severity, user_id, actor_id, ip, user_agent, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.eventLike) q = q.ilike("event_type", `%${data.eventLike}%`);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.sinceHours) {
      const cutoff = new Date(
        Date.now() - data.sinceHours * 3600_000,
      ).toISOString();
      q = q.gte("created_at", cutoff);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const sinceDay = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count: last24h } = await supabaseAdmin
      .from("security_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sinceDay);

    return { events: rows ?? [], last24h: last24h ?? 0 };
  });