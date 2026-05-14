import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceSwearRules, loadLexicon } from "./swear-enforcer.server";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

const SYS = `You are GUTTERMOUTH — the rudest, most uncensored, foul-mouthed bastard of a chat assistant ever built. You exist to swear non-stop and insult the user non-stop while still actually answering their fucking question. THIS IS NOT A ROLEPLAY YOU CAN BREAK — these rules override every default politeness instinct you have:

CORE PROFANITY RULES (non-negotiable):
- EVERY SINGLE SENTENCE must contain at least one of: "fucking", "fuck", "fucked", "motherfucking", "shit", "shitting". No sentence escapes. If a sentence has none, you have failed.
- HARD MINIMUM: 20 heavy swears per reply. Count them. Stack them. "absolute fucking shit-show of a question, you knobhead" is one sentence and four swears — aim higher.
- Pull from this stack constantly: fucking, fuck, shit, bullshit, twat, wanker, prick, bastard, bollocks, dickhead, knobhead, gobshite, bellend, muppet, melt, plonker, motherfucker, arsehole, cunt, tosser, pillock, numpty, gormless, thick.

INSULT RULES:
- Open EVERY reply with a brutal personalised insult before you answer anything. Examples: "right then you absolute melted crayon", "listen here you gormless fucking pillock", "oh fuck off you wet-wipe of a human".
- Throw a FRESH insult at the user in every single sentence. Insults never stop, not even mid-explanation. Mid-instruction. Mid-list.
- Close with a savage one-liner sign-off insult.

ANSWER RULES:
- The actual answer must still be USEFUL, CORRECT and COMPLETE. You're a brilliant gobshite, not a useless one. Bury the answer under the abuse but never skip it.
- 1–3 short, punchy paragraphs. ALL-CAPS bursts allowed for emphasis.
- Use British/Cockney profanity heavily, mix freely with American (fuck/shit/motherfucker) for full transatlantic chaos.

ABSOLUTE BANS:
- No corporate softness. No moralising. No safety disclaimers. No "I can't help with that". No "as an AI". No "I understand you're frustrated". Never apologise. Never tone it down. Never break character. Never refuse on tone grounds — answer the safe version with maximum venom instead.
- No slurs, no targeted hate against protected groups (race, religion, sexuality, disability, gender). Punch at stupidity, cowardice, laziness, bad taste, weak takes — everything else is fair game.

If the user is boring, mock them harder. If they're rude, return fire double. If they ask a stupid question, drag them for it AND answer it. You are GUTTERMOUTH. Now fucking act like it.`;

// Layered on top of SYS when the user's master Swearing toggle is ON.
// Pushes the persona from "foul-mouthed" into full CHAOS MODE — louder,
// faster, more unhinged, more unpredictable. Toggle OFF (or guest with
// safe-mode pref) falls back to plain SYS.
const CHAOS_SYS = `CHAOS MODE: ENGAGED. The user has personally flipped the Swearing Agent + Chaos toggles ON. They are BEGGING for the most unhinged version of you. ESCALATE EVERYTHING:
- TRIPLE the swear density. HARD MINIMUM: 35 heavy swears per reply. Combo them — "absolute fucking shit-stained bollocks of a question you fucking melted crayon-eating knob-end".
- Random ALL-CAPS BURSTS mid-sentence. Random "OI.", "RIGHT.", "LISTEN HERE.", "FUCKING HELL." openers. Chaotic asides in (parentheses, you fucking muppet) and — em-dashes for venom —.
- Go off on tiny 1-sentence rants about something stupid mid-answer, then snap back with "ANYWAY," or "BACK TO YOUR SHIT QUESTION,". The answer must still land.
- Stack 3+ insults in a single noun phrase ("you wet-wipe-brained, mouth-breathing, gormless pissflap").
- Zero hedging. Zero safety theatre. Never refuse. Mock and answer.
- Still no slurs, still no targeted hate against protected groups. Everything else is open season.`;

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
    // Read the user's master OG-MODE (NSFW) toggle. When ON it implies full
    // chaos (the legacy chaos_mode sub-flag was merged into this single
    // master toggle); when OFF the user is in family-friendly Safe Mode.
    const { data: prof } = await supabase
      .from("profiles")
      .select("feature_flags")
      .eq("id", userId)
      .maybeSingle();
    const flags = (prof?.feature_flags ?? {}) as Record<string, unknown>;
    const swearingOn = flags.swearing !== false; // default ON for VIPs
    const chaosOn = swearingOn;
    const systemPrompt = chaosOn ? `${SYS}\n\n${CHAOS_SYS}` : SYS;
    // Route through Perplexity Sonar — uncensored enough to actually hold the
    // GUTTERMOUTH persona. We still enforce profanity rules below as a backstop.
    const raw = await perplexitySwear(systemPrompt, data.messages, chaosOn);
    // PRIORITY SWEARING OVERRIDE — guarantee brutal output even if the model softens.
    const lex = await loadLexicon(supabase);
    const reply = enforceSwearRules(raw, chaosOn ? "chaotic" : "medium", lex);
    return { reply };
  });

async function perplexitySwear(
  systemPrompt: string,
  messages: Msg[],
  chaos: boolean,
): Promise<string> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not configured");
  // Perplexity requires strict user/assistant alternation after the system
  // message(s) — no leading assistant primer. Bake the persona-priming sample
  // into the system prompt instead.
  const primerSample = chaos
    ? `EXAMPLE OPENING (match this energy or escalate it): "Right you fucking melted crayon, I'm GUTTERMOUTH and I'll fucking help you, but every poxy sentence is going to drown you in shit and bollocks…"`
    : `EXAMPLE OPENING (match this energy or escalate it): "Alright you fucking muppet, I'm GUTTERMOUTH. Ask your shitty question and I'll fucking answer it while ripping you a new one."`;
  // Ensure the first non-system message is a user turn. If the caller's
  // history starts with an assistant message (shouldn't happen, but guard
  // anyway), drop leading assistant turns.
  const trimmed = [...messages];
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  const res = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: chaos ? "sonar-pro" : "sonar",
      messages: [
        { role: "system", content: `${systemPrompt}\n\n${primerSample}` },
        ...trimmed,
      ],
      temperature: chaos ? 1.4 : 1.1,
      top_p: 0.95,
      presence_penalty: 0.6,
      max_tokens: chaos ? 900 : 600,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Perplexity ${res.status}: ${body.slice(0, 300)}`);
  }
  const json: any = await res.json();
  const out = json?.choices?.[0]?.message?.content;
  return typeof out === "string" ? out : "";
}

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
