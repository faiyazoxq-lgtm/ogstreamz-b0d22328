import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { z } from "zod";

const InputSchema = z.object({
  prompt: z.string().min(1).max(8000),
  system: z.string().max(4000).optional(),
  model: z.string().max(80).default("claude-sonnet-4-5"),
  maxTokens: z.number().int().min(1).max(8000).default(1024),
});

export const askClaude = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { ok: false, error: "ANTHROPIC_API_KEY is not configured" };

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: data.model,
          max_tokens: data.maxTokens,
          system: data.system,
          messages: [{ role: "user", content: data.prompt }],
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return { ok: false, error: `Claude ${res.status}: ${t.slice(0, 200)}` };
      }

      const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
      const text = (json.content ?? [])
        .map((b) => (b?.type === "text" ? b.text ?? "" : ""))
        .join("")
        .trim();
      return { ok: true, text };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Claude request failed" };
    }
  });