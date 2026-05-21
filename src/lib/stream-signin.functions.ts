import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const IPTV_HOST = "xiu96ctyh6-system.xyz";

const InputSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().trim().min(1).max(256),
});

/**
 * Sign in with OG Streamz (m3u) credentials.
 *
 * Flow:
 *  1. Verify credentials against the IPTV provider (player_api.php).
 *  2. Look up the website user_id linked to that stream username.
 *  3. Mint a magic-link `hashed_token` via admin.generateLink so the
 *     browser can call `verifyOtp` and establish a real Supabase session.
 *
 * The IPTV host URL is never sent to the client.
 */
export const signInWithStreamProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    // 1) Probe provider
    const host = (process.env.IPTV_HOST || IPTV_HOST)
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    const url =
      `http://${host}/player_api.php` +
      `?username=${encodeURIComponent(data.username)}` +
      `&password=${encodeURIComponent(data.password)}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    let info: any;
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: ctrl.signal,
        headers: { Accept: "application/json", "User-Agent": "OGStreamz/1.0" },
      });
      if (!res.ok) return { ok: false as const, error: `Upstream ${res.status}` };
      const text = await res.text();
      try { info = JSON.parse(text); } catch {
        return { ok: false as const, error: "Invalid response from provider" };
      }
    } catch (e: any) {
      return {
        ok: false as const,
        error: e?.name === "AbortError" ? "Timeout contacting provider" : "Network error",
      };
    } finally {
      clearTimeout(timer);
    }

    const auth = Number(info?.user_info?.auth ?? info?.auth ?? 0);
    if (auth !== 1) {
      return { ok: false as const, error: "Invalid stream username or password" };
    }

    // 2) Find linked website account
    const { data: uid, error: rpcErr } = await (supabaseAdmin as any).rpc(
      "find_user_id_by_stream_username",
      { _username: data.username },
    );
    if (rpcErr) {
      return { ok: false as const, error: "Lookup failed" };
    }
    if (!uid) {
      return { ok: false as const, error: "no_link" as const };
    }

    // 3) Fetch email and mint magic link token
    const { data: userRes, error: userErr } =
      await supabaseAdmin.auth.admin.getUserById(uid as string);
    if (userErr || !userRes?.user?.email) {
      return { ok: false as const, error: "Account not found" };
    }
    if ((userRes.user as any).banned_until) {
      return { ok: false as const, error: "Account is banned" };
    }

    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: userRes.user.email,
      });
    if (linkErr || !linkData?.properties?.hashed_token) {
      return { ok: false as const, error: "Could not start session" };
    }

    return {
      ok: true as const,
      tokenHash: linkData.properties.hashed_token as string,
      email: userRes.user.email as string,
    };
  });
