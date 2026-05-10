import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VipNotification = {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  link_url: string | null;
  severity: "info" | "success" | "warning" | "alert";
  created_by: string;
  created_at: string;
};

const SEVERITIES = ["info", "success", "warning", "alert"] as const;

export const sendVipNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string;
    body: string;
    link_url?: string | null;
    severity?: string;
    user_id?: string | null;
  }) => ({
    title: String(d.title ?? "").trim().slice(0, 120),
    body: String(d.body ?? "").trim().slice(0, 1000),
    link_url: d.link_url ? String(d.link_url).trim().slice(0, 500) : null,
    severity: (SEVERITIES as readonly string[]).includes(String(d.severity))
      ? (d.severity as VipNotification["severity"])
      : ("info" as const),
    user_id: d.user_id ? String(d.user_id) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.title || !data.body) throw new Error("Title and message are required");
    const { data: row, error } = await supabase
      .from("vip_notifications")
      .insert({
        title: data.title,
        body: data.body,
        link_url: data.link_url,
        severity: data.severity,
        user_id: data.user_id,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const listVipNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VipNotification[]> => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("vip_notifications")
      .select("id,user_id,title,body,link_url,severity,created_by,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as VipNotification[];
  });

export const deleteVipNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase.from("vip_notifications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInboxNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Array<VipNotification & { read: boolean }>> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: notifs, error } = await supabase
      .from("vip_notifications")
      .select("id,user_id,title,body,link_url,severity,created_by,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const ids = (notifs ?? []).map((n: any) => n.id);
    let readSet = new Set<string>();
    if (ids.length) {
      const { data: reads } = await supabase
        .from("vip_notification_reads")
        .select("notification_id")
        .eq("user_id", userId)
        .in("notification_id", ids);
      readSet = new Set((reads ?? []).map((r: any) => r.notification_id));
    }
    return (notifs ?? []).map((n: any) => ({ ...n, read: readSet.has(n.id) }));
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("vip_notification_reads")
      .upsert({ notification_id: data.id, user_id: userId }, { onConflict: "notification_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: notifs } = await supabase
      .from("vip_notifications")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (notifs ?? []).map((n: any) => ({ notification_id: n.id, user_id: userId }));
    if (rows.length) {
      const { error } = await supabase
        .from("vip_notification_reads")
        .upsert(rows, { onConflict: "notification_id,user_id" });
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: rows.length };
  });