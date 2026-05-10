import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BroadcastAudience = "all" | "members" | "ogs";

export type VipNotification = {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  link_url: string | null;
  severity: "info" | "success" | "warning" | "alert";
  audience: BroadcastAudience;
  created_by: string;
  created_at: string;
};

const SEVERITIES = ["info", "success", "warning", "alert"] as const;
const AUDIENCES = ["all", "members", "ogs"] as const;

export const sendVipNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string;
    body: string;
    link_url?: string | null;
    severity?: string;
    audience?: string;
    user_id?: string | null;
  }) => ({
    title: String(d.title ?? "").trim().slice(0, 120),
    body: String(d.body ?? "").trim().slice(0, 1000),
    link_url: d.link_url ? String(d.link_url).trim().slice(0, 500) : null,
    severity: (SEVERITIES as readonly string[]).includes(String(d.severity))
      ? (d.severity as VipNotification["severity"])
      : ("info" as const),
    audience: (AUDIENCES as readonly string[]).includes(String(d.audience))
      ? (d.audience as BroadcastAudience)
      : ("ogs" as const),
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
        audience: data.user_id ? "ogs" : data.audience,
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
      .select("id,user_id,title,body,link_url,severity,audience,created_by,created_at")
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
      .select("id,user_id,title,body,link_url,severity,audience,created_by,created_at")
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

/**
 * AI-assisted broadcast composer. Takes a short idea/prompt from the boss
 * and returns a polished {title, body, severity, audience} draft using
 * Lovable AI Gateway with structured tool calling.
 */
export const composeBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { idea: string; audience?: string; severity?: string }) => ({
    idea: String(d.idea ?? "").trim().slice(0, 500),
    audience: (AUDIENCES as readonly string[]).includes(String(d.audience))
      ? (d.audience as BroadcastAudience)
      : undefined,
    severity: (SEVERITIES as readonly string[]).includes(String(d.severity))
      ? (d.severity as VipNotification["severity"])
      : undefined,
  }))
  .handler(async ({ data }) => {
    if (!data.idea) throw new Error("Give me a quick idea to work with");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const system = [
      "You are 0G-BRAIN, the in-house broadcast writer for 0G-STREAMZ.",
      "Brand voice: street-smart, confident, mob-boss energy — but never sworn at, never patronising.",
      "Real OGs (VIP pass holders) are always addressed with respect.",
      "Audience meanings:",
      "  - 'all' = everyone (logged-in or not). Keep it broad and welcoming.",
      "  - 'members' = signed-in members. Familiar tone, can mention features.",
      "  - 'ogs' = Real OGs / VIPs. Premium tone, exclusive perks, never sworn at.",
      "Severity meanings: info (general update), success (good news/launch), warning (heads-up), alert (urgent).",
      "Title: punchy, max 60 chars, no trailing punctuation.",
      "Body: 1–3 short sentences, max 350 chars, plain text (no markdown).",
      "If the boss specified an audience or severity, honour it.",
    ].join("\n");

    const userPrompt = [
      `Idea: ${data.idea}`,
      data.audience ? `Required audience: ${data.audience}` : "Pick the best audience.",
      data.severity ? `Required severity: ${data.severity}` : "Pick the best severity.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "draft_broadcast",
            description: "Return a polished broadcast draft.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string" },
                severity: { type: "string", enum: ["info", "success", "warning", "alert"] },
                audience: { type: "string", enum: ["all", "members", "ogs"] },
              },
              required: ["title", "body", "severity", "audience"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "draft_broadcast" } },
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit hit — try again in a moment");
    if (res.status === 402) throw new Error("AI credits exhausted — top up at Settings → Workspace → Usage");
    if (!res.ok) throw new Error(`AI gateway error (${res.status})`);

    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no draft");
    let parsed: any;
    try { parsed = JSON.parse(args); } catch { throw new Error("AI returned invalid draft"); }
    return {
      title: String(parsed.title ?? "").slice(0, 120),
      body: String(parsed.body ?? "").slice(0, 1000),
      severity: (SEVERITIES as readonly string[]).includes(parsed.severity)
        ? (parsed.severity as VipNotification["severity"])
        : ("info" as const),
      audience: (AUDIENCES as readonly string[]).includes(parsed.audience)
        ? (parsed.audience as BroadcastAudience)
        : (data.audience ?? "members"),
    };
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