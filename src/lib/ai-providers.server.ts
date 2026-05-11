// Centralised AI providers for user-facing text generation.
//
//   smartChat     — tries GEMINI_API_KEY_PRIMARY → Perplexity → legacy GOOGLE_AI_STUDIO_API_KEY,
//                   in that order, so we burn the new Gemini quota first and only
//                   fall back when something explodes.
//   geminiChat    — direct Gemini call with primary→fallback key chain.
//   perplexityChat — Perplexity Sonar (general text, marketing, jokes, tools).
//   shapesChat     — Shapes API "swearing agent" (boss-chat, swear-chat, battles GM).
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
}): Promise<string> {
  const KEY = process.env.SHAPES_API_KEY;
  if (!KEY) throw new Error("SHAPES_API_KEY missing");

  const shape = opts.shape || process.env.SHAPES_SHAPE_USERNAME || "swearing-ai";
  const model = shape.startsWith("shapesinc/") ? shape : `shapesinc/${shape}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };
  if (opts.userId) headers["X-User-Id"] = opts.userId;
  if (opts.channelId) headers["X-Channel-Id"] = opts.channelId;

  const r = await fetch("https://api.shapes.inc/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages: opts.messages }),
  });
  if (r.status === 429) throw new Error("Shapes rate limited — wait a sec.");
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Shapes ${r.status}: ${t.slice(0, 240)}`);
  }
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content ?? "");
}
