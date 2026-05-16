import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runWithStartContext } from "@tanstack/start-storage-context";

/**
 * End-to-end integration test for `askClaude` exercised through the
 * TanStack server-fn pipeline via `__executeServer`, the same entry point
 * the framework uses on the server after RPC dispatch.
 *
 * Scope: this harness exercises the real middleware + validator chain in
 * order — `requireSupabaseAuth` → `requireStrictAuth` → `ClaudeInputSchema`
 * (Zod). The `.handler()` body itself is code-split by the TanStack Start
 * Vite plugin into a virtual `?tss-serverfn-split` module that vitest does
 * not resolve, so handler-side behaviour (callClaude delegation, default
 * application, error envelope) is covered by `claude.test.ts` instead.
 *
 * `@/integrations/supabase/auth-middleware` is stubbed so we can drive
 * every branch of `requireStrictAuth` without a real Supabase token.
 */

// ─── Hoisted mock state (vi.mock factories run before module imports) ────────
const state = vi.hoisted(() => ({
  claims: null as Record<string, unknown> | null,
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

// Import the serverFn AFTER mocks are registered.
import { askClaude } from "./claude.functions";

/**
 * Tiny server harness: every TanStack serverFn exposes `__executeServer`,
 * the internal entry the framework uses on the server side. It expects a
 * Start request context in AsyncLocalStorage (normally established by the
 * request handler), so we stand one up with `runWithStartContext` and a
 * minimal fake `Request`. Returns the pipeline envelope
 * `{ result, error, context }` — `error` is populated when middleware
 * throws a non-`Response` value (e.g. a `ZodError`); `Response` throws
 * propagate as rejections.
 */
function invokeAskClaude(data: unknown): Promise<{ result?: unknown; error?: unknown; context?: unknown }> {
  const fakeRequest = new Request("https://test.local/_serverFn/askClaude", {
    method: "POST",
    headers: { authorization: "Bearer stub", "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });
  return runWithStartContext(
    {
      getRouter: (() => ({})) as never,
      request: fakeRequest,
      startOptions: {},
      contextAfterGlobalMiddlewares: {},
      executedRequestMiddlewares: new Set(),
      handlerType: "serverFn",
    } as never,
    () => (askClaude as unknown as { __executeServer: (o: unknown) => Promise<{ result?: unknown; error?: unknown; context?: unknown }> })
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
});

afterEach(() => {
  if (ORIGINAL_SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = ORIGINAL_SUPABASE_URL;
});

/**
 * Tiny helper: middleware that throws `new Response(...)` may surface either
 * as a rejection (top-level mock) or inside the envelope's `error` field
 * (chained middleware caught by the pipeline). Normalize both to
 * `{ status, body }` so assertions stay compact across all auth branches.
 */
async function expectAuthFailure(
  p: Promise<{ result?: unknown; error?: unknown; context?: unknown }>,
): Promise<{ status: number; body: string }> {
  try {
    const env = await p;
    if (env?.error instanceof Response) {
      return { status: env.error.status, body: await env.error.text() };
    }
    throw new Error(
      `expected serverFn to reject or return a Response error, got: ${JSON.stringify(env)}`,
    );
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
  });

  it("rejects when claims are missing sub (requireStrictAuth)", async () => {
    state.claims = validClaims({ sub: "" });
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/subject/i);
  });

  it("rejects when exp is in the past (requireStrictAuth)", async () => {
    state.claims = validClaims({ exp: Math.floor(Date.now() / 1000) - 1 });
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/expired/i);
  });

  it("rejects when iss does not match SUPABASE_URL (requireStrictAuth)", async () => {
    state.claims = validClaims({ iss: "https://attacker.example.com/auth/v1" });
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/issuer/i);
  });

  it("rejects when aud does not include 'authenticated' (requireStrictAuth)", async () => {
    state.claims = validClaims({ aud: "anon" });
    const { status, body } = await expectAuthFailure(
      invokeAskClaude({ prompt: "hi" }),
    );
    expect(status).toBe(401);
    expect(body).toMatch(/audience/i);
  });
});

// ─────────────────────────────── INPUT VALIDATION ────────────────────────────
describe("askClaude e2e — input validation (post-auth)", () => {
  beforeEach(() => {
    state.claims = validClaims();
  });

  /** Zod failures inside the pipeline surface as `envelope.error` (a ZodError) rather than a rejection. */
  async function expectZodError(data: unknown): Promise<void> {
    const env = await invokeAskClaude(data);
    expect(env.error).toBeDefined();
    expect((env.error as { name?: string }).name).toBe("ZodError");
  }

  it("rejects empty prompt with a ZodError before reaching the handler", async () => {
    await expectZodError({ prompt: "" });
  });

  it("rejects prompt over 8000 chars", async () => {
    await expectZodError({ prompt: "x".repeat(8001) });
  });

  it("rejects maxTokens out of range", async () => {
    await expectZodError({ prompt: "hi", maxTokens: 99999 });
  });

  it("rejects non-integer maxTokens", async () => {
    await expectZodError({ prompt: "hi", maxTokens: 1.5 });
  });
});

// ─────────────────────────────── PIPELINE WIRING ─────────────────────────────
describe("askClaude e2e — full pipeline reaches handler boundary", () => {
  it("auth + validation both pass → envelope has no error (handler boundary reached)", async () => {
    state.claims = validClaims();
    const env = await invokeAskClaude({ prompt: "ping" });
    // The handler body itself is code-split into a virtual module that
    // vitest does not load, so `result` is undefined here. The contract
    // verified is: no middleware/validator rejected, the pipeline ran to
    // the handler boundary in the correct order. Handler-body behaviour
    // (callClaude delegation, defaults, error envelope) is covered in
    // claude.test.ts.
    expect(env.error).toBeUndefined();
  });
});