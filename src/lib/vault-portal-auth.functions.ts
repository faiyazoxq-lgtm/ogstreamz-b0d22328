import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { z } from "zod";
import { tagOgStreamzUser } from "@/lib/stream-tag.server";

const InputSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().trim().min(1).max(256),
});

export const vaultPortalLogin = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const domain = process.env.VAULT_PORTAL_DOMAIN;
    if (!domain) {
      return { ok: false as const, error: "Vault not configured" };
    }
    // Strip any scheme/path the operator may have stored.
    const host = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const url =
      `http://${host}:80/player_api.php` +
      `?username=${encodeURIComponent(data.username)}` +
      `&password=${encodeURIComponent(data.password)}`;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(url, {
        method: "GET",
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);
      if (!res.ok) {
        return { ok: false as const, error: `Upstream ${res.status}` };
      }
      const text = await res.text();
      let json: any;
      try { json = JSON.parse(text); } catch {
        return { ok: false as const, error: "Invalid response" };
      }
      const auth = json?.user_info?.auth ?? json?.auth;
      if (Number(auth) === 1) {
        const status = json?.user_info?.status ?? null;
        const expRaw = json?.user_info?.exp_date ?? null;
        // exp_date is usually a unix-seconds string from Xtream APIs.
        let expiresAt: string | null = null;
        if (expRaw != null) {
          const n = Number(expRaw);
          if (Number.isFinite(n) && n > 0) {
            expiresAt = new Date(n * 1000).toISOString();
          }
        }
        if (context?.userId) {
          await tagOgStreamzUser(context.userId, "vault_login", {
            expiresAt,
            status: typeof status === "string" ? status : null,
          });
        }
        // Never persist credentials. Only return non-sensitive surface info.
        return {
          ok: true as const,
          status,
          expires: expRaw,
        };
      }
      return { ok: false as const, error: "Invalid credentials" };
    } catch (e: any) {
      return { ok: false as const, error: e?.name === "AbortError" ? "Timeout" : "Network error" };
    }
  });