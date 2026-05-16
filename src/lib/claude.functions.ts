import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { z } from "zod";
import { callClaude } from "@/lib/claude.server";

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
    return callClaude({
      prompt: data.prompt,
      system: data.system,
      model: data.model,
      maxTokens: data.maxTokens,
    });
  });