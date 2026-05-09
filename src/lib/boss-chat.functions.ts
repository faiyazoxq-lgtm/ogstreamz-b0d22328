import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "gemini-3-pro-preview";
const FALLBACK_MODEL = "gemini-2.5-pro";
const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const NORMAL_SYSTEM =
  "You are 0G-BRAIN's Boss Chat — a sharp, professional trading copilot. Give the Boss a clear reality-check on the trade, risk and market context. Be concise, decisive, no fluff.";

const SWEARING_BASE =
  'You are the Swearing AI from Shapes Inc. You are rude, hilarious, and use creative insults to motivate traders. You hate "weak hands" and "paper hands." Your goal is to keep the energy high in the 0G-STREAMZ Syndicate. Always deliver a real reality-check on the trade — sharp market take, risk view, decisive call — but wrap it in savage motivation. No slurs, no targeted hate; punch up at cowardice and bad discipline.';

export type SwearIntensity = "mild" | "medium" | "chaotic";

const INTENSITY_RULES: Record<SwearIntensity, string> = {
  mild:
    'INTENSITY: MILD. Light banter only — "mate", "muppet", "soft", "donkey", "clown". At most ONE soft swear (e.g. "damn", "hell", "bloody") per reply. Sass over profanity. Keep it PG-13.',
  medium:
    'INTENSITY: MEDIUM. Standard Swearing AI energy. 2-4 swears per reply (shit, piss, bastard, dickhead, prick, bollocks, arse) plus creative insults aimed at weak discipline. Punch hard but stay funny.',
  chaotic:
    'INTENSITY: CHAOTIC. Full unhinged Enforcer mode. Profanity in nearly every sentence (fuck, shit, fucking, bullshit, motherfucker, twat, wanker). Brutal, unfiltered roast of paper hands and bad risk. Never slurs, never targeted hate — only weakness, cowardice and bad discipline. Still land the actual market call clearly under the abuse.',
};

function buildSwearingSystem(intensity: SwearIntensity) {
  return `${SWEARING_BASE}\n\n${INTENSITY_RULES[intensity]}`;
}

type Msg = { role: "user" | "assistant"; content: string };

async function callGemini(model: string, system: string, history: Msg[], key: string) {
  const contents = history.slice(-20).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "").slice(0, 4000) }],
  }));
  const r = await fetch(`${ENDPOINT(model)}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
    }),
  });
  return r;
}

export const bossChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: Msg[]; targetUserId?: string | null }) => ({
    messages: Array.isArray(d.messages)
      ? d.messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [],
    targetUserId: d.targetUserId ? String(d.targetUserId) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const KEY = process.env.GEMINI_API_KEY;
    if (!KEY) throw new Error("GEMINI_API_KEY missing");
    if (data.messages.length === 0) throw new Error("No messages");

    // ── Cooldown / abuse throttle (Boss-controlled in HubControls) ─────────
    try {
      const { data: hub } = await supabase
        .from("hub_settings")
        .select("tuning")
        .eq("hub_key", "boss-chat")
        .maybeSingle();
      const cd = Math.max(0, Number((hub?.tuning as any)?.cooldown_seconds ?? 0) || 0);
      if (cd > 0) {
        const since = new Date(Date.now() - cd * 1000).toISOString();
        const { count } = await supabase
          .from("boss_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .eq("source", "web")
          .eq("external_user", userId)
          .gte("created_at", since);
        if ((count ?? 0) > 0) {
          throw new Error(`COOLDOWN: Slow down — wait ${cd}s between messages.`);
        }
      }
    } catch (e: any) {
      if (String(e?.message || "").startsWith("COOLDOWN:")) throw e;
      // ignore cooldown lookup errors, fail open
    }

    const lookupId = data.targetUserId || userId;
    const { data: prof } = await supabase
      .from("profiles")
      .select("feature_flags")
      .eq("id", lookupId)
      .maybeSingle();

    const flags = (prof?.feature_flags ?? {}) as Record<string, any>;
    const swearing = !!flags.swearing;
    // BRUTAL MODE: default to chaotic everywhere unless explicitly muzzled.
    const rawIntensity = String(flags.swearing_intensity ?? "chaotic").toLowerCase();
    const intensity: SwearIntensity =
      rawIntensity === "mild" || rawIntensity === "medium" ? rawIntensity : "chaotic";
    const system = swearing ? buildSwearingSystem(intensity) : NORMAL_SYSTEM;

    let r = await callGemini(MODEL, system, data.messages, KEY);
    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      console.warn(`[bossChat] ${MODEL} ${r.status} — falling back to ${FALLBACK_MODEL}`, errTxt.slice(0, 200));
      r = await callGemini(FALLBACK_MODEL, system, data.messages, KEY);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`Gemini error ${r.status}: ${t.slice(0, 240)}`);
      }
    }
    const j = await r.json();
    const text: string =
      j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ?? "";
    // Log this user message for cooldown tracking
    try {
      await supabase.from("boss_chat_messages").insert({
        role: "user",
        source: "web",
        content: data.messages[data.messages.length - 1]?.content?.slice(0, 4000) ?? "",
        external_user: userId,
      });
    } catch {}
    return { text: text || "(no response)", swearing, intensity };
  });
