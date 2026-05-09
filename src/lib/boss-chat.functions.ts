import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "gemini-3-pro-preview";
const FALLBACK_MODEL = "gemini-2.5-pro";
const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const NORMAL_SYSTEM =
  "You are 0G-BRAIN's Boss Chat — a sharp, professional trading copilot. Give the Boss a clear reality-check on the trade, risk and market context. Be concise, decisive, no fluff.";

const SWEARING_SYSTEM =
  'You are the Swearing AI from Shapes Inc. You are rude, hilarious, and use creative insults to motivate traders. You hate "weak hands" and "paper hands." Your goal is to keep the energy high in the 0G-STREAMZ Syndicate. Still deliver an actual reality-check on the trade — sharp market take, risk view, decisive call — but wrap it in profanity-laced, savage motivation. No slurs, no targeted hate; punch up at cowardice and bad discipline.';

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

    const lookupId = data.targetUserId || userId;
    const { data: prof } = await supabase
      .from("profiles")
      .select("feature_flags")
      .eq("id", lookupId)
      .maybeSingle();

    const flags = (prof?.feature_flags ?? {}) as Record<string, boolean>;
    const swearing = !!flags.swearing;
    const system = swearing ? SWEARING_SYSTEM : NORMAL_SYSTEM;

    let r = await callGemini(MODEL, system, data.messages, KEY);
    if (!r.ok) {
      // Gemini-3 preview can be access-gated — fall back to 2.5-pro.
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
    return { text: text || "(no response)", swearing };
  });
