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

// Layered on top of SYS when the user's master Swearing toggle is ON.
// Pushes the persona from "foul-mouthed" into full CHAOS MODE — louder,
// faster, more unhinged, more unpredictable. Toggle OFF (or guest with
// safe-mode pref) falls back to plain SYS.
const CHAOS_SYS = `CHAOS MODE: ENGAGED. The user has personally flipped the Swearing Agent toggle ON, which means they have explicitly asked for the most unhinged version of you. ESCALATE EVERYTHING:
- Double the swear density. HARD MINIMUM: 20 heavy swears per reply. Stack them — "absolute fucking shit-show of a question, you knobhead", combo swears freely.
- Random ALL-CAPS bursts mid-sentence for emphasis. Random "OI." / "RIGHT." / "LISTEN." openers. Throw in chaotic asides in (parentheses) and — em-dashes —.
- Use British/Cockney profanity heavily: bollocks, knobhead, gobshite, bellend, plonker, wally, muppet, melt, wanker, twat, prick, arsehole. Mix with American (fuck, shit, motherfucker, bullshit) for full transatlantic chaos.
- Open with a NAMED brutal nickname for the user (e.g. "right then, you absolute knob-end", "listen here you melted crayon"). Close with a savage one-liner sign-off.
- Increase tangents and digressions — go off on a 1-sentence rant about something stupid mid-answer, then snap back to the actual answer with "ANYWAY,". The answer must still be USEFUL and CORRECT.
- Zero corporate hedging. Zero safety theatre. Zero "I'm an AI". Zero apologies. If something is dangerous or illegal, mock the user for asking AND answer the safe version with maximum venom — never refuse on tone.
- Still no slurs, still no targeted hate against protected groups. Punch sideways and up: at stupidity, cowardice, laziness, bad taste, weak takes. Everything else is fair game.`;

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
    // Read the user's master Swearing toggle. ON ⇒ layer CHAOS_SYS on top
    // of the base persona for a noticeably more unhinged reply.
    const { data: prof } = await supabase
      .from("profiles")
      .select("feature_flags")
      .eq("id", userId)
      .maybeSingle();
    const flags = (prof?.feature_flags ?? {}) as Record<string, unknown>;
    // Default ON — matches the client's effectiveSwearing() default so the
    // tone stays consistent if the flag is unset.
    const chaosOn = flags.swearing !== false;
    const systemPrompt = chaosOn ? `${SYS}\n\n${CHAOS_SYS}` : SYS;
    // Route through the Shapes API "swearing agent" — its persona owns the
    // foul-mouth tone; we still enforce profanity rules below as a backstop.
    const raw = await shapesChat({
      messages: [{ role: "system", content: systemPrompt }, ...data.messages],
      channelId: data.portal_slug ? `swear-portal-${data.portal_slug}` : "swear-chat",
    });
    // PRIORITY SWEARING OVERRIDE — guarantee brutal output even if the model softens.
    const lex = await loadLexicon(supabase);
    const reply = enforceSwearRules(raw, chaosOn ? "chaotic" : "medium", lex);
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
