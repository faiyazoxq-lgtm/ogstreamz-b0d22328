import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callClaude } from "./claude.server";
import { ClaudeInputSchema } from "./claude.functions";

// ─────────────────────────────────────────────────────────────────────────────
// askClaude is a TanStack serverFn protected by `requireStrictAuth` middleware.
// We can't drive the middleware in a pure unit test without the server harness,
// so we cover the three layers independently:
//
//   1. Auth gating  — assert the serverFn module wires requireStrictAuth at the
//                     middleware boundary (regression guard against accidental
//                     removal during refactors).
//   2. Zod validation — test the exported schema directly.
//   3. Anthropic API failures — test the shared callClaude helper that
//                               askClaude delegates to, by stubbing global fetch.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
});

// ─────────────────────────────────── 1. AUTH GATING ──────────────────────────
describe("askClaude — auth gating", () => {
  const source = readFileSync(
    resolve(__dirname, "claude.functions.ts"),
    "utf8",
  );

  it("wires requireStrictAuth as middleware on the serverFn", () => {
    expect(source).toMatch(/import\s*\{\s*requireStrictAuth\s*\}/);
    expect(source).toMatch(/\.middleware\(\s*\[\s*requireStrictAuth\s*\]\s*\)/);
  });

  it("declares the askClaude serverFn with POST method", () => {
    expect(source).toMatch(
      /createServerFn\(\s*\{\s*method:\s*["']POST["']\s*\}\s*\)/,
    );
  });
});

// ─────────────────────────────────── 2. ZOD VALIDATION ───────────────────────
describe("askClaude — input validation", () => {
  it("rejects missing prompt", () => {
    const r = ClaudeInputSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects empty prompt", () => {
    const r = ClaudeInputSchema.safeParse({ prompt: "" });
    expect(r.success).toBe(false);
  });

  it("rejects non-string prompt", () => {
    const r = ClaudeInputSchema.safeParse({ prompt: 123 });
    expect(r.success).toBe(false);
  });

  it("rejects prompt longer than 8000 chars", () => {
    const r = ClaudeInputSchema.safeParse({ prompt: "a".repeat(8001) });
    expect(r.success).toBe(false);
  });

  it("rejects system longer than 4000 chars", () => {
    const r = ClaudeInputSchema.safeParse({
      prompt: "hi",
      system: "s".repeat(4001),
    });
    expect(r.success).toBe(false);
  });

  it("rejects model longer than 80 chars", () => {
    const r = ClaudeInputSchema.safeParse({
      prompt: "hi",
      model: "m".repeat(81),
    });
    expect(r.success).toBe(false);
  });

  it("rejects maxTokens below 1", () => {
    const r = ClaudeInputSchema.safeParse({ prompt: "hi", maxTokens: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects maxTokens above 8000", () => {
    const r = ClaudeInputSchema.safeParse({ prompt: "hi", maxTokens: 8001 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer maxTokens", () => {
    const r = ClaudeInputSchema.safeParse({ prompt: "hi", maxTokens: 1.5 });
    expect(r.success).toBe(false);
  });

  it("applies defaults for model and maxTokens", () => {
    const r = ClaudeInputSchema.parse({ prompt: "hello" });
    expect(r.model).toBe("claude-sonnet-4-5");
    expect(r.maxTokens).toBe(1024);
    expect(r.system).toBeUndefined();
  });

  it("accepts a fully-specified valid payload", () => {
    const r = ClaudeInputSchema.parse({
      prompt: "hi",
      system: "be brief",
      model: "claude-opus-4",
      maxTokens: 2048,
    });
    expect(r).toEqual({
      prompt: "hi",
      system: "be brief",
      model: "claude-opus-4",
      maxTokens: 2048,
    });
  });
});

// ─────────────────────────────────── 3. ANTHROPIC FAILURES ───────────────────
describe("callClaude — Anthropic API failure cases", () => {
  it("returns ok:false when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });

    expect(result).toEqual({
      ok: false,
      error: "ANTHROPIC_API_KEY is not configured",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok:false with status + truncated body on non-OK response", async () => {
    const longBody = "x".repeat(500);
    globalThis.fetch = vi.fn(async () =>
      new Response(longBody, { status: 500 }),
    ) as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.startsWith("Claude 500: ")).toBe(true);
      // Body is sliced to 200 chars.
      expect(result.error.length).toBeLessThanOrEqual("Claude 500: ".length + 200);
    }
  });

  it("returns ok:false on rate limit (429)", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("rate limited", { status: 429 }),
    ) as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Claude 429:/);
  });

  it("returns ok:false on auth failure (401)", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("invalid api key", { status: 401 }),
    ) as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Claude 401:/);
  });

  it("returns ok:false when fetch throws (network error)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });
    expect(result).toEqual({ ok: false, error: "ECONNRESET" });
  });

  it("returns ok:false with generic error when fetch throws non-Error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw "weird";
    }) as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });
    expect(result).toEqual({ ok: false, error: "Claude request failed" });
  });

  it("extracts and joins text content blocks on success", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, {
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world" },
        ],
      }),
    ) as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });
    expect(result).toEqual({ ok: true, text: "Hello world" });
  });

  it("ignores non-text content blocks", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, {
        content: [
          { type: "tool_use", id: "t1" },
          { type: "text", text: "answer" },
        ],
      }),
    ) as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });
    expect(result).toEqual({ ok: true, text: "answer" });
  });

  it("returns ok:true with empty text on malformed/empty content", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, { content: [] }),
    ) as unknown as typeof fetch;

    const result = await callClaude({ prompt: "hi" });
    expect(result).toEqual({ ok: true, text: "" });
  });

  it("sends correct Anthropic headers and body", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse(200, { content: [{ type: "text", text: "ok" }] }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await callClaude({
      prompt: "hi",
      system: "be brief",
      model: "claude-test-model",
      maxTokens: 256,
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      model: "claude-test-model",
      max_tokens: 256,
      system: "be brief",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("uses default model + maxTokens when not supplied", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse(200, { content: [{ type: "text", text: "ok" }] }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await callClaude({ prompt: "hi" });

    const init = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init[1].body as string);
    expect(body.model).toBe("claude-sonnet-4-5");
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toBeUndefined();
  });
});