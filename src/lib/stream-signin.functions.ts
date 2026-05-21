import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const IPTV_HOST = "xiu96ctyh6-system.xyz";

const InputSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256),
  redirectTo: z.string().url().max(512).optional(),
});

async function probeIptv(username: string, password: string) {
  const host = (process.env.IPTV_HOST || IPTV_HOST)
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  const url =
    `http://${host}/player_api.php` +
    `?username=${encodeURIComponent(username)}` +
    `&password=${encodeURIComponent(password)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "OGStreamz/1.0" },
    });
    if (!res.ok) return { ok: false as const };
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const info = json?.user_info ?? {};
      const auth = Number(info.auth ?? json?.auth ?? 0);
      return { ok: auth === 1 };
    } catch {
      return { ok: false as const };
    }
  } catch {
    return { ok: false as const };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Sign in using an OG Streamz (m3u/Xtream) username + password.
 *
 * Flow:
 *  1. Verify credentials against the upstream IPTV provider.
 *  2. Look up the linked Lovable user via service-role RPC (encrypted match).
 *  3. Issue a one-time magic link for that user's email and return the URL.
 *
 * The browser navigates to the returned action_link, which sets the Supabase
 * session cookie and redirects back to `redirectTo` (origin by default).
 */
export const signInWithStreamCredentials = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const probe = await probeIptv(data.username, data.password);
    if (!probe.ok) {
      return { ok: false as const, error: "Invalid OG Streamz credentials." };
    }

    const { data: userId, error: rpcErr } = await supabaseAdmin.rpc(
      "find_user_by_stream_credentials" as never,
      { _username: data.username, _password: data.password } as never,
    );
    if (rpcErr) {
      return { ok: false as const, error: "Lookup failed. Try again." };
    }
    if (!userId) {
      return {
        ok: false as const,
        error:
          "No OG Streamz account linked to those credentials. Sign up with email first, then link your stream.",
      };
    }

    const { data: u, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      String(userId),
    );
    if (userErr || !u?.user?.email) {
      return { ok: false as const, error: "Linked account is missing an email." };
    }

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: u.user.email,
      options: data.redirectTo ? { redirectTo: data.redirectTo } : undefined,
    });
    if (linkErr || !link?.properties?.action_link) {
      return { ok: false as const, error: "Could not issue sign-in link." };
    }

    return { ok: true as const, actionLink: link.properties.action_link };
  });