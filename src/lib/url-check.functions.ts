import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
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
  .middleware([requireStrictAuth])
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
      // Manually follow redirects so each hop's host can be re-validated
      // against the private-IP denylist (prevents SSRF via 3xx into
      // 169.254.169.254 / RFC1918 / loopback).
      let current = target;
      let res: Response | null = null;
      const MAX_REDIRECTS = 5;
      for (let i = 0; i <= MAX_REDIRECTS; i++) {
        if (current.protocol !== "http:" && current.protocol !== "https:") {
          return { ok: false, error: "Redirect to non-http(s) blocked" };
        }
        if (isPrivateHost(current.hostname)) {
          return { ok: false, error: "Redirect to internal host blocked" };
        }
        try {
          res = await fetch(current.toString(), {
            method: "HEAD",
            redirect: "manual",
            signal: controller.signal,
          });
        } catch {
          // Some hosts block HEAD — retry with a tiny GET.
          res = await fetch(current.toString(), {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
            headers: { range: "bytes=0-0" },
          });
        }
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) break;
          let next: URL;
          try {
            next = new URL(loc, current);
          } catch {
            return { ok: false, error: "Invalid redirect target" };
          }
          current = next;
          continue;
        }
        break;
      }
      if (!res) return { ok: false, error: "No response" };
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
