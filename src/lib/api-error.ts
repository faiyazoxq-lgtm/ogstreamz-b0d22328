/**
 * Stable, client-safe error codes for server functions.
 *
 * Server fns throw `new ApiError(code, safeMessage)`. The TanStack RPC layer
 * serialises `Error.message` to the client, so we encode the code as a
 * `CODE: message` prefix. The client uses {@link parseApiError} to recover
 * `{ code, message }` without ever seeing internal detail (DB errors, stack
 * traces, raw provider messages).
 *
 * Rules:
 *  - Messages MUST be human-safe and free of secrets, IDs, SQL, or stack info.
 *  - Add new codes here so the union stays exhaustive on the client.
 */
export type ApiErrorCode =
  | "UNAUTHENTICATED"   // no/invalid session
  | "FORBIDDEN"         // authenticated but not allowed (role, ownership)
  | "NOT_UNLOCKED"      // resource exists but caller hasn't purchased it
  | "NOT_FOUND"         // resource does not exist (or is hidden from caller)
  | "INVALID_INPUT"     // validation failure
  | "UNAVAILABLE"       // upstream/storage temporarily unavailable
  | "RATE_LIMITED"
  | "INTERNAL";         // generic fallback — never leak provider detail

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  UNAUTHENTICATED: "Sign in to continue",
  FORBIDDEN: "You don't have access to this",
  NOT_UNLOCKED: "You haven't unlocked this yet",
  NOT_FOUND: "Not found",
  INVALID_INPUT: "Invalid request",
  UNAVAILABLE: "Temporarily unavailable",
  RATE_LIMITED: "Too many requests — try again soon",
  INTERNAL: "Something went wrong",
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message?: string) {
    super(`${code}: ${message ?? DEFAULT_MESSAGE[code]}`);
    this.code = code;
    this.name = "ApiError";
  }
}

/**
 * Parse an unknown error caught from a server fn call into a stable
 * `{ code, message }`. Falls back to `INTERNAL` with a generic message
 * when nothing recognisable is found — never echoes raw provider detail.
 */
export function parseApiError(err: unknown): { code: ApiErrorCode; message: string } {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  // CODE: message  — the prefix produced by ApiError above.
  const m = /^([A-Z_]+):\s*(.*)$/.exec(raw);
  if (m) {
    const code = m[1] as ApiErrorCode;
    if (code in DEFAULT_MESSAGE) {
      return { code, message: m[2] || DEFAULT_MESSAGE[code] };
    }
  }
  // TanStack auth middleware throws Response('Unauthorized', { status: 401 }).
  if (/unauthorized/i.test(raw)) {
    return { code: "UNAUTHENTICATED", message: DEFAULT_MESSAGE.UNAUTHENTICATED };
  }
  // Postgres / PostgREST permission errors that may slip through if a server
  // fn forwards the raw error. Map them to FORBIDDEN without echoing detail.
  if (/permission denied|42501|forbidden/i.test(raw)) {
    return { code: "FORBIDDEN", message: DEFAULT_MESSAGE.FORBIDDEN };
  }
  return { code: "INTERNAL", message: DEFAULT_MESSAGE.INTERNAL };
}

/**
 * True when the parsed error means the caller is not allowed to perform the
 * action (either unauthenticated or authenticated-but-forbidden). Use this
 * to decide whether to render the shared <AccessDenied /> surface.
 */
export function isAccessDenied(err: unknown): boolean {
  const { code } = parseApiError(err);
  return code === "FORBIDDEN" || code === "UNAUTHENTICATED";
}

/**
 * Log a denied RPC call for diagnostics WITHOUT leaking server-side detail to
 * the user. The RPC name + parsed code go to the console; the raw error is
 * intentionally not surfaced. Returns the parsed `{ code, message }` so the
 * caller can render <AccessDenied message={...} /> with a safe string.
 *
 * Usage:
 *   try { await someBossFn({ data }); }
 *   catch (err) {
 *     const { code, message } = reportRpcDenied("boss_set_flag", err);
 *     if (code === "FORBIDDEN" || code === "UNAUTHENTICATED") setDenied(true);
 *     else toast.error(message);
 *   }
 */
export function reportRpcDenied(
  rpcName: string,
  err: unknown,
): { code: ApiErrorCode; message: string } {
  const parsed = parseApiError(err);
  if (parsed.code === "FORBIDDEN" || parsed.code === "UNAUTHENTICATED") {
    // Console-only — never bubbled to the UI. Helps diagnose which RPC the
    // current session was rejected from without exposing internals to users.
    // eslint-disable-next-line no-console
    console.warn(`[rpc-denied] ${rpcName} → ${parsed.code}`);
  }
  return parsed;
}