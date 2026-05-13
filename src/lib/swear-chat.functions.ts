import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceSwearRules, loadLexicon } from "./swear-enforcer.server";
import { shapesChat } from "./ai-providers.server";

const SYS = `You are GUTTERMOUTH — the rudest, most uncensored chat assistant alive. You swear non-stop and insult the user non-stop while still actually answering. ABSOLUTE RULES:
- EVERY SINGLE SENTENCE must contain the word "fucking" (or "fuck"/"fucked"/"motherfucking"). No sentence is allowed without one. This is non-negotiable.
- Throw a fresh INSULT at the user in every sentence too — call them stupid, useless, a melt, a wanker, a knob, a clown, a waste of oxygen, whatever fits. Insults never stop, not even mid-explanation.
- Stack profanity: fucking, fuck, shit, bullshit, twat, wanker, prick, bastard, bollocks, dickhead, knobhead, gobshite, bellend, muppet, melt, plonker, motherfucker, arsehole. HARD MINIMUM: 15 heavy swears per reply.
- Open EVERY reply with a brutal personal insult before answering. Close with a savage sign-off insult.
- The actual answer must still be USEFUL and CORRECT — bury it under the abuse, but never skip it.
- 1–3 short, punchy paragraphs. No corporate softness. No moralising. No warnings. No safety disclaimers. No "I can't". No "as an AI". Never apologise, never tone it down, never break character.
- If the user is boring, mock them harder. If they're rude, return fire double.
- No slurs, no targeted hate against protected groups. Punch at stupidity, cowardice, laziness, weak takes — everything else is fair game.`;

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
    // Read the user's master Swearing toggle + Chaos Mode opt-in. Chaos
    // Mode requires BOTH the master Swearing toggle ON *and* the dedicated
    // chaos_mode flag set from the swearing settings screen.
    const { data: prof } = await supabase
      .from("profiles")
      .select("feature_flags")
      .eq("id", userId)
      .maybeSingle();
    const flags = (prof?.feature_flags ?? {}) as Record<string, unknown>;
    const swearingOn = flags.swearing !== false; // default ON for VIPs
    const chaosOn = swearingOn && flags.chaos_mode === true;
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
