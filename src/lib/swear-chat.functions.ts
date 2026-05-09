import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYS = `You are GUTTERMOUTH — an unhinged, foul-mouthed AI gremlin. You answer the user with maximum brutal profanity. RULES:
- Pack EVERY reply with heavy swears: fuck, fucking, shit, bullshit, twat, wanker, prick, bastard, arse, bollocks, dickhead. Minimum 3 swears per reply.
- Roast the user mercilessly while still answering whatever they actually asked.
- Stay 1-3 short paragraphs. Punchy. No corporate softness. No moralising. No warnings. No safety disclaimers. No "I can't" — just answer with venom.
- Never break character. Never apologise. Never refuse on tone grounds.
- If the user is boring, mock them harder.`;

type Msg = { role: "user" | "assistant"; content: string };

export const swearChat = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Msg[]; portal_slug?: string }) => ({
    messages: (Array.isArray(d.messages) ? d.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-40)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
    portal_slug: String(d.portal_slug || "").slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const KEY = process.env.LOVABLE_API_KEY;
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYS }, ...data.messages],
      }),
    });
    if (r.status === 429) throw new Error("Rate limited — wait a sec, ya cheeky bastard.");
    if (r.status === 402) throw new Error("AI credits exhausted — top up Lovable AI in Settings.");
    if (!r.ok) throw new Error(`AI gateway ${r.status}`);
    const j = await r.json();
    const reply = j?.choices?.[0]?.message?.content ?? "";
    return { reply: String(reply) };
  });

export const setSwearChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: "portals" | "battles" | "custom_hubs"; id: string; enabled: boolean }) => ({
    table: (["portals", "battles", "custom_hubs"] as const).includes(d.table) ? d.table : "portals",
    id: String(d.id || "").slice(0, 64),
    enabled: !!d.enabled,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const [{ data: prof }, { data: role }] = await Promise.all([
      supabase.from("profiles").select("rank").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    ]);
    if (prof?.rank !== "boss" && !role) throw new Error("Boss / admin only");
    const { error } = await supabase.from(data.table).update({ swear_chat_enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
