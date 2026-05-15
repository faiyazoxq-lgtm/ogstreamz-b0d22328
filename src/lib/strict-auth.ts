/**
 * Stricter JWT validation + refresh handling for TanStack server-fn calls.
 *
 * Two pieces:
 *  1. {@link strictAuthAttacher} — client-side function middleware. Decodes
 *     the cached Supabase access token, refreshes proactively when it's
 *     within the leeway window, and ABORTS the RPC (no network call) with a
 *     clean 401-shaped error if no valid token can be produced.
 *  2. {@link requireStrictAuth} — server-side function middleware. Wraps the
 *     existing `requireSupabaseAuth` (which already verifies signature + exp
 *     via `getClaims`) and additionally enforces `iss` / `aud` / `exp`
 *     without any leeway. Any failure throws `Response('Unauthorized', { status: 401 })`
 *     BEFORE the RPC handler runs, so no downstream query is dispatched.
 *
 * Use `requireStrictAuth` in place of `requireSupabaseAuth` for sensitive
 * server functions that must reject expired/tampered tokens with no side
 * effects. The client attacher is wired globally in `src/start.ts`.
 */
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ApiError } from "@/lib/api-error";

/** Refresh access tokens that expire within this many seconds. */
const REFRESH_LEEWAY_SECONDS = 60;

interface JwtPayload {
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
  sub?: string;
}

/**
 * Decode a JWT payload WITHOUT verifying the signature. Used only for cheap
 * client-side `exp` checks before deciding whether to refresh — the actual
 * verification happens on the server in {@link requireStrictAuth}.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    // base64url -> base64
    const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(
      part.length + ((4 - (part.length % 4)) % 4),
      "=",
    );
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isExpired(payload: JwtPayload | null, leewaySeconds = 0): boolean {
  if (!payload?.exp) return true;
  return payload.exp <= nowSeconds() + leewaySeconds;
}

/**
 * Resolve a fresh, non-expired access token for the current session.
 * Refreshes proactively if the cached token is within the leeway window.
 * Returns `null` when no valid session can be produced (signed out, or
 * refresh failed) — the caller should treat this as an auth failure.
 */
export async function resolveFreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.access_token) return null;

    const payload = decodeJwtPayload(session.access_token);
    if (!isExpired(payload, REFRESH_LEEWAY_SECONDS)) {
      return session.access_token;
    }

    // Token is expired or about to expire — try to refresh.
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session?.access_token) {
      // Refresh failed — clear the dead session locally so the UI can react.
      try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
      return null;
    }
    const fresh = decodeJwtPayload(refreshed.session.access_token);
    if (isExpired(fresh)) return null;
    return refreshed.session.access_token;
  } catch {
    return null;
  }
}

/**
 * Client-side function middleware: attaches a fresh bearer token to every
 * server-fn RPC, refreshing it first when needed. If no valid token exists,
 * the RPC is ABORTED before any network request goes out.
 */
export const strictAuthAttacher = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    // Only enforce on the client — during SSR there is no user session to
    // attach. Server-side middlewares decide what's allowed in that case.
    if (typeof window === "undefined") {
      return next({});
    }

    // No persisted session at all → call the RPC unauthenticated and let the
    // server middleware decide (most server fns require auth and will 401).
    let hasSession = false;
    try {
      const { data } = await supabase.auth.getSession();
      hasSession = !!data.session;
    } catch { /* ignore */ }

    if (!hasSession) {
      return next({});
    }

    const token = await resolveFreshAccessToken();
    if (!token) {
      // We had a session but couldn't produce a valid token. Abort the RPC
      // here — DO NOT dispatch a request with a stale or missing bearer.
      throw new ApiError("UNAUTHENTICATED", "Session expired — please sign in again");
    }

    return next({ headers: { Authorization: `Bearer ${token}` } });
  },
);

/**
 * Server-side function middleware: enforces strict JWT claim checks on top
 * of the standard `requireSupabaseAuth` (which already validates signature
 * + exp via Supabase's `getClaims`).
 *
 * Additional checks performed here:
 *  - `exp` is strictly in the future (no leeway).
 *  - `iss` matches the configured Supabase Auth issuer.
 *  - `aud` includes the `authenticated` audience.
 *  - `sub` is a non-empty string.
 *
 * Any failure throws `Response('Unauthorized', { status: 401 })` BEFORE the
 * handler runs — no DB query, no RPC, no side effects.
 */
export const requireStrictAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const claims = (context as { claims?: JwtPayload }).claims ?? null;

    if (!claims || typeof claims !== "object") {
      throw new Response("Unauthorized: missing claims", { status: 401 });
    }

    if (typeof claims.sub !== "string" || claims.sub.length === 0) {
      throw new Response("Unauthorized: missing subject", { status: 401 });
    }

    // Strict expiry check — `getClaims` already verifies exp, but we re-check
    // with no leeway in case of clock drift between Supabase and the worker.
    if (typeof claims.exp !== "number" || claims.exp <= nowSeconds()) {
      throw new Response("Unauthorized: token expired", { status: 401 });
    }

    if (typeof claims.nbf === "number" && claims.nbf > nowSeconds()) {
      throw new Response("Unauthorized: token not yet valid", { status: 401 });
    }

    const expectedIssuer = `${process.env.SUPABASE_URL ?? ""}/auth/v1`;
    if (expectedIssuer && claims.iss && claims.iss !== expectedIssuer) {
      console.warn(`[strict-auth] issuer mismatch: ${claims.iss} ≠ ${expectedIssuer}`);
      throw new Response("Unauthorized: invalid issuer", { status: 401 });
    }

    const aud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    if (!aud.includes("authenticated")) {
      throw new Response("Unauthorized: invalid audience", { status: 401 });
    }

    return next();
  });