import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertBoss(supabase: any, userId: string) {
  const [{ data: prof }, { data: role }] = await Promise.all([
    supabase.from("profiles").select("rank").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  if (prof?.rank !== "boss" && !role) throw new Error("Boss only");
}

const cnt = async (table: string, filter?: (q: any) => any) => {
  let q = (supabaseAdmin as any).from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
};

export const getNerdStats = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertBoss(supabase, userId);

    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    // ── Portals ────────────────────────────────────────────
    const { data: portalsAll } = await supabaseAdmin
      .from("portals").select("kind, view_count, vip, created_at");
    const portalsTotal = portalsAll?.length ?? 0;
    const portalsByKind: Record<string, number> = {};
    let totalViews = 0;
    let vipPortals = 0;
    let portals30d = 0;
    let zeroView = 0;
    for (const p of portalsAll ?? []) {
      portalsByKind[p.kind] = (portalsByKind[p.kind] ?? 0) + 1;
      totalViews += p.view_count ?? 0;
      if (p.vip) vipPortals++;
      if (p.created_at >= since30d) portals30d++;
      if ((p.view_count ?? 0) === 0) zeroView++;
    }
    const { data: topPortals } = await supabaseAdmin
      .from("portals")
      .select("slug, name, kind, view_count")
      .order("view_count", { ascending: false })
      .limit(5);
    const views24h = await cnt("portal_view_events", (q) => q.gte("created_at", since24h));
    const views7d = await cnt("portal_view_events", (q) => q.gte("created_at", since7d));

    // ── Users & credits ────────────────────────────────────
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("status, rank, credits, created_at");
    let users = profs?.length ?? 0;
    let vipUsers = 0, bossUsers = 0, freeUsers = 0, creditsInCirculation = 0, newUsers7d = 0;
    for (const p of profs ?? []) {
      if (p.status === "vip") vipUsers++; else freeUsers++;
      if (p.rank === "boss") bossUsers++;
      creditsInCirculation += p.credits ?? 0;
      if (p.created_at >= since7d) newUsers7d++;
    }
    const { data: topSpenders } = await supabaseAdmin
      .from("profiles").select("email, credits, status").order("credits", { ascending: false }).limit(5);

    // ── Revenue & orders ───────────────────────────────────
    const { data: orders } = await supabaseAdmin
      .from("pass_orders").select("status, kind, amount_cents, currency, created_at");
    const ordersByStatus: Record<string, number> = {};
    let issuedRevenueCents = 0;
    let pending = 0;
    for (const o of orders ?? []) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
      if (o.status === "issued") issuedRevenueCents += o.amount_cents ?? 0;
      if (o.status === "pending_approval") pending++;
    }
    const { data: creditPurch } = await supabaseAdmin
      .from("credit_purchases").select("credits_granted, amount_cents, created_at");
    const creditPurchasesTotal = creditPurch?.length ?? 0;
    const creditsSold = (creditPurch ?? []).reduce((s, r) => s + (r.credits_granted ?? 0), 0);
    const creditRevenueCents = (creditPurch ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    const creditPurch30d = (creditPurch ?? []).filter((r) => r.created_at >= since30d).length;

    // ── System health ──────────────────────────────────────
    const { data: errLogs } = await supabaseAdmin
      .from("ai_logs").select("level, source, message, created_at")
      .gte("created_at", since24h)
      .in("level", ["error", "warn"])
      .order("created_at", { ascending: false })
      .limit(10);
    const errors24h = await cnt("ai_logs", (q) => q.gte("created_at", since24h).eq("level", "error"));
    const aiLogs24h = await cnt("ai_logs", (q) => q.gte("created_at", since24h));
    const tradeScans24h = await cnt("portal_view_events", (q) => q.gte("created_at", since24h).eq("kind", "trade"));
    const magicLinks24h = await cnt("magic_link_audit", (q) => q.gte("created_at", since24h));

    return {
      portals: {
        total: portalsTotal,
        byKind: portalsByKind,
        vip: vipPortals,
        zeroView,
        new30d: portals30d,
        totalViews,
        views24h,
        views7d,
        top: topPortals ?? [],
      },
      users: {
        total: users,
        vip: vipUsers,
        free: freeUsers,
        boss: bossUsers,
        new7d: newUsers7d,
        creditsInCirculation,
        topSpenders: topSpenders ?? [],
      },
      revenue: {
        ordersByStatus,
        pendingOrders: pending,
        issuedRevenueCents,
        creditPurchasesTotal,
        creditPurch30d,
        creditsSold,
        creditRevenueCents,
      },
      system: {
        errors24h,
        aiLogs24h,
        tradeScans24h,
        magicLinks24h,
        recentErrors: errLogs ?? [],
      },
      generatedAt: new Date().toISOString(),
    };
  });