import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";

export type BossFreePurchaseRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  kind: "track_unlock" | "real_og" | "store_pass";
  ref_id: string | null;
  item_title: string | null;
  would_have_cost_credits: number;
  metadata: Record<string, any>;
  created_at: string;
};

export const listBossFreePurchases = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .inputValidator((d: {
    limit?: number;
    cursor?: string | null;
    userQuery?: string; // email or uuid prefix
    titleQuery?: string;
    kind?: string;
    fromDate?: string | null; // ISO
    toDate?: string | null;   // ISO
  } | undefined) => ({
    limit: Math.min(200, Math.max(1, Math.trunc(Number(d?.limit ?? 50)))),
    cursor: d?.cursor && typeof d.cursor === "string" ? d.cursor : null,
    userQuery: (d?.userQuery ?? "").trim().slice(0, 120),
    titleQuery: (d?.titleQuery ?? "").trim().slice(0, 120),
    kind: (d?.kind ?? "").trim().slice(0, 40),
    fromDate: d?.fromDate && typeof d.fromDate === "string" ? d.fromDate : null,
    toDate: d?.toDate && typeof d.toDate === "string" ? d.toDate : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;

    // Resolve userQuery → list of candidate user_ids if it's an email fragment.
    let userIdFilter: string[] | null = null;
    if (data.userQuery) {
      const looksUuid = /^[0-9a-f-]{8,}$/i.test(data.userQuery);
      if (looksUuid) {
        userIdFilter = [data.userQuery];
      } else {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", `%${data.userQuery}%`)
          .limit(200);
        userIdFilter = ((profs ?? []) as Array<{ id: string }>).map((p) => p.id);
        if (userIdFilter.length === 0) {
          return { rows: [], nextCursor: null, hasMore: false };
        }
      }
    }

    let q = supabase
      .from("boss_purchase_audit")
      .select("id,user_id,kind,ref_id,item_title,would_have_cost_credits,metadata,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit + 1);

    if (userIdFilter) q = q.in("user_id", userIdFilter);
    if (data.titleQuery) q = q.ilike("item_title", `%${data.titleQuery}%`);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.fromDate) q = q.gte("created_at", data.fromDate);
    if (data.toDate) q = q.lte("created_at", data.toDate);
    if (data.cursor) q = q.lt("created_at", data.cursor);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const all = (rows ?? []) as Array<Omit<BossFreePurchaseRow, "user_email">>;
    const hasMore = all.length > data.limit;
    const page = hasMore ? all.slice(0, data.limit) : all;

    const ids = Array.from(new Set(page.map((r) => r.user_id).filter(Boolean)));
    const emailById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id,email").in("id", ids);
      for (const p of (profs ?? []) as Array<{ id: string; email: string | null }>) {
        if (p.email) emailById.set(p.id, p.email);
      }
    }

    const enriched: BossFreePurchaseRow[] = page.map((r) => ({
      ...r,
      user_email: emailById.get(r.user_id) ?? null,
      metadata: (r.metadata as Record<string, any>) ?? {},
    }));

    const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;
    return { rows: enriched, nextCursor, hasMore };
  });
