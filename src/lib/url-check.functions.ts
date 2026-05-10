import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  url: z.string().trim().min(1).max(2048),
});

export const checkUrlReachable = createServerFn({ method: "POST" })
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
        finalUrl: res.url,
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
