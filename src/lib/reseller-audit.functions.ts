import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ResellerAuditRow = {
  id: string;
  action: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  reseller_id: string | null;
  delta: number | null;
  reason: string | null;
  created_at: string;
  source: "live" | "archive";
};

const FilterSchema = z.object({
  action: z.enum(["", "create", "topup"]).optional().default(""),
  resellerId: z.string().trim().max(64).optional().default(""),
  actorUserId: z.string().trim().max(64).optional().default(""),
  targetUserId: z.string().trim().max(64).optional().default(""),
  from: z.string().trim().max(40).optional().default(""), // ISO date or datetime
  to: z.string().trim().max(40).optional().default(""),
  includeArchive: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(500).optional().default(100),
  // Cursor: ISO timestamp. Returns rows strictly older than this value.
  before: z.string().trim().max(40).optional().default(""),
});

function applyFilters(q: any, f: z.infer<typeof FilterSchema>) {
  if (f.action) q = q.eq("action", f.action);
  if (f.resellerId) q = q.eq("reseller_id", f.resellerId);
  if (f.actorUserId) q = q.eq("actor_user_id", f.actorUserId);
  if (f.targetUserId) q = q.eq("target_user_id", f.targetUserId);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lte("created_at", f.to);
  return q;
}

export const listResellerAudit = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d) => FilterSchema.parse(d))
  .handler(async ({ data }) => {
    // Cursor narrows the upper bound. Combine with explicit `to` if both set.
    const upperBound = data.before
      ? (data.to ? (data.before < data.to ? data.before : data.to) : data.before)
      : data.to;
    const filters = { ...data, to: upperBound };
    // For cursor pagination we want STRICTLY less-than, so swap `to` to a `lt`
    // by fetching one extra row and trimming. Simpler: query with lte and
    // dedupe rows whose created_at equals the cursor.
    const liveQ = applyFilters(
      supabaseAdmin
        .from("reseller_admin_audit")
        .select("id,action,actor_user_id,target_user_id,reseller_id,delta,reason,created_at"),
      filters,
    )
      .order("created_at", { ascending: false })
      .limit(data.limit + 1);

    const queries: Promise<any>[] = [liveQ];
    if (data.includeArchive) {
      const archQ = applyFilters(
        supabaseAdmin
          .from("reseller_admin_audit_archive")
          .select("id,action,actor_user_id,target_user_id,reseller_id,delta,reason,created_at"),
        filters,
      )
        .order("created_at", { ascending: false })
        .limit(data.limit + 1);
      queries.push(archQ);
    }

    const [liveRes, archRes] = await Promise.all(queries);
    if (liveRes.error) throw new Error(liveRes.error.message);
    if (archRes?.error) throw new Error(archRes.error.message);

    const live: ResellerAuditRow[] = (liveRes.data ?? []).map((r: any) => ({ ...r, source: "live" as const }));
    const archive: ResellerAuditRow[] = (archRes?.data ?? []).map((r: any) => ({ ...r, source: "archive" as const }));

    // If a cursor was supplied, drop rows at exactly that timestamp (we used lte
    // upstream because applyFilters uses .lte, so we must turn it into strict).
    const cursor = data.before;
    const filtered = cursor
      ? [...live, ...archive].filter((r) => r.created_at < cursor)
      : [...live, ...archive];

    const sorted = filtered
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
      .slice(0, data.limit + 1);

    const hasMore = sorted.length > data.limit;
    const merged = sorted.slice(0, data.limit);
    const nextCursor = hasMore && merged.length > 0
      ? merged[merged.length - 1].created_at
      : null;

    return {
      rows: merged,
      counts: { live: live.length, archive: archive.length, returned: merged.length },
      nextCursor,
      hasMore,
    };
  });