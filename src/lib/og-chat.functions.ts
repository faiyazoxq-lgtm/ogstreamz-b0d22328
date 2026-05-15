// OG Bot streaming chat — async-generator server fn that yields a stream of
// typed events to the chat UI:
//
//   { type: "status",   stage }
//   { type: "research", source }
//   { type: "media",    kind, prompt, status, dataUrl?, providerKey? }
//   { type: "delta",    text }
//   { type: "done",     model, intent }
//
// Normal mode → straight stream from gemini-3-flash-preview.
// OG mode    → classify intent, dispatch to media tool OR research-then-synth chain.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  classifyIntent,
  pickSynthesisModel,
  OG_MODELS,
  type Intent,
  type OgMode,
} from "./og-model-router.server";
import { deepResearch, type ResearchSource } from "./perplexity.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview"; // Nano Banana 2

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type StreamEvent =
  | { type: "status"; stage: "classifying" | "researching" | "thinking" | "generating" | "finalizing" }
  | { type: "research"; source: ResearchSource }
  | {
      type: "media";
      kind: "image" | "music" | "video";
      prompt: string;
      status: "ready" | "placeholder" | "error";
      dataUrl?: string;
      providerKey?: string; // env var name to add for the placeholder providers
      providerLabel?: string;
      message?: string;
    }
  | { type: "delta"; text: string }
  | { type: "done"; model: string; intent: Intent };

const InputSchema = z.object({
  mode: z.enum(["normal", "og"]),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(40)
    .default([]),
  message: z.string().min(1).max(4000),
});

/**
 * SSE parser. Yields each `delta.content` chunk from an OpenAI-compatible
 * streaming response body.
 */
async function* sseDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) yield c;
      } catch {
        // partial JSON: stash it back on the buffer
        buf = "data: " + payload + "\n" + buf;
        break;
      }
    }
  }
}

async function* streamGateway(
  model: string,
  messages: Array<{ role: string; content: string }>,
): AsyncGenerator<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (res.status === 429) throw new Error("Rate limit exceeded — slow down for a sec.");
  if (res.status === 402) throw new Error("AI credits exhausted. Top up the workspace.");
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${t.slice(0, 240)}`);
  }

  yield* sseDeltas(res.body);
}

/** Single-shot image generation via Nano Banana 2. Returns a data URL. */
async function generateImage(prompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Image gateway ${res.status}: ${t.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        images?: Array<{ image_url?: { url?: string } }>;
      };
    }>;
  };
  const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("Image model returned no image");
  return url;
}

const NORMAL_SYSTEM = `You are OG Bot in NORMAL mode — the Gemini Hub. Be fast, helpful,
brand-safe, and conversational. British wit, light banter, no swearing. Use markdown.
Keep answers tight unless the user asks for depth.`;

const OG_SYSTEM = `You are OG Bot in OG MODE — the Research & Creative Powerhouse.
You receive grounded research from Perplexity Sonar Pro in the system message.
Synthesize an authoritative, citation-aware answer. Use markdown. Cite sources
inline as [1], [2] mapping to the order they appear in the SOURCES block.
Voice: foul-mouthed British enforcer — swear freely (fuck, shit, bollocks),
banter hard, but the FACTS must be accurate and the SOURCES must be respected.`;

export const streamOgChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async function* ({ data }): AsyncGenerator<StreamEvent> {
    const { mode, history, message } = data as z.infer<typeof InputSchema>;
    const intent = classifyIntent(message);

    try {
      yield { type: "status", stage: "classifying" };

      // ---------- Media branches (OG mode only) ----------
      if (mode === "og" && intent === "image") {
        yield { type: "status", stage: "generating" };
        try {
          const url = await generateImage(message);
          yield { type: "media", kind: "image", prompt: message, status: "ready", dataUrl: url };
          yield { type: "delta", text: `Image generated with **Nano Banana 2** for prompt: _${escMd(message)}_` };
        } catch (e) {
          yield {
            type: "media",
            kind: "image",
            prompt: message,
            status: "error",
            message: e instanceof Error ? e.message : "Image generation failed",
          };
        }
        yield { type: "done", model: IMAGE_MODEL, intent };
        return;
      }

      if (mode === "og" && intent === "music") {
        yield {
          type: "media",
          kind: "music",
          prompt: message,
          status: "placeholder",
          providerKey: "LYRIA_API_KEY",
          providerLabel: "Lyria 3",
          message: "Music generation isn't wired yet — drop a Lyria 3 (or Suno) API key and I'll plug it in.",
        };
        yield { type: "delta", text: "I'd cook a track here, but the **Lyria 3** API key isn't set yet. Use the card above to add one." };
        yield { type: "done", model: "lyria3-placeholder", intent };
        return;
      }

      if (mode === "og" && intent === "video") {
        yield {
          type: "media",
          kind: "video",
          prompt: message,
          status: "placeholder",
          providerKey: "VEO_API_KEY",
          providerLabel: "Veo 3",
          message: "Video generation isn't wired yet — drop a Veo 3 (or Replicate) API key and I'll plug it in.",
        };
        yield { type: "delta", text: "Video tool's still in the box. Add a **Veo 3** API key on the card above and I'll fire it up." };
        yield { type: "done", model: "veo3-placeholder", intent };
        return;
      }

      // ---------- Chat branches ----------
      if (mode === "normal") {
        yield { type: "status", stage: "thinking" };
        const messages = [
          { role: "system", content: NORMAL_SYSTEM },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: message },
        ];
        for await (const chunk of streamGateway(OG_MODELS.normal, messages)) {
          yield { type: "delta", text: chunk };
        }
        yield { type: "done", model: OG_MODELS.normal, intent };
        return;
      }

      // OG mode chat: Perplexity → Gemini Pro / GPT-5.5 synth.
      yield { type: "status", stage: "researching" };
      let research: { sources: ResearchSource[]; answer: string } = { sources: [], answer: "" };
      try {
        research = await deepResearch(message);
        for (const src of research.sources) yield { type: "research", source: src };
      } catch (e) {
        yield {
          type: "research",
          source: {
            url: "",
            title: "Research failed",
            snippet: e instanceof Error ? e.message : "Perplexity unavailable",
          },
        };
      }

      yield { type: "status", stage: "thinking" };
      const synthModel = pickSynthesisModel(intent);

      const sourcesBlock = research.sources.length
        ? "SOURCES:\n" +
          research.sources
            .map((s, i) => `[${i + 1}] ${s.title ?? s.url}${s.url ? ` — ${s.url}` : ""}${s.snippet ? `\n    ${s.snippet}` : ""}`)
            .join("\n")
        : "SOURCES: (none — research step returned nothing; answer from general knowledge and say so).";

      const researchBlock = research.answer
        ? `RESEARCH BRIEF (from Perplexity Sonar Pro):\n${research.answer}`
        : "";

      const messages = [
        { role: "system", content: `${OG_SYSTEM}\n\n${researchBlock}\n\n${sourcesBlock}` },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ];

      yield { type: "status", stage: "finalizing" };
      for await (const chunk of streamGateway(synthModel, messages)) {
        yield { type: "delta", text: chunk };
      }
      yield { type: "done", model: synthModel, intent };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      yield { type: "delta", text: `\n\n_⚠️ ${msg}_` };
      yield { type: "done", model: "error", intent };
    }
  });

function escMd(s: string): string {
  return s.replace(/[*_`[\]]/g, "\\$&");
}