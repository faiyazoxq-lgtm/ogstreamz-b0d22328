import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";
import { randomBytes, createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type StreamConfigStatus =
  | { ok: true; host: string }
  | { ok: false; code: "missing" | "malformed" | "bad_protocol" | "bad_host" | "has_credentials" | "has_path"; message: string };

function checkServerUrl(): StreamConfigStatus {
  const raw = (process.env.STREAM_SERVER_URL || "").trim();
  if (!raw) {
    return { ok: false, code: "missing", message: "Stream server URL is not configured. Boss needs to set the STREAM_SERVER_URL secret." };
  }
  let v = raw;
  if (!/^https?:\/\//i.test(v)) v = "http://" + v;
  v = v.replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return { ok: false, code: "malformed", message: "STREAM_SERVER_URL is not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: "bad_protocol", message: "STREAM_SERVER_URL must use http or https." };
  }
  if (!url.hostname) {
    return { ok: false, code: "bad_host", message: "STREAM_SERVER_URL is missing a hostname." };
  }
  if (url.username || url.password) {
    return { ok: false, code: "has_credentials", message: "STREAM_SERVER_URL must not contain credentials." };
  }
  if (url.pathname && url.pathname !== "/" && url.pathname !== "") {
    return { ok: false, code: "has_path", message: "STREAM_SERVER_URL must not include a path." };
  }
  return { ok: true, host: url.host };
}

function getServerUrl(): string {
  const status = checkServerUrl();
  if (!status.ok) {
    const err: any = new Error(status.message);
    err.reason = "invalid_server";
    throw err;
  }
  let v = (process.env.STREAM_SERVER_URL || "").trim();
  if (!/^https?:\/\//i.test(v)) v = "http://" + v;
  return v.replace(/\/+$/, "");
}

// Boot-time check: log clearly if the secret is missing/misconfigured so it
// shows up in server logs the first time the module loads.
{
  const s = checkServerUrl();
  if (!s.ok) {
    console.error(`[stream-link] STREAM_SERVER_URL misconfigured (${s.code}): ${s.message}`);
  }
}

export const getStreamConfigStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<StreamConfigStatus> => checkServerUrl(),
);

export type StreamReasonCode =
  | "invalid_username"
  | "invalid_password"
  | "invalid_server"
  | "server_unreachable"
  | "server_timeout"
  | "server_error"
  | "credentials_rejected"
  | "account_expired"
  | "account_disabled"
  | "account_banned"
  | "rpc_error"
  | "unknown";

export type RpcErrorCause =
  | "network"
  | "rate_limit"
  | "invalid_credentials"
  | "resubmit_required"
  | "save_failed"
  | "permission_denied"
  | "unknown";

function classifyRpcError(message: string | undefined | null): RpcErrorCause {
  const m = (message || "").toLowerCase();
  if (!m) return "unknown";
  if (m.includes("resubmit")) return "resubmit_required";
  if (m.includes("rate") && m.includes("limit")) return "rate_limit";
  if (m.includes("too many") || m.includes("429")) return "rate_limit";
  if (m.includes("fetch") || m.includes("network") || m.includes("econn") || m.includes("timeout") || m.includes("unreachable")) return "network";
  if (m.includes("invalid") && (m.includes("credential") || m.includes("password") || m.includes("username") || m.includes("login"))) return "invalid_credentials";
  if (m.includes("unauthorized") || m.includes("forbidden") || m.includes("permission") || m.includes("rls") || m.includes("policy")) return "permission_denied";
  if (m.includes("duplicate") || m.includes("conflict") || m.includes("constraint") || m.includes("insert") || m.includes("update")) return "save_failed";
  return "unknown";
}

const REASON_MESSAGES: Record<StreamReasonCode, string> = {
  invalid_username: "Username must be 2–120 characters with no spaces.",
  invalid_password: "Password must be 2–200 characters.",
  invalid_server: "Server URL looks invalid. Use the full host including port (e.g. http://host.tld:80).",
  server_unreachable: "We couldn't reach that stream server. Double-check the URL and try again.",
  server_timeout: "The stream server took too long to respond. Try again in a moment.",
  server_error: "The stream server returned an error. Confirm the URL is correct.",
  credentials_rejected: "The stream server rejected those credentials. Check the username and password.",
  account_expired: "Those credentials are recognised but the account has expired. Renew with your provider.",
  account_disabled: "That account is disabled on the stream server. Contact your provider.",
  account_banned: "That account has been banned on the stream server.",
  rpc_error: "We couldn't save your credentials. Please try again.",
  unknown: "Verification failed. Please try again.",
};

function isValidServer(s: string): boolean {
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

function classifyStatus(status: string): StreamReasonCode | null {
  const s = status.toLowerCase();
  if (s === "active") return null;
  if (s.includes("expired")) return "account_expired";
  if (s.includes("ban")) return "account_banned";
  if (s.includes("disabled")) return "account_disabled";
  return "credentials_rejected";
}

type XtreamUserInfo = {
  status?: string;
  exp_date?: string | number | null;
  message?: string;
  auth?: number;
};

async function probeXtream(
  server: string,
  username: string,
  password: string,
): Promise<{ info: XtreamUserInfo } | { reason: StreamReasonCode; detail?: string }> {
  const url = `${server}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    } catch (e: any) {
      if (e?.name === "AbortError") return { reason: "server_timeout" };
      return { reason: "server_unreachable", detail: e?.message };
    }
    if (!res.ok) return { reason: "server_error", detail: `HTTP ${res.status}` };
    const json = (await res.json().catch(() => ({}))) as { user_info?: XtreamUserInfo } | XtreamUserInfo;
    const ui = ((json as any)?.user_info ?? json) as XtreamUserInfo;
    return { info: ui ?? {} };
  } finally {
    clearTimeout(t);
  }
}

export const verifyAndLinkStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; password: string }) => {
    const username = String(d.username ?? "").trim();
    const password = String(d.password ?? "");
    if (username.length < 2 || username.length > 120 || /\s/.test(username)) {
      const err: any = new Error(REASON_MESSAGES.invalid_username);
      err.reason = "invalid_username"; err.field = "username"; throw err;
    }
    if (password.length < 2 || password.length > 200) {
      const err: any = new Error(REASON_MESSAGES.invalid_password);
      err.reason = "invalid_password"; err.field = "password"; throw err;
    }
    return { username, password };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    let server: string;
    try {
      server = getServerUrl();
    } catch (e: any) {
      return {
        ok: false as const,
        reason: "invalid_server" as const,
        field: "server" as const,
        error: e?.message || REASON_MESSAGES.invalid_server,
      };
    }
    if (!isValidServer(server)) {
      return {
        ok: false as const,
        reason: "invalid_server" as const,
        field: "server" as const,
        error: REASON_MESSAGES.invalid_server,
      };
    }
    const probe = await probeXtream(server, data.username, data.password);
    if ("reason" in probe) {
      return {
        ok: false as const,
        reason: probe.reason,
        field: "server" as const,
        error: REASON_MESSAGES[probe.reason] + (probe.detail ? ` (${probe.detail})` : ""),
      };
    }
    const info = probe.info;
    const status = (info.status || (info.auth === 1 ? "Active" : "Unknown")).toString();
    const expUnix = Number(info.exp_date);
    const expiresAt = Number.isFinite(expUnix) && expUnix > 0 ? new Date(expUnix * 1000).toISOString() : null;

    const statusReason = classifyStatus(status);
    if (statusReason) {
      return {
        ok: false as const,
        reason: statusReason,
        field: statusReason === "credentials_rejected" ? ("password" as const) : ("username" as const),
        status,
        error: REASON_MESSAGES[statusReason] + ` (server reported "${status}")`,
      };
    }

    // Save credentials regardless (lets Boss re-verify later)
    {
      const { error } = await supabase.rpc("set_stream_credentials", {
        _user_id: userId, _username: data.username, _password: data.password, _server: server,
      });
      if (error) return { ok: false as const, reason: "rpc_error" as const, cause: classifyRpcError(error.message), error: error.message };
    }

    // Enqueue for Boss approval (no auto-promotion)
    const { error: qErr } = await supabase.rpc("enqueue_stream_verification", {
      _user_id: userId,
      _username: data.username,
      _password: data.password,
      _server: server,
      _auto_status: status,
      _auto_expires_at: expiresAt,
      _auto_payload: info as never,
    });
    if (qErr) return { ok: false as const, reason: "rpc_error" as const, cause: classifyRpcError(qErr.message), error: qErr.message };

    // Auto-tag the profile right away when the IPTV server says Active.
    // Boss approval still controls the OGSTREAMZ rank — this just lights up
    // the badge + expiry on their profile immediately.
    if (status === "Active") {
      await supabase.rpc("apply_auto_stream_status", {
        _user_id: userId,
        _status: status,
        _expires_at: expiresAt,
      });
    }

    return {
      ok: true as const,
      queued: true as const,
      status,
      expiresAt,
      message:
        status === "Active"
          ? "Credentials matched. Submitted to Boss for OGSTREAMZ approval."
          : `Auto-check status: ${status}. Submitted to Boss for review.`,
    };
  });

export const reverifyStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string } | undefined) => ({ userId: d?.userId ? String(d.userId) : "" }))
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    // Pull the user's stored encrypted creds (Boss-approved link only).
    const { data: rows, error } = await supabase.rpc("get_my_stream_creds");
    if (error) {
      return { ok: false as const, reason: "rpc_error" as const, cause: classifyRpcError(error.message), error: error.message };
    }
    const creds = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!creds || !creds.password || !creds.username) {
      return {
        ok: false as const,
        reason: "rpc_error" as const,
        cause: "resubmit_required" as const,
        error: "Re-verification requires you to resubmit your stream credentials.",
      };
    }
    let server: string;
    try {
      server = getServerUrl();
    } catch (e: any) {
      return {
        ok: false as const,
        reason: "invalid_server" as const,
        error: e?.message || REASON_MESSAGES.invalid_server,
      };
    }
    const probe = await probeXtream(server, creds.username, creds.password);
    if ("reason" in probe) {
      return {
        ok: false as const,
        reason: probe.reason,
        error: REASON_MESSAGES[probe.reason] + (probe.detail ? ` (${probe.detail})` : ""),
      };
    }
    const info = probe.info;
    const status = (info.status || (info.auth === 1 ? "Active" : "Unknown")).toString();
    const expUnix = Number(info.exp_date);
    const expiresAt = Number.isFinite(expUnix) && expUnix > 0 ? new Date(expUnix * 1000).toISOString() : null;

    await supabase.rpc("apply_auto_stream_status", {
      _user_id: userId,
      _status: status,
      _expires_at: expiresAt,
    });

    return { ok: true as const, status, expiresAt };
  });

/**
 * Build the personalised m3u_plus playlist URL for the signed-in user using
 * the credentials they typed during verification. The host comes from the
 * server-side STREAM_SERVER_URL secret, so members never see the domain in
 * client code — they only ever see their own filled-in URL after auth.
 */
export const getMyStreamM3uUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    try {
      getServerUrl();
    } catch (e: any) {
      return { ok: false as const, reason: "invalid_server" as const, error: e?.message || REASON_MESSAGES.invalid_server };
    }
    // Confirm the member actually has saved credentials before minting a token.
    const { data: rows, error } = await supabase.rpc("get_my_stream_creds");
    if (error) {
      return { ok: false as const, reason: "rpc_error" as const, cause: classifyRpcError(error.message), error: error.message };
    }
    const creds = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!creds || !creds.username || !creds.password) {
      return {
        ok: false as const,
        reason: "rpc_error" as const,
        cause: "resubmit_required" as const,
        error: "No saved stream credentials yet. Verify your line first.",
      };
    }

    // Mint a fresh, opaque, single-line token (32 bytes -> 64 hex chars).
    // We persist only the SHA-256 hash so the secret never sits at rest.
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const ttlHours = 24;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    const { error: insErr } = await supabaseAdmin
      .from("stream_url_tokens" as never)
      .insert({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt } as never);
    if (insErr) {
      return { ok: false as const, reason: "rpc_error" as const, cause: classifyRpcError(insErr.message), error: insErr.message };
    }

    // Build an absolute URL pointing at our public proxy route.
    const forwardedProto = (getRequestHeader("x-forwarded-proto") || "").split(",")[0].trim();
    const host = getRequestHost();
    const proto = forwardedProto || (host && host.startsWith("localhost") ? "http" : "https");
    const url = `${proto}://${host}/api/public/stream-m3u?t=${token}`;
    return { ok: true as const, url, expiresAt };
  });