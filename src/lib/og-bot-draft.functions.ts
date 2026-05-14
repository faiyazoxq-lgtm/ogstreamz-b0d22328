import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runOGBotDraft } from "./og-bot-draft.server";

const Schema = z.object({
  surface: z.literal("portal-create"),
  kind: z.enum(["jokes", "music", "trade", "connect", "tools"]).optional(),
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(20)
    .default([]),
});

export const ogBotDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const out = await runOGBotDraft({
      supabase,
      userId,
      surface: data.surface,
      kind: data.kind,
      history: data.history,
      message: data.message,
    });

    // Audit any draft emission so the user has a paper trail.
    if (out.draft || out.memoryAdded.length) {
      await supabase.from("og_bot_audit").insert({
        user_id: userId,
        surface: data.surface,
        tool: out.draft ? "emit_draft" : "remember",
        args: { message: data.message, kind: data.kind ?? null },
        result: { draft: out.draft, memoryAdded: out.memoryAdded, done: out.done },
        ok: true,
      });
    }

    return out;
  });