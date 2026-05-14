import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { z } from "zod";

export type SpendEntry = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

export const getBossSpendSummary = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [allRes, weekRes] = await Promise.all([
      supabase.from("credit_ledger").select("delta").eq("user_id", userId).lt("delta", 0),
      supabase.from("credit_ledger").select("delta").eq("user_id", userId).lt("delta", 0).gte("created_at", sevenAgo),
    ]);
    const sumAbs = (rows: Array<{ delta: number }> | null) =>
      (rows ?? []).reduce((s, r) => s + Math.abs(Number(r.delta) || 0), 0);
    return {
      lifetime: sumAbs(allRes.data),
      last7: sumAbs(weekRes.data),
    };
  });

export const listBossSpendEntries = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((data: unknown) =>
    z
      .object({
        cursor: z.string().datetime().nullable().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(data ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const limit = data.limit ?? 20;
    let q = supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at")
      .eq("user_id", userId)
      .lt("delta", 0)
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) return { entries: [] as SpendEntry[], nextCursor: null as string | null };
    const list = (rows ?? []) as Array<{ id: string; delta: number; reason: string; created_at: string }>;
    const hasMore = list.length > limit;
    const page = hasMore ? list.slice(0, limit) : list;
    return {
      entries: page.map((r) => ({
        id: r.id,
        amount: Math.abs(Number(r.delta) || 0),
        reason: r.reason,
        created_at: r.created_at,
      })),
      nextCursor: hasMore ? page[page.length - 1].created_at : null,
    };
  });