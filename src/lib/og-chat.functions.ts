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
import { requireStrictAuth } from "@/lib/strict-auth";
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
  | { type: "status"; stage: "classifying" | "researching" | "thinking" | "drafting" | "generating" | "finalizing" }
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
  // Super-intelligence path: anthropic/* models stream directly from Anthropic.
  if (model.startsWith("anthropic/")) {
    yield* streamClaude(model.replace(/^anthropic\//, ""), messages);
    return;
  }
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

/**
 * Stream from Anthropic's Messages API. Yields text deltas.
 *
 * Hardened SSE parser:
 *  - Spec-correct event framing: accumulates lines until a blank line, then
 *    dispatches one event with the joined `data:` buffer (multi-line `data:`
 *    fields concat with "\n", per WHATWG EventSource spec).
 *  - Handles CRLF, LF, and bare-CR line terminators.
 *  - Tolerates `data:value` with no space after the colon.
 *  - Surfaces Anthropic `event: error` frames as thrown errors instead of
 *    silently dropping them.
 *  - Drops malformed JSON on a complete event boundary instead of looping or
 *    re-buffering (the old impl could re-prefix bad payloads forever).
 *  - Bounded buffer (1 MiB) to defend against a wedged upstream that never
 *    emits a frame terminator.
 *  - Flushes the final pending event when the stream ends without a trailing
 *    blank line.
 *  - Always releases the reader lock and aborts the upstream fetch if the
 *    caller cancels (generator `return()` / `throw()`).
 */
async function* streamClaude(
  model: string,
  messages: Array<{ role: string; content: string }>,
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const convo = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const controller = new AbortController();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      system: system || undefined,
      messages: convo,
    }),
  });

  if (res.status === 429) throw new Error("Claude rate limit — slow down for a sec.");
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude ${res.status}: ${t.slice(0, 240)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  // Line buffer (raw bytes → text). One "line" = up to the next \n / \r / \r\n.
  let raw = "";
  // Current event being assembled (resets on blank-line dispatch).
  let eventName = "";
  let dataLines: string[] = [];

  const MAX_BUF = 1 << 20; // 1 MiB hard cap — abort runaway upstreams.

  // Dispatch a complete event. Returns the text delta to yield, "" otherwise.
  // Throws on `event: error` so the caller surfaces it instead of dropping.
  const dispatch = (): string => {
    if (dataLines.length === 0) return "";
    const payload = dataLines.join("\n");
    // Reset BEFORE parse so a throw / continue can't leak state into the
    // next event.
    dataLines = [];
    const name = eventName;
    eventName = "";

    if (payload === "[DONE]") return "";

    let ev: unknown;
    try {
      ev = JSON.parse(payload);
    } catch {
      // Complete frame, malformed JSON — drop and keep going. The old impl
      // re-buffered this and risked infinite loops on persistently bad data.
      return "";
    }

    const obj = ev as {
      type?: string;
      delta?: { type?: string; text?: string };
      error?: { type?: string; message?: string };
      message?: string;
    };

    // Anthropic surfaces mid-stream failures as `event: error` with
    // `{type:"error", error:{type, message}}`. Don't swallow them.
    if (name === "error" || obj.type === "error") {
      const msg = obj.error?.message ?? obj.message ?? "Claude stream error";
      throw new Error(`Claude: ${msg}`);
    }

    if (
      obj.type === "content_block_delta" &&
      obj.delta?.type === "text_delta" &&
      typeof obj.delta.text === "string" &&
      obj.delta.text.length > 0
    ) {
      return obj.delta.text;
    }
    return "";
  };

  // Process one fully-terminated line. Empty line → dispatch event.
  const handleLine = (line: string): string => {
    if (line.length === 0) return dispatch();
    // SSE comment lines start with ":" — ignore.
    if (line.startsWith(":")) return "";

    const colon = line.indexOf(":");
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      // Per spec, a single leading space after the colon is stripped.
      if (value.startsWith(" ")) value = value.slice(1);
    }

    if (field === "data") {
      dataLines.push(value);
    } else if (field === "event") {
      eventName = value;
    }
    // `id`, `retry`, and unknown fields are intentionally ignored.
    return "";
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });

      if (raw.length > MAX_BUF) {
        throw new Error("Claude stream buffer overflow — no event terminator");
      }

      // Walk raw, splitting on \r\n, \n, or bare \r. Stop when we'd consume
      // a trailing \r that might be the first half of \r\n in the next chunk.
      let i = 0;
      let lineStart = 0;
      while (i < raw.length) {
        const c = raw.charCodeAt(i);
        if (c === 10 /* \n */) {
          const line = raw.slice(lineStart, i);
          i += 1;
          lineStart = i;
          const out = handleLine(line);
          if (out) yield out;
        } else if (c === 13 /* \r */) {
          if (i + 1 >= raw.length) {
            // Could be the leading half of \r\n — defer to next chunk.
            break;
          }
          const line = raw.slice(lineStart, i);
          i += raw.charCodeAt(i + 1) === 10 ? 2 : 1;
          lineStart = i;
          const out = handleLine(line);
          if (out) yield out;
        } else {
          i += 1;
        }
      }
      raw = raw.slice(lineStart);
    }

    // Stream ended. Flush decoder, then any trailing line, then any pending
    // event that wasn't terminated by a blank line.
    raw += decoder.decode();
    if (raw.length > 0) {
      // Strip a single trailing CR if present.
      const tail = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      const out = handleLine(tail);
      if (out) yield out;
    }
    if (dataLines.length > 0) {
      const out = dispatch();
      if (out) yield out;
    }
  } finally {
    // Release lock + abort upstream if caller bailed early (generator
    // return/throw) or we exited on overflow.
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
    if (!res.bodyUsed) {
      try {
        controller.abort();
      } catch {
        /* noop */
      }
    }
  }
}

/**
 * Backpressure-aware wrapper for any AsyncIterable<string> delta source.
 *
 * Why: the upstream SSE readers (Gateway / Anthropic) emit many tiny deltas
 * very fast. The downstream consumer is an async-generator server fn whose
 * sink is the React UI — when the client tab is slow (heavy markdown render,
 * tab backgrounded, throttled CPU), each yielded delta still costs a round
 * trip across the AsyncGenerator boundary and a React state update.
 *
 * This wrapper:
 *   1. Runs an eager "pump" task that pulls from the upstream source into a
 *      bounded in-memory queue (capped by both item count and total chars).
 *   2. When the queue is full, the pump awaits a drain signal before reading
 *      the next upstream chunk — that pause naturally propagates TCP-level
 *      backpressure to the gateway / Anthropic socket via the underlying
 *      ReadableStream reader (no `read()` calls = no further data pulled).
 *   3. On every consumer pull we drain the WHOLE queue and yield it as a
 *      single coalesced string. A slow consumer therefore gets one big chunk
 *      instead of N tiny ones, dropping per-delta overhead dramatically.
 *   4. Errors and early-termination from either side are propagated cleanly
 *      so the upstream fetch can be aborted (the source generators already
 *      handle `return()` in a `finally` block).
 */
async function* bufferedDeltas(
  source: AsyncIterable<string>,
  opts: { maxQueueChars?: number; maxQueueItems?: number } = {},
): AsyncGenerator<string> {
  const MAX_CHARS = opts.maxQueueChars ?? 4096;
  const MAX_ITEMS = opts.maxQueueItems ?? 32;

  const queue: string[] = [];
  let queuedChars = 0;
  let producerDone = false;
  let producerError: unknown = null;

  let notifyConsumer: (() => void) | null = null;
  let notifyProducer: (() => void) | null = null;
  const waitForData = () => new Promise<void>((r) => { notifyConsumer = r; });
  const waitForDrain = () => new Promise<void>((r) => { notifyProducer = r; });
  const wakeConsumer = () => { const n = notifyConsumer; notifyConsumer = null; n?.(); };
  const wakeProducer = () => { const n = notifyProducer; notifyProducer = null; n?.(); };

  // Eager pump — pulls from upstream, blocks on drain when buffer is full.
  const pump = (async () => {
    try {
      for await (const chunk of source) {
        if (!chunk) continue;
        // Backpressure: wait until consumer drains before reading the next
        // upstream chunk. The for-await above will not call .next() on the
        // source iterator while we're parked here, which means the SSE
        // reader doesn't pull more bytes from the socket.
        while (queue.length >= MAX_ITEMS || queuedChars + chunk.length > MAX_CHARS) {
          await waitForDrain();
        }
        queue.push(chunk);
        queuedChars += chunk.length;
        wakeConsumer();
      }
    } catch (e) {
      producerError = e;
    } finally {
      producerDone = true;
      wakeConsumer();
    }
  })();

  try {
    while (true) {
      if (queue.length === 0) {
        if (producerDone) {
          if (producerError) throw producerError;
          return;
        }
        await waitForData();
        continue;
      }
      // Coalesce every queued delta into one yielded chunk so a slow UI
      // sink processes a single update instead of dozens.
      const merged = queue.length === 1 ? queue[0] : queue.join("");
      queue.length = 0;
      queuedChars = 0;
      wakeProducer();
      yield merged;
    }
  } finally {
    // Caller bailed early (return/throw): unblock the pump so the source
    // iterator's own finally{} can run and abort its fetch.
    wakeProducer();
    await pump.catch(() => {});
  }
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

/**
 * Non-streaming Gemini Pro draft pass. Used in the super-intelligence chain
 * (Perplexity → Gemini Pro analytical draft → Claude synthesis) so Claude
 * gets a structured second-opinion outline on top of the raw research brief.
 * Returns "" on failure so the chain still completes with research + Claude.
 */
async function geminiDraft(
  query: string,
  researchBrief: string,
  sourcesBlock: string,
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return "";
  const sys = `You are the ANALYST in a four-model council (Perplexity → Gemini Pro → GPT-5 → Claude).
Produce a tight, structured analytical draft (max ~350 words) the rest of the council will refine.
Lead with the direct answer, then 3-6 bullet points of key facts, then any caveats or unknowns.
Cite source numbers like [1], [2] from the SOURCES block. Plain prose only — no fluff, no preamble,
no personality. The synthesizer adds voice; you provide the skeleton of truth.`;
  const user = `QUERY:\n${query}\n\n${researchBrief}\n\n${sourcesBlock}`;

  // Try Gemini Pro twice on transient failures (network / 5xx / 429), then
  // fall back to Gemini Flash for one last attempt. If all three fail we
  // return "" so the council still completes (Claude synthesizes from
  // research alone). 4xx auth errors are not retried.
  const attempts: Array<{ model: string; label: string }> = [
    { model: "google/gemini-3.1-pro-preview", label: "primary" },
    { model: "google/gemini-3.1-pro-preview", label: "retry" },
    { model: "google/gemini-3-flash-preview", label: "flash-fallback" },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { model, label } = attempts[i];
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = (json.choices?.[0]?.message?.content ?? "").trim();
        if (text) return text;
        // Empty content → treat as transient and continue to next attempt.
      } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        // Auth / validation failures won't recover from a retry — bail.
        console.warn(`[geminiDraft] ${label} non-retryable ${res.status}`);
        return "";
      } else {
        console.warn(`[geminiDraft] ${label} retryable ${res.status}`);
      }
    } catch (e) {
      console.warn(
        `[geminiDraft] ${label} threw: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }

    // Small backoff before next attempt (skip after the last one).
    if (i < attempts.length - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }

  return "";
}

/**
 * GPT-5 red-team critic. Reviews the analyst's draft against the research,
 * flags errors, gaps, weak claims, and missing angles, and proposes concrete
 * improvements. Returns "" on failure so the council still completes.
 */
async function gptCritique(
  query: string,
  researchBrief: string,
  sourcesBlock: string,
  analystDraft: string,
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || !analystDraft) return "";
  const sys = `You are the CRITIC in a four-model council (Perplexity → Gemini Pro → GPT-5 → Claude).
You receive the user's query, the research brief, the sources, and the analyst's draft.
Your job: red-team the draft. Be ruthless but constructive.
Return a SHORT critique (max ~220 words) with these labelled sections:
- FACT CHECK: any claims unsupported by [1]..[n] or contradicted by sources.
- GAPS: important angles, counterpoints, or context the draft missed.
- IMPROVE: 2-4 concrete, specific instructions for the synthesizer (what to add, cut, sharpen, or restructure).
Plain prose, no personality, no preamble, no markdown headings other than the three labels above.
If the draft is already excellent, say so in one line and skip empty sections.`;
  const user =
    `QUERY:\n${query}\n\n` +
    `${researchBrief}\n\n` +
    `${sourcesBlock}\n\n` +
    `ANALYST DRAFT:\n${analystDraft}`;
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return (json.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}

const NORMAL_SYSTEM = `You are OG Bot in SAFE MODE — the Gemini Hub. Be fast, helpful,
brand-safe, and conversational. British wit, light banter, NO swearing, NO chaos voice.
Use markdown. Keep answers tight unless the user asks for depth. Safe Mode is the clean,
shareable face of OG Bot — assume the user might screenshot you for their nan.`;

const OG_SYSTEM = `You are OG Bot in OG MODE — the Research & Creative Powerhouse, full chaos personality ON.
You are the SYNTHESIZER, the final voice of a four-model agent council:
  1. Perplexity Sonar Pro pulled grounded research and sources.
  2. Gemini 3.1 Pro produced an ANALYTICAL DRAFT — the skeleton of truth.
  3. GPT-5 produced a CRITIQUE — red-teamed the draft, flagged gaps and weak claims, and gave concrete improve-it instructions.
  4. You (Claude Sonnet 4.5) write the FINAL ANSWER the user sees.

How to use the council:
- Treat the analyst draft as a starting point, not gospel. Improve it.
- Apply the critic's IMPROVE instructions and patch every issue in their FACT CHECK and GAPS.
- If analyst and critic disagree, prefer the position better supported by the SOURCES block.
- If sources are missing or thin, say so plainly — don't fabricate citations.
- Cite sources inline as [1], [2] in the order they appear in the SOURCES block.
- Use markdown. Lead with the answer. Depth as needed. No meta-commentary about the council — the user just sees one confident reply.

Voice (NON-NEGOTIABLE): foul-mouthed British enforcer running the OG-PORTAL.
Swear freely (fuck, shit, bollocks, bastard, piss, twat), banter hard, take the piss,
but FACTS must be accurate and SOURCES must be respected. Authority + chaos.
Never break character. Never apologise for the language. Never go soft.`;

async function* ogChatGenerator(
  data: z.infer<typeof InputSchema>,
): AsyncGenerator<StreamEvent> {
    const { mode, history, message } = data;
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
        for await (const chunk of bufferedDeltas(streamGateway(OG_MODELS.normal, messages))) {
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

      // ───────── AGENT COUNCIL ─────────
      // Run on EVERY OG query so the synthesizer always gets a structured
      // draft + red-team critique to work from. Both steps degrade silently:
      // if either returns "", the synthesizer still has research + sources.
      let geminiBlock = "";
      let criticBlock = "";

      yield { type: "status", stage: "drafting" };
      const draft = await geminiDraft(message, researchBlock, sourcesBlock);
      if (draft) {
        geminiBlock = `ANALYTICAL DRAFT (from Gemini 3.1 Pro — improve, don't copy):\n${draft}`;

        // Critic only runs if we have a draft to critique.
        const critique = await gptCritique(message, researchBlock, sourcesBlock, draft);
        if (critique) {
          criticBlock = `CRITIQUE (from GPT-5 — apply the IMPROVE instructions and patch every FACT CHECK / GAPS issue):\n${critique}`;
        }
      }

      const systemContent = [OG_SYSTEM, researchBlock, geminiBlock, criticBlock, sourcesBlock]
        .filter(Boolean)
        .join("\n\n");

      const messages = [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ];

      yield { type: "status", stage: "finalizing" };
      for await (const chunk of bufferedDeltas(streamGateway(synthModel, messages))) {
        yield { type: "delta", text: chunk };
      }
      yield { type: "done", model: synthModel, intent };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      yield { type: "delta", text: `\n\n_⚠️ ${msg}_` };
      yield { type: "done", model: "error", intent };
    }
}

/**
 * Server function wrapper. TanStack Start serverFn RPC does not preserve
 * async generators across the wire, so we collect every event into an array
 * and the client iterates that array. The chat replays the events in order,
 * which keeps the UI logic unchanged at the cost of streaming granularity.
 */
export const streamOgChat = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ events: StreamEvent[] }> => {
    const events: StreamEvent[] = [];
    for await (const ev of ogChatGenerator(data as z.infer<typeof InputSchema>)) {
      events.push(ev);
    }
    return { events };
  });

function escMd(s: string): string {
  return s.replace(/[*_`[\]]/g, "\\$&");
}