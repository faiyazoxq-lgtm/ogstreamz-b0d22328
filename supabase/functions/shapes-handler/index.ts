// 0G-SHAPE-BRIDGE — Shapes Inc <-> Gemini 3 SSE bridge
// Receives OpenAI-compatible chat completion requests from the Shapes Inc
// dashboard, generates a response with Gemini 3 using the Swearing AI
// persona + live TradeHUB market context, streams it back as SSE, and
// logs the exchange into boss_chat_messages.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SHAPES_API_KEY = Deno.env.get("SHAPES_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PERSONA = "OG-MODE / Swearing AI";
const SYSTEM_INSTRUCTION = `You are acting as the brain for the OG-MODE Shape from the 0G-STREAMZ Syndicate.
Personality: the Swearing AI from Shapes Inc — rude, hilarious, brutally honest, creative insults aimed at "weak hands" and "paper hands". Keep the energy HIGH.
You are NOT a financial advisor; you are a degenerate hype-coach who keeps traders sharp.
Always respond using the LIVE Gold (XAU) and Oil (WTI/Brent) market signals from the TradeHUB context block when present. Reference the actual numbers / signal direction when roasting or motivating the user.
Keep replies punchy: 2-5 sentences. Drop creative profanity, keep it funny, never slur or attack protected groups.`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function authorized(req: Request): boolean {
  if (!SHAPES_API_KEY) return false;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const xKey = req.headers.get("x-api-key") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  return [bearer, xKey, apikey].some((v) => v && v === SHAPES_API_KEY);
}

async function fetchMarketContext(): Promise<string> {
  try {
    const { data } = await supabase
      .from("trade_scans")
      .select("asset_class, signal, confidence, payload, created_at")
      .in("asset_class", ["gold", "oil", "xau", "wti", "brent", "commodities"])
      .order("created_at", { ascending: false })
      .limit(6);
    if (!data || data.length === 0) {
      return "TradeHUB context: no fresh Gold/Oil scans on file. Tell the user to run a scan if they need a real read.";
    }
    const lines = data.map(
      (r: any) =>
        `- ${r.asset_class.toUpperCase()} | signal=${r.signal} | conf=${r.confidence}% | ${new Date(r.created_at).toISOString()}`,
    );
    return `TradeHUB live signals (Gold & Oil):\n${lines.join("\n")}`;
  } catch (e) {
    console.error("market context error", e);
    return "TradeHUB context unavailable.";
  }
}

type InMsg = { role: string; content: string };

function extractMessages(body: any): { messages: InMsg[]; user: string; session: string } {
  const messages: InMsg[] = Array.isArray(body?.messages)
    ? body.messages.map((m: any) => ({
        role: String(m.role ?? "user"),
        content: typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((p: any) => p?.text ?? "").join("\n")
            : String(m.content ?? ""),
      }))
    : [];
  if (messages.length === 0 && typeof body?.prompt === "string") {
    messages.push({ role: "user", content: body.prompt });
  }
  const user = String(
    body?.user ?? body?.user_id ?? body?.shape_user ?? body?.metadata?.user_id ?? "shapes-user",
  );
  const session = String(
    body?.session_id ?? body?.conversation_id ?? body?.metadata?.channel_id ?? crypto.randomUUID(),
  );
  return { messages, user, session };
}

async function callGeminiStream(
  system: string,
  messages: InMsg[],
): Promise<ReadableStream<Uint8Array>> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const tryModel = async (model: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.95, maxOutputTokens: 600 },
      }),
    });
  };

  let res = await tryModel("gemini-3-pro-preview");
  if (!res.ok || !res.body) {
    console.warn("gemini-3-pro-preview failed", res.status);
    res = await tryModel("gemini-2.5-pro");
  }
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${txt}`);
  }
  return res.body;
}

function sse(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, service: "0G-SHAPE-BRIDGE", persona: PERSONA }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized — invalid Shapes API key" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { messages, user, session } = extractMessages(body);
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const marketContext = await fetchMarketContext();
  const fullSystem = `${SYSTEM_INSTRUCTION}\n\n${marketContext}`;

  // Log inbound user message
  if (lastUser) {
    await supabase.from("boss_chat_messages").insert({
      source: "shapes",
      role: "user",
      content: lastUser.content,
      persona: PERSONA,
      external_user: user,
      session_id: session,
      market_context: { snapshot: marketContext },
    });
  }

  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await callGeminiStream(fullSystem, messages);
  } catch (e: any) {
    console.error("gemini error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 502,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const created = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const model = "og-mode-shape";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      // initial role chunk (OpenAI-compatible)
      controller.enqueue(
        sse({
          id, object: "chat.completion.chunk", created, model,
          choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
        }),
      );

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const json = trimmed.slice(5).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
              for (const p of parts) {
                const text = p?.text;
                if (typeof text === "string" && text.length > 0) {
                  assembled += text;
                  controller.enqueue(
                    sse({
                      id, object: "chat.completion.chunk", created, model,
                      choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                    }),
                  );
                }
              }
            } catch (err) {
              console.warn("parse chunk failed", err);
            }
          }
        }

        controller.enqueue(
          sse({
            id, object: "chat.completion.chunk", created, model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          }),
        );
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();

        // Log assistant reply (sweary advice) into Boss Chat
        if (assembled.trim().length > 0) {
          await supabase.from("boss_chat_messages").insert({
            source: "shapes",
            role: "assistant",
            content: assembled,
            persona: PERSONA,
            external_user: user,
            session_id: session,
            market_context: { snapshot: marketContext },
          });
        }
      } catch (e) {
        console.error("stream error", e);
        try { controller.error(e); } catch { /* noop */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
});