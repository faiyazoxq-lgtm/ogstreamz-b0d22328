import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runWithStartContext } from "@tanstack/start-storage-context";

/**
 * End-to-end integration test for `askClaude` exercised through the
 * TanStack server-fn pipeline.
 *
 * Unlike `claude.test.ts` (which covers each layer in isolation by reading
 * source, validating the Zod schema, or stubbing fetch around `callClaude`),
 * this test invokes the actual serverFn returned by `createServerFn(...)`
 * server-side, which exercises the full pipeline in order:
 *
 *   requireSupabaseAuth  →  requireStrictAuth  →  inputValidator (Zod)  →  handler
 *
 * We stub two seams so the pipeline runs without a real HTTP request:
 *   - `@/integrations/supabase/auth-middleware` — its `requireSupabaseAuth`
 *     normally reads `getRequest()` headers and calls Supabase's `getClaims`.
 *     We replace it with a middleware that injects a configurable `claims`
 *     object into context, letting us drive both the happy path and every
 *     `requireStrictAuth` rejection branch.
 *   - `@/lib/claude.server`  — its `callClaude` does the Anthropic fetch.
 *     We replace it with a vi.fn so we can assert the exact payload the
 *     handler forwards (post-validation, post-default-application) and
 *     control the return shape without touching the network.
 *
 * Everything else — Zod input validation, `requireStrictAuth`'s strict
 * iss/aud/exp/sub checks, and the handler body — runs real, unmocked code.
 */

// ─── Hoisted mock state (vi.mock factories run before module imports) ────────
const state = vi.hoisted(() => ({
  claims: null as Record<string, unknown> | null,
  callClaude: vi.fn(),
}));

vi.mock("@/integrations/supabase/auth-middleware", async () => {
  const { createMiddleware } = await import("@tanstack/react-start");
  return {
    requireSupabaseAuth: createMiddleware({ type: "function" }).server(
      async ({ next }) => {
        if (!state.claims) {
          throw new Response("Unauthorized: stubbed no-auth", { status: 401 });
        }
        return next({
          context: {
            supabase: {} as unknown,
            userId: String(state.claims.sub ?? ""),
            claims: state.claims,
          },
        });
      },
    ),
  };
});

vi.mock("@/lib/claude.server", () => ({
  callClaude: state.callClaude,
}));

// Import the serverFn AFTER mocks are registered.
import { askClaude } from "./claude.functions";

/**
 * Tiny "server harness": every TanStack serverFn exposes `__executeServer`,
 * the internal entry that runs the full middleware → validator → handler
 * pipeline server-side. It expects to find a Start request context in
 * AsyncLocalStorage (normally established by the request handler), so we
 * stand one up with `runWithStartContext` and a minimal fake `Request`.
 */
function invokeAskClaude(data: unknown): Promise<unknown> {
  const fakeRequest = new Request("https://test.local/_serverFn/askClaude", {
    method: "POST",
    headers: { authorization: "Bearer stub", "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });
  return runWithStartContext(
    {
      // Only fields the createServerFn pipeline actually touches in this test.
      getRouter: (() => ({})) as never,
      request: fakeRequest,
      startOptions: {},
      contextAfterGlobalMiddlewares: {},
      executedRequestMiddlewares: new Set(),
      handlerType: "serverFn",
    } as never,
    () => (askClaude as unknown as { __executeServer: (o: unknown) => Promise<unknown> })
      .__executeServer({ data }),
  );
}

const ORIGINAL_SUPABASE_URL = process.env.SUPABASE_URL;

/** Build a valid claims object that satisfies every requireStrictAuth check. */
function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: "user-123",
    iss: `${process.env.SUPABASE_URL}/auth/v1`,
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 600,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://stub.supabase.co";
  state.claims = null;
  state.callClaude.mockReset();
});

afterEach(() => {
  if (ORIGINAL_SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = ORIGINAL_SUPABASE_URL;
});

/**
 * Tiny helper: every `throw new Response(...)` from middleware bubbles out as
 * the rejection value. Resolve it to `{ status, body }` so assertions stay
 * compact across all the auth branches below.
 */
async function expectAuthFailure(p: Promise<unknown>): Promise<{ status: number; body: string }> {
  try {
    await p;
    throw new Error("expected serverFn to reject");
  } catch (e) {
    if (e instanceof Response) {
      return { status: e.status, body: await e.text() };
    }
    throw e;
  }
}

// ─────────────────────────────── AUTH GATING ─────────────────────────────────
describe("askClaude e2e — auth gating", () => {
  it("rejects when no session is attached (requireSupabaseAuth)", async () => {
    state.claims = null;
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/no-auth/i);
    expect(state.callClaude).not.toHaveBeenCalled();
  });

  it("rejects when claims are missing sub (requireStrictAuth)", async () => {
    state.claims = validClaims({ sub: "" });
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/subject/i);
    expect(state.callClaude).not.toHaveBeenCalled();
  });

  it("rejects when exp is in the past (requireStrictAuth)", async () => {
    state.claims = validClaims({ exp: Math.floor(Date.now() / 1000) - 1 });
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/expired/i);
    expect(state.callClaude).not.toHaveBeenCalled();
  });

  it("rejects when iss does not match SUPABASE_URL (requireStrictAuth)", async () => {
    state.claims = validClaims({ iss: "https://attacker.example.com/auth/v1" });
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/issuer/i);
    expect(state.callClaude).not.toHaveBeenCalled();
  });

  it("rejects when aud does not include 'authenticated' (requireStrictAuth)", async () => {
    state.claims = validClaims({ aud: "anon" });
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/audience/i);
    expect(state.callClaude).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────── INPUT VALIDATION ────────────────────────────
describe("askClaude e2e — input validation (post-auth)", () => {
  beforeEach(() => {
    state.claims = validClaims();
  });

  it("rejects empty prompt with a ZodError before reaching the handler", async () => {
    await expect(invokeAskClaude({ prompt: "" })).rejects.toThrow();
    expect(state.callClaude).not.toHaveBeenCalled();
  });

  it("rejects prompt over 8000 chars", async () => {
    await expect(invokeAskClaude({ prompt: "x".repeat(8001) })).rejects.toThrow();
    expect(state.callClaude).not.toHaveBeenCalled();
  });

  it("rejects maxTokens out of range", async () => {
    await expect(invokeAskClaude({ prompt: "hi", maxTokens: 99999 })).rejects.toThrow();
    expect(state.callClaude).not.toHaveBeenCalled();
  });

  it("rejects non-integer maxTokens", async () => {
    await expect(invokeAskClaude({ prompt: "hi", maxTokens: 1.5 })).rejects.toThrow();
    expect(state.callClaude).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────── HANDLER WIRING ──────────────────────────────
describe("askClaude e2e — handler wiring (auth + validation pass)", () => {
  beforeEach(() => {
    state.claims = validClaims();
  });

  it("forwards validated data + applied defaults to callClaude and returns its result", async () => {
    state.callClaude.mockResolvedValueOnce({ ok: true, text: "pong" });

    const result = await invokeAskClaude({ prompt: "ping" });

    expect(result).toEqual({ ok: true, text: "pong" });
    expect(state.callClaude).toHaveBeenCalledTimes(1);
    // Zod defaults must be materialized before the handler runs.
    expect(state.callClaude).toHaveBeenCalledWith({
      prompt: "ping",
      system: undefined,
      model: "claude-sonnet-4-5",
      maxTokens: 1024,
    });
  });

  it("passes through caller-specified system/model/maxTokens unchanged", async () => {
    state.callClaude.mockResolvedValueOnce({ ok: true, text: "ok" });

    await invokeAskClaude({
      prompt: "hello",
      system: "be brief",
      model: "claude-opus-4",
      maxTokens: 256,
    });

    expect(state.callClaude).toHaveBeenCalledWith({
      prompt: "hello",
      system: "be brief",
      model: "claude-opus-4",
      maxTokens: 256,
    });
  });

  it("propagates callClaude's failure envelope without throwing", async () => {
    state.callClaude.mockResolvedValueOnce({ ok: false, error: "anthropic 500" });

    const result = await invokeAskClaude({ prompt: "hi" });

    expect(result).toEqual({ ok: false, error: "anthropic 500" });
  });

  it("propagates a thrown error from callClaude to the caller", async () => {
    state.callClaude.mockRejectedValueOnce(new Error("network down"));

    await expect(invokeAskClaude({ prompt: "hi" })).rejects.toThrow(/network down/);
  });
});