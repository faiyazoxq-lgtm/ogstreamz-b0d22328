import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tagOgStreamzUser } from "@/lib/stream-tag.server";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function audit(req: Request, entry: {
  user_id: string | null;
  action: string;
  success: boolean;
  reason?: string | null;
  token_hash?: string | null;
}) {
  try {
    const xff = req.headers.get("x-forwarded-for") || "";
    const ip = xff.split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent") || null;
    await supabaseAdmin.from("stream_url_audit" as never).insert({
      user_id: entry.user_id,
      ip,
      user_agent: ua,
      action: entry.action,
      success: entry.success,
      reason: entry.reason ?? null,
      token_hash: entry.token_hash ?? null,
    } as never);
  } catch (e: any) {
    console.error("[stream-url-audit] proxy log failed:", e?.message || e);
  }
}

export const Route = createFileRoute("/api/public/stream-m3u")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t") || url.searchParams.get("token");
        if (!token || token.length < 16 || token.length > 256) {
          await audit(request, { user_id: null, action: "fetch", success: false, reason: "invalid_token_format" });
          return new Response("Invalid token", { status: 400 });
        }
        const token_hash = hashToken(token);

        const { data: row, error } = await supabaseAdmin
          .from("stream_url_tokens")
          .select("user_id, expires_at, revoked")
          .eq("token_hash", token_hash)
          .maybeSingle();

        if (error || !row) {
          await audit(request, { user_id: null, action: "fetch", success: false, reason: "token_not_found", token_hash });
          return new Response("Token not found", { status: 404 });
        }
        if (row.revoked) {
          await audit(request, { user_id: row.user_id, action: "fetch", success: false, reason: "revoked", token_hash });
          return new Response("Token revoked", { status: 410 });
        }
        if (new Date(row.expires_at).getTime() < Date.now()) {
          await audit(request, { user_id: row.user_id, action: "fetch", success: false, reason: "expired", token_hash });
          return new Response("Token expired", { status: 410 });
        }

        const { data: credsRows, error: cErr } = await supabaseAdmin.rpc(
          "get_stream_creds_for",
          { _user_id: row.user_id },
        );
        if (cErr) {
          await audit(request, { user_id: row.user_id, action: "fetch", success: false, reason: `creds_error:${cErr.message}`, token_hash });
          return new Response("Credential lookup failed", { status: 500 });
        }
        const creds = Array.isArray(credsRows) && credsRows[0] ? credsRows[0] : null;
        if (!creds?.username || !creds?.password) {
          await audit(request, { user_id: row.user_id, action: "fetch", success: false, reason: "no_creds", token_hash });
          return new Response("No credentials on file", { status: 404 });
        }

        let server = (process.env.STREAM_SERVER_URL || "").trim();
        if (!server) {
          await audit(request, { user_id: row.user_id, action: "fetch", success: false, reason: "server_not_configured", token_hash });
          return new Response("Stream server not configured", { status: 500 });
        }
        if (!/^https?:\/\//i.test(server)) server = "http://" + server;
        server = server.replace(/\/+$/, "");

        const upstream =
          `${server}/get.php` +
          `?username=${encodeURIComponent(creds.username)}` +
          `&password=${encodeURIComponent(creds.password)}` +
          `&type=m3u_plus&output=ts`;

        // Mark used (fire and forget)
        supabaseAdmin
          .from("stream_url_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("token_hash", token_hash)
          .then(() => {});

        let upstreamRes: Response;
        try {
          upstreamRes = await fetch(upstream, {
            redirect: "follow",
            headers: { "User-Agent": "OGStreamz/1.0" },
          });
        } catch (e: any) {
          await audit(request, { user_id: row.user_id, action: "fetch", success: false, reason: `upstream_error:${e?.message || "unknown"}`, token_hash });
          return new Response("Upstream unreachable", { status: 502 });
        }

        await audit(request, { user_id: row.user_id, action: "fetch", success: upstreamRes.ok, reason: upstreamRes.ok ? null : `upstream_status:${upstreamRes.status}`, token_hash });

        // On a successful proxied fetch, tag the user as an OGStreamz stream user.
        if (upstreamRes.ok && row.user_id) {
          // Fire and forget — never block the playlist response.
          tagOgStreamzUser(row.user_id, "m3u_fetch").catch(() => {});
        }

        const headers = new Headers();
        const ct = upstreamRes.headers.get("content-type") || "application/vnd.apple.mpegurl";
        headers.set("Content-Type", ct);
        headers.set("Cache-Control", "no-store, private");
        const cd = upstreamRes.headers.get("content-disposition");
        if (cd) headers.set("Content-Disposition", cd);
        else headers.set("Content-Disposition", `attachment; filename="playlist.m3u"`);

        return new Response(upstreamRes.body, {
          status: upstreamRes.status,
          headers,
        });
      },
    },
  },
});