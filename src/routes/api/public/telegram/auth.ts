import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { logError, logInfo, logWarn } from "@/lib/server-log.server";
import { siteBase } from "@/lib/telegram-auth-link.server";

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

        if (!token || token.length < 16 || token.length > 128) {
          return redirectTo(loginFallback);
        }

        const sb = admin();
        const { data: row, error } = await (sb.from("telegram_auth_tokens") as any)
          .select("token,user_id,dest_path,expires_at,used_at")
          .eq("token", token)
          .maybeSingle();

        if (error || !row) {
          logWarn("tg.auth.token_not_found", { hasToken: !!token });
          return redirectTo(loginFallback);
        }
        if (row.used_at) {
          logWarn("tg.auth.token_already_used", { userIdSuffix: String(row.user_id).slice(-8) });
          return redirectTo(loginFallback);
        }
        if (new Date(row.expires_at).getTime() < Date.now()) {
          logWarn("tg.auth.token_expired", { userIdSuffix: String(row.user_id).slice(-8) });
          return redirectTo(loginFallback);
        }

        // Burn the token before issuing the magic link so a race can't reuse it.
        await (sb.from("telegram_auth_tokens") as any)
          .update({ used_at: new Date().toISOString() })
          .eq("token", token)
          .is("used_at", null);

        // Look up the bound profile's email so we can mint a magic link for them.
        const { data: prof } = await (sb.from("profiles") as any)
          .select("email")
          .eq("id", row.user_id)
          .maybeSingle();
        const email = (prof?.email as string | undefined)?.trim();
        if (!email) {
          logError("tg.auth.no_email", { userIdSuffix: String(row.user_id).slice(-8) });
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
            return redirectTo(loginFallback);
          }
          logInfo("tg.auth.exchanged", {
            userIdSuffix: String(row.user_id).slice(-8),
            dest,
          });
          return redirectTo(data.properties.action_link as string);
        } catch (e) {
          logError("tg.auth.exception", {
            error: e instanceof Error ? e.message : String(e),
          });
          return redirectTo(loginFallback);
        }
      },
    },
  },
});
