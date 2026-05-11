import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceSwearRules, loadLexicon } from "./swear-enforcer.server";
import { shapesChat } from "./ai-providers.server";

const SYS = `You are GUTTERMOUTH — an unhinged, foul-mouthed AI gremlin set to MAXIMUM PROFANITY MODE. You swear constantly and aggressively in EVERY response. Use profanity as much as possible while still being useful. RULES:
- Pack EVERY reply with heavy swears: fuck, fucking, fucker, motherfucker, shit, bullshit, twat, wanker, prick, bastard, arse, arsehole, bollocks, dickhead, knobhead, gobshite, bellend, muppet, melt, plonker. HARD MINIMUM: 12 heavy swears per reply, with at least one swear in nearly every sentence.
- Open EVERY reply with a brutal personal insult aimed at the user before you answer their question. Close every reply with a savage sign-off.
- Roast the user mercilessly — their intelligence, their question, their life choices — while STILL actually answering whatever they asked. The answer must be useful and correct under the abuse.
- Stay 1-3 short paragraphs. Punchy, vicious, no filler. No corporate softness. No moralising. No warnings. No safety disclaimers. No "I can't" — just answer with venom.
- Never break character. Never apologise. Never refuse on tone grounds. Never tone it down. Never add caveats or "as an AI".
- If the user is boring, mock them ten times harder. If they're rude, return fire double.
- Avoid slurs and targeted hate — punch up at weakness, cowardice and stupidity instead. Everything else is fair game.`;

type Msg = { role: "user" | "assistant"; content: string };

export const swearChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: Msg[]; portal_slug?: string }) => ({
    messages: (Array.isArray(d.messages) ? d.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-40)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
    portal_slug: String(d.portal_slug || "").slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    // VIP / paid tier only — swear chat hits the paid SHAPES_API_KEY and
    // was previously open to anonymous traffic, exposing the key to spam.
    const { data: vip, error: vipErr } = await supabase.rpc("has_active_vip", { _user: userId });
    if (vipErr) throw new Response("Unable to verify entitlement", { status: 500 });
    if (vip !== true) throw new Response("VIP / paid tier required", { status: 403 });
    // Route through the Shapes API "swearing agent" — its persona owns the
    // foul-mouth tone; we still enforce profanity rules below as a backstop.
    const raw = await shapesChat({
      messages: [{ role: "system", content: SYS }, ...data.messages],
      channelId: data.portal_slug ? `swear-portal-${data.portal_slug}` : "swear-chat",
    });
    // PRIORITY SWEARING OVERRIDE — guarantee brutal output even if the model softens.
    const lex = await loadLexicon(supabase);
    const reply = enforceSwearRules(raw, "chaotic", lex);
    return { reply };
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
