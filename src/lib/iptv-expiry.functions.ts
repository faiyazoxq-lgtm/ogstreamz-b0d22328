import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const IPTV_HOST = "xiu96ctyh6-system.xyz";

const InputSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().trim().min(1).max(256),
});

/**
 * Server-side IPTV expiry checker. The upstream URL is never exposed to
 * the client — the user only supplies their username & password.
 *
 * We hit the Xtream `player_api.php` JSON endpoint on the same host as
 * the configured m3u_plus URL to read `user_info.exp_date` and friends.
 */
export const checkIptvExpiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const host = (process.env.IPTV_HOST || IPTV_HOST)
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    const url =
      `http://${host}/player_api.php` +
      `?username=${encodeURIComponent(data.username)}` +
      `&password=${encodeURIComponent(data.password)}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: ctrl.signal,
        headers: { Accept: "application/json", "User-Agent": "OGStreamz/1.0" },
      });
      if (!res.ok) {
        return { ok: false as const, error: `Upstream ${res.status}` };
      }
      const text = await res.text();
      let json: any;
      try { json = JSON.parse(text); } catch {
        return { ok: false as const, error: "Invalid response from provider" };
      }
      const info = json?.user_info ?? {};
      const auth = Number(info.auth ?? json?.auth ?? 0);
      if (auth !== 1) {
        return { ok: false as const, error: "Invalid credentials" };
      }

      const expRaw = info.exp_date ?? null;
      let expiresAt: string | null = null;
      if (expRaw != null) {
        const n = Number(expRaw);
        if (Number.isFinite(n) && n > 0) {
          expiresAt = new Date(n * 1000).toISOString();
        }
      }

      return {
        ok: true as const,
        status: typeof info.status === "string" ? info.status : null,
        expiresAt,
        expiresRaw: expRaw != null ? String(expRaw) : null,
        activeConnections:
          info.active_cons != null ? Number(info.active_cons) : null,
        maxConnections:
          info.max_connections != null ? Number(info.max_connections) : null,
        isTrial: info.is_trial === "1" || info.is_trial === 1 || false,
        createdAt: info.created_at
          ? new Date(Number(info.created_at) * 1000).toISOString()
          : null,
      };
    } catch (e: any) {
      return {
        ok: false as const,
        error: e?.name === "AbortError" ? "Timeout" : "Network error",
      };
    } finally {
      clearTimeout(timer);
    }
  });