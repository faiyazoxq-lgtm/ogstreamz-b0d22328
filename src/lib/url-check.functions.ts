import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  url: z.string().trim().min(1).max(2048),
});

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  // IPv6 loopback / link-local / unique-local
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  // IPv4 literal check
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export const checkUrlReachable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    let normalized = data.url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    let target: URL;
    try {
      target = new URL(normalized);
    } catch {
      return { ok: false, error: "Invalid URL" };
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return { ok: false, error: "URL must use http or https" };
    }
    if (isPrivateHost(target.hostname)) {
      return { ok: false, error: "Hostname not allowed" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const started = Date.now();
    try {
      let res: Response;
      try {
        res = await fetch(target.toString(), {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
        });
      } catch {
        // Some hosts block HEAD — retry with a tiny GET.
        res = await fetch(target.toString(), {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { range: "bytes=0-0" },
        });
      }
      const ms = Date.now() - started;
      return {
        ok: res.ok || res.status === 405 || res.status === 403,
        status: res.status,
        ms,
      };
    } catch (e: any) {
      return {
        ok: false,
        error:
          e?.name === "AbortError"
            ? "Request timed out after 7s"
            : e?.message || "Unreachable",
      };
    } finally {
      clearTimeout(timer);
    }
  });
