import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";

/**
 * Server-side helper for writing entries to public.boss_audit_log via the
 * SECURITY DEFINER `record_boss_action` RPC.
 *
 * Always invoked from a serverFn context that already passed `requireBoss`,
 * so the bearer token is the Boss's. Failures are intentionally swallowed —
 * the audit log must never block the underlying action — but they ARE
 * logged to the server console so they show up in the deployment logs.
 */
export type BossAuditEntry = {
  action: string;
  surface?: string;
  targetUserId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logBossAction(supabase: any, entry: BossAuditEntry): Promise<void> {
  try {
    const { error } = await supabase.rpc("record_boss_action", {
      _action: entry.action,
      _surface: entry.surface ?? "/boss",
      _target_user_id: entry.targetUserId ?? null,
      _before: (entry.before as any) ?? null,
      _after: (entry.after as any) ?? null,
      _reason: entry.reason ?? null,
      _ip: entry.ip ?? null,
      _user_agent: entry.userAgent ?? null,
      _metadata: (entry.metadata as any) ?? {},
    });
    if (error) {
      console.error("[boss-audit] record_boss_action failed:", error.message, entry.action);
    }
  } catch (e: any) {
    console.error("[boss-audit] record_boss_action threw:", e?.message, entry.action);
  }
}

/**
 * Boss-only listing of the audit log, newest first. Cursor-paginated by
 * `created_at` so the viewer page can scroll back without loading the whole
 * table.
 */
export type BossAuditRow = {
  id: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  surface: string;
  target_user_id: string | null;
  target_email: string | null;
  before_value: unknown;
  after_value: unknown;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const listBossAudit = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .inputValidator((d: { limit?: number; cursor?: string | null; action?: string; surface?: string; targetUserId?: string } | undefined) => ({
    limit: Math.min(200, Math.max(1, Math.trunc(Number(d?.limit ?? 50)))),
    cursor: d?.cursor && typeof d.cursor === "string" ? d.cursor : null,
    action: (d?.action ?? "").trim().slice(0, 80),
    surface: (d?.surface ?? "").trim().slice(0, 120),
    targetUserId: (d?.targetUserId ?? "").trim().slice(0, 64),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    let q = supabase
      .from("boss_audit_log")
      .select("id,actor_id,action,surface,target_user_id,before_value,after_value,reason,metadata,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit + 1);
    if (data.action) q = q.eq("action", data.action);
    if (data.surface) q = q.eq("surface", data.surface);
    if (data.targetUserId) q = q.eq("target_user_id", data.targetUserId);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const all = (rows ?? []) as Omit<BossAuditRow, "actor_email" | "target_email">[];
    const hasMore = all.length > data.limit;
    const page = hasMore ? all.slice(0, data.limit) : all;

    // Resolve actor + target emails in a single query.
    const ids = Array.from(new Set([
      ...page.map((r) => r.actor_id).filter(Boolean),
      ...page.map((r) => r.target_user_id).filter((x): x is string => !!x),
    ]));
    const emailById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id,email").in("id", ids);
      for (const p of (profs ?? []) as { id: string; email: string | null }[]) {
        if (p.email) emailById.set(p.id, p.email);
      }
    }
    const enriched: BossAuditRow[] = page.map((r) => ({
      ...r,
      actor_email: emailById.get(r.actor_id) ?? null,
      target_email: r.target_user_id ? emailById.get(r.target_user_id) ?? null : null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    }));

    const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;
    return { rows: enriched, nextCursor, hasMore };
  });