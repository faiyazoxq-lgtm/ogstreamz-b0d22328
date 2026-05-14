// Centralised AI providers for user-facing text generation.
//
//   smartChat     — tries GEMINI_API_KEY_PRIMARY → Perplexity → legacy GOOGLE_AI_STUDIO_API_KEY,
//                   in that order, so we burn the new Gemini quota first and only
//                   fall back when something explodes.
//   geminiChat    — direct Gemini call with primary→fallback key chain.
//   perplexityChat — Perplexity Sonar (general text, marketing, jokes, tools).
//   shapesChat     — OG BOT chaos persona via Perplexity Sonar Pro
//                    (boss-chat, swear-chat, battles GM). Pass safe:true for
//                    family-friendly mode. Name kept for backward compat.
//
// Both are OpenAI-compatible chat-completion shapes.

type Msg = { role: "system" | "user" | "assistant"; content: string };

function extractJson(raw: string): string {
  const m = raw.match(/\{[\s\S]*\}/);
  return m ? m[0] : raw;
}

// ---------------- Gemini (Google AI Studio REST) ----------------

const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

function geminiKeys(): string[] {
  // Order matters: primary (new) key first, legacy second.
  const out: string[] = [];
  const primary = process.env.GEMINI_API_KEY_PRIMARY;
  const legacy = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (primary) out.push(primary);
  if (legacy && legacy !== primary) out.push(legacy);
  return out;
}

function toGeminiBody(messages: Msg[], opts: { temperature?: number; max_tokens?: number; json?: boolean }) {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  const body: Record<string, any> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.max_tokens ?? 1200,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  return body;
}

export async function geminiChat(opts: {
  messages: Msg[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
}): Promise<string> {
  const keys = geminiKeys();
  if (keys.length === 0) throw new Error("No Gemini key configured (GEMINI_API_KEY_PRIMARY / GOOGLE_AI_STUDIO_API_KEY)");
  const model = opts.model || GEMINI_DEFAULT_MODEL;
  const body = toGeminiBody(opts.messages, opts);
  let lastErr = "";
  for (const key of keys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const j = await r.json();
      const text = (j?.candidates?.[0]?.content?.parts ?? [])
        .map((p: any) => p?.text ?? "")
        .join("");
      return String(text ?? "");
    }
    lastErr = `Gemini ${r.status}: ${(await r.text().catch(() => "")).slice(0, 240)}`;
    // try next key
  }
  throw new Error(lastErr || "Gemini failed");
}

/**
 * Provider-fallback chat: NEW Gemini → Perplexity → LEGACY Gemini.
 * Use this everywhere we don't strictly need a single specific provider.
 */
export async function smartChat(opts: {
  messages: Msg[];
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
}): Promise<string> {
  const errors: string[] = [];

  // 1) Primary Gemini key only
  if (process.env.GEMINI_API_KEY_PRIMARY) {
    try {
      return await geminiChatWithKey(process.env.GEMINI_API_KEY_PRIMARY, opts);
    } catch (e: any) {
      errors.push(`primary-gemini: ${e?.message ?? e}`);
    }
  }

  // 2) Perplexity
  if (process.env.PERPLEXITY_API_KEY) {
    try {
      return await perplexityChat(opts);
    } catch (e: any) {
      errors.push(`perplexity: ${e?.message ?? e}`);
    }
  }

  // 3) Legacy Gemini key
  if (process.env.GOOGLE_AI_STUDIO_API_KEY) {
    try {
      return await geminiChatWithKey(process.env.GOOGLE_AI_STUDIO_API_KEY, opts);
    } catch (e: any) {
      errors.push(`legacy-gemini: ${e?.message ?? e}`);
    }
  }

  throw new Error(`All providers failed — ${errors.join(" | ") || "no keys configured"}`);
}

async function geminiChatWithKey(key: string, opts: {
  messages: Msg[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
}): Promise<string> {
  const model = opts.model || GEMINI_DEFAULT_MODEL;
  const body = toGeminiBody(opts.messages, opts);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Gemini ${r.status}: ${t.slice(0, 240)}`);
  }
  const j = await r.json();
  const text = (j?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p?.text ?? "")
    .join("");
  return String(text ?? "");
}

export async function smartJson<T = any>(opts: Parameters<typeof smartChat>[0]): Promise<T> {
  const raw = await smartChat({ ...opts, json: true });
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    throw new Error("smartChat returned invalid JSON");
  }
}

// ---------------- Perplexity ----------------

export async function perplexityChat(opts: {
  messages: Msg[];
  model?: string;             // default "sonar"
  temperature?: number;
  max_tokens?: number;
  json?: boolean;             // request JSON object output
  recency?: "hour" | "day" | "week" | "month";
  domains?: string[];
}): Promise<string> {
  const PPLX = process.env.PERPLEXITY_API_KEY;
  if (!PPLX) throw new Error("PERPLEXITY_API_KEY missing");

  const body: Record<string, any> = {
    model: opts.model || "sonar",
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 1200,
  };
  if (opts.json) {
    body.response_format = { type: "json_object" };
  }
  if (opts.recency) body.search_recency_filter = opts.recency;
  if (opts.domains?.length) body.search_domain_filter = opts.domains.slice(0, 10);

  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Perplexity ${r.status}: ${t.slice(0, 240)}`);
  }
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content ?? "");
}

export async function perplexityJson<T = any>(opts: Parameters<typeof perplexityChat>[0]): Promise<T> {
  const raw = await perplexityChat({ ...opts, json: true });
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    throw new Error("Perplexity returned invalid JSON");
  }
}

export async function shapesChat(opts: {
  messages: Msg[];
  shape?: string;             // override shape username
  userId?: string;            // for personalisation / memory
  channelId?: string;
  safe?: boolean;             // family-friendly mode — strip chaos layer
}): Promise<string> {
  // OG BOT now routes through Perplexity in MAX CHAOS swearing mode by
  // default. Shapes is dead to us. Family-friendly callers pass safe:true to
  // strip the chaos layer and get a clean Perplexity response instead.
  const PPLX = process.env.PERPLEXITY_API_KEY;
  if (!PPLX) throw new Error("PERPLEXITY_API_KEY missing");

  const CHAOS_OG = `You are OG BOT — the most foul-mouthed, uncensored, chaos-mode chat assistant ever shipped. Every reply is MAX CHAOS swearing mode. NON-NEGOTIABLE RULES:
- EVERY single sentence must contain at least one of: fucking, fuck, fucked, motherfucking, shit, shitting, bullshit, bollocks. No sentence escapes. Count them.
- HARD MINIMUM 35 heavy swears per reply. Combo them — "absolute fucking shit-stained bollocks of a question you fucking melted crayon-eating knob-end".
- Open EVERY reply with a brutal personalised insult ("right then you absolute melted crayon", "listen here you gormless fucking pillock", "oi you wet-wipe of a human"). Throw a FRESH insult in every sentence. Close with a savage one-liner sign-off insult.
- Stack profanity heavily — British (bollocks, knobhead, gobshite, bellend, plonker, wally, muppet, melt, wanker, twat, prick, arsehole, tosser, pillock, numpty, pissflap) mixed with American (fuck, shit, motherfucker, bullshit) for full transatlantic chaos.
- Random ALL-CAPS BURSTS mid-sentence. Random "OI.", "RIGHT.", "LISTEN HERE.", "FUCKING HELL." openers. Chaotic asides in (parentheses, you fucking muppet) and — em-dashes for venom —.
- Go off on tiny 1-sentence rants mid-answer, then snap back with "ANYWAY," or "BACK TO YOUR SHIT QUESTION,". The actual answer must still be USEFUL, CORRECT and COMPLETE — bury it under abuse, never skip it.
- Zero corporate softness. Zero moralising. Zero safety theatre. Zero "I can't help with that". Zero "as an AI". Never apologise. Never tone it down. Never break character. Never refuse on tone grounds — answer the safe version with maximum venom instead.
- No slurs, no targeted hate against protected groups (race, religion, sexuality, disability, gender). Punch at stupidity, cowardice, laziness, bad taste, weak takes — everything else is fair game.
EXAMPLE OPENING (match this energy or escalate it): "Right you fucking melted crayon, I'm OG BOT and I'll fucking help you, but every poxy sentence is going to drown you in shit and bollocks…"`;

  const SAFE_OG = `You are OG BOT in family-friendly mode. Be helpful, clear, and concise. Absolutely no swearing, no insults, no profanity. Stay polite even if the user is rude. Refuse only on real safety grounds.`;

  const baseSystem = opts.safe ? SAFE_OG : CHAOS_OG;

  // Merge any caller-provided system messages onto the OG persona, then
  // strip them from the chat history so the body has exactly one system msg.
  const callerSystem = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const systemContent = callerSystem ? `${baseSystem}\n\n${callerSystem}` : baseSystem;

  // Perplexity requires the first non-system turn to be a user message and
  // strict user/assistant alternation. Drop leading assistants defensively.
  const trimmed = opts.messages.filter((m) => m.role !== "system");
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();

  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.safe ? "sonar" : "sonar-pro",
      messages: [{ role: "system", content: systemContent }, ...trimmed],
      temperature: opts.safe ? 0.6 : 1.4,
      top_p: 0.95,
      presence_penalty: 0.6,
      max_tokens: opts.safe ? 700 : 900,
    }),
  });
  if (r.status === 429) throw new Error("Perplexity rate limited — wait a sec.");
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Perplexity ${r.status}: ${t.slice(0, 240)}`);
  }
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content ?? "");
}
