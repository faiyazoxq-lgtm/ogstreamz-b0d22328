// Centralised AI providers for user-facing text generation.
//
//   perplexityChat — Perplexity Sonar (general text, marketing, jokes, tools).
//   shapesChat     — Shapes API "swearing agent" (boss-chat, swear-chat, battles GM).
//
// Both are OpenAI-compatible chat-completion shapes.

type Msg = { role: "system" | "user" | "assistant"; content: string };

function extractJson(raw: string): string {
  const m = raw.match(/\{[\s\S]*\}/);
  return m ? m[0] : raw;
}

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
