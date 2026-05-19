import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { logError, logInfo, logWarn } from "@/lib/server-log.server";
import { siteBase, logTelegramAuthEvent } from "@/lib/telegram-auth-link.server";

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _admin;
}

function redirectTo(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

/**
 * Magic-auth exchange used by Telegram bot deep-link buttons.
 *
 * GET /api/public/telegram/auth?t=<single-use token>
 *
 * 1. Look up token in `telegram_auth_tokens` (must exist, not used, not expired).
 * 2. Burn the token (set used_at) so it can't be replayed.
 * 3. Generate a Supabase magic-link for the bound user's email, with
 *    redirectTo = PUBLIC_SITE_URL + dest_path, and 302 to that action link.
 *    Supabase exchanges the magic link for a session and bounces the user
 *    to the deep-link destination already signed in.
 */
export const Route = createFileRoute("/api/public/telegram/auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t") || "";
        const base = siteBase();
        const loginFallback = `${base}/auth?reason=telegram_link_expired`;
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          request.headers.get("cf-connecting-ip") ||
          null;
        const userAgent = request.headers.get("user-agent") || null;
        const tokenPrefix = token ? token.slice(0, 8) : null;

        if (!token || token.length < 16 || token.length > 128) {
          await logTelegramAuthEvent({
            event: "rejected_missing",
            token_prefix: tokenPrefix,
            reason: token ? `bad_length:${token.length}` : "no_token",
            ip,
            user_agent: userAgent,
          });
          return redirectTo(loginFallback);
        }

        const sb = admin();

        // ATOMIC BURN: conditional update guarantees single-use even under
        // concurrent taps. The row only flips to used_at IS NOT NULL once;
        // every other concurrent request matches zero rows and is rejected.
        const nowIso = new Date().toISOString();
        const { data: burnedRows, error: burnErr } = await (sb.from("telegram_auth_tokens") as any)
          .update({ used_at: nowIso })
          .eq("token", token)
          .is("used_at", null)
          .gt("expires_at", nowIso)
          .select("user_id,dest_path,chat_id,expires_at");
        if (burnErr) {
          logError("tg.auth.burn_failed", { error: burnErr.message });
          await logTelegramAuthEvent({
            event: "rejected_exception",
            token_prefix: tokenPrefix,
            reason: `burn_failed:${burnErr.message}`,
            ip,
            user_agent: userAgent,
          });
          return redirectTo(loginFallback);
        }
        const row = Array.isArray(burnedRows) ? burnedRows[0] : null;
        if (!row) {
          // Either the token doesn't exist, was already used, or expired.
          // Disambiguate with a follow-up read for audit clarity (no security
          // impact — we've already refused to issue a session).
          const { data: probe } = await (sb.from("telegram_auth_tokens") as any)
            .select("user_id,dest_path,used_at,expires_at")
            .eq("token", token)
            .maybeSingle();
          let event:
            | "rejected_not_found"
            | "rejected_already_used"
            | "rejected_expired" = "rejected_not_found";
          let reason = "not_found";
          if (probe) {
            if (probe.used_at) {
              event = "rejected_already_used";
              reason = "already_used";
            } else if (new Date(probe.expires_at).getTime() < Date.now()) {
              event = "rejected_expired";
              reason = "expired";
            }
          }
          logWarn(`tg.auth.${event}`, {
            tokenPrefix,
            userIdSuffix: probe?.user_id ? String(probe.user_id).slice(-8) : null,
          });
          await logTelegramAuthEvent({
            event,
            user_id: probe?.user_id ?? null,
            chat_id: null,
            dest_path: probe?.dest_path ?? null,
            token_prefix: tokenPrefix,
            reason,
            ip,
            user_agent: userAgent,
          });
          return redirectTo(loginFallback);
        }

        // Look up the bound profile's email so we can mint a magic link for them.
        const { data: prof } = await (sb.from("profiles") as any)
          .select("email")
          .eq("id", row.user_id)
          .maybeSingle();
        const email = (prof?.email as string | undefined)?.trim();
        if (!email) {
          logError("tg.auth.no_email", { userIdSuffix: String(row.user_id).slice(-8) });
          await logTelegramAuthEvent({
            event: "rejected_no_email",
            user_id: row.user_id,
            chat_id: row.chat_id ?? null,
            dest_path: row.dest_path ?? null,
            token_prefix: tokenPrefix,
            ip,
            user_agent: userAgent,
          });
          return redirectTo(loginFallback);
        }

        const dest = typeof row.dest_path === "string" && row.dest_path.startsWith("/")
          ? row.dest_path
          : "/";
        const redirectAfter = `${base}${dest}`;

        try {
          const { data, error: linkErr } = await (sb as any).auth.admin.generateLink({
            type: "magiclink",
            email,
            options: { redirectTo: redirectAfter },
          });
          if (linkErr || !data?.properties?.action_link) {
            logError("tg.auth.generate_link_failed", {
              error: linkErr?.message || "no action_link",
            });
            await logTelegramAuthEvent({
              event: "rejected_generate_link_failed",
              user_id: row.user_id,
              chat_id: row.chat_id ?? null,
              dest_path: dest,
              token_prefix: tokenPrefix,
              reason: linkErr?.message || "no_action_link",
              ip,
              user_agent: userAgent,
            });
            return redirectTo(loginFallback);
          }
          logInfo("tg.auth.exchanged", {
            userIdSuffix: String(row.user_id).slice(-8),
            dest,
          });
          await logTelegramAuthEvent({
            event: "exchanged",
            user_id: row.user_id,
            chat_id: row.chat_id ?? null,
            dest_path: dest,
            token_prefix: tokenPrefix,
            ip,
            user_agent: userAgent,
          });
          return redirectTo(data.properties.action_link as string);
        } catch (e) {
          logError("tg.auth.exception", {
            error: e instanceof Error ? e.message : String(e),
          });
          await logTelegramAuthEvent({
            event: "rejected_exception",
            user_id: row.user_id,
            chat_id: row.chat_id ?? null,
            dest_path: dest,
            token_prefix: tokenPrefix,
            reason: e instanceof Error ? e.message : String(e),
            ip,
            user_agent: userAgent,
          });
          return redirectTo(loginFallback);
        }
      },
    },
  },
});
