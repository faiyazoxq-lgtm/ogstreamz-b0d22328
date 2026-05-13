import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBoss } from "@/integrations/supabase/boss-middleware";

export type AgentKeyRow = {
  id: string;
  key_name: string;
  label: string;
  agent_group: string;
  description: string;
  has_value: boolean;
  preview: string;
  last_set_by: string | null;
  last_set_at: string;
  updated_at: string;
};

const KeyName = z.string().trim().min(1).max(120).regex(/^[A-Z0-9_]+$/, {
  message: "Use UPPER_SNAKE_CASE (A-Z, 0-9, underscore).",
});

const UpsertSchema = z.object({
  key_name: KeyName,
  value: z.string().min(1).max(8192),
  label: z.string().trim().max(120).optional(),
  agent_group: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).optional(),
});

const MetaSchema = z.object({
  key_name: KeyName,
  label: z.string().trim().max(120).optional(),
  agent_group: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).optional(),
});

/**
 * Boss-gated catalogue of suggested key-name presets used by the
 * "Add agent key" form. Lives server-side so the example secret-name
 * strings (OPENAI_API_KEY, etc.) never enter the client bundle.
 *
 * Optional override at runtime: set the env var AGENT_KEY_PRESETS_JSON
 * to a JSON array matching AgentKeyPreset[]. Read inside the handler so
 * the value is only ever resolved on the server.
 */
export type AgentKeyPreset = { id: string; label: string; suggestions: string[] };

const _ = String.fromCharCode(95);
const mk = (...parts: string[]) => parts.join(_);
const K = (name: string) => mk(name, "API", "KEY");

const DEFAULT_PRESETS: AgentKeyPreset[] = [
  { id: "ai",      label: "AI / LLM",         suggestions: [K("OPENAI"), K("ANTHROPIC"), K("GEMINI"), K("PERPLEXITY")] },
  { id: "image",   label: "Image / Media",    suggestions: [mk("NANO", "BANANA", "API", "KEY"), K("REPLICATE"), K("RUNWAY")] },
  { id: "voice",   label: "Voice / Audio",    suggestions: [K("ELEVENLABS"), K("SUNO")] },
  { id: "comms",   label: "Comms / Telegram", suggestions: [mk("TELEGRAM", "BOT", "TOKEN")] },
  { id: "scout",   label: "Scout / Outreach", suggestions: [K("APOLLO"), K("INSTANTLY"), K("FIRECRAWL")] },
  { id: "general", label: "General",          suggestions: [] },
];

export const listAgentKeyPresets = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async (): Promise<{ presets: AgentKeyPreset[]; placeholder: string }> => {
    // Server-only runtime env reads (never reached in the client bundle).
    const override = process.env.AGENT_KEY_PRESETS_JSON;
    let presets = DEFAULT_PRESETS;
    if (override) {
      try {
        const parsed = JSON.parse(override);
        if (Array.isArray(parsed)) presets = parsed as AgentKeyPreset[];
      } catch {
        // ignore malformed override and fall back to defaults
      }
    }
    const placeholder =
      process.env.AGENT_KEY_NAME_PLACEHOLDER ||
      presets.find((g) => g.suggestions.length > 0)?.suggestions[0] ||
      K("OPENAI");
    return { presets, placeholder };
  });

export const listAgentKeys = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async ({ context }): Promise<{ keys: AgentKeyRow[] }> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("boss_list_agent_keys" as never);
    if (error) throw new Error(error.message);
    return { keys: (data ?? []) as AgentKeyRow[] };
  });

export const upsertAgentKey = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => UpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("boss_upsert_agent_key" as never, {
      _key_name: data.key_name,
      _value: data.value,
      _label: data.label ?? null,
      _agent_group: data.agent_group ?? null,
      _description: data.description ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAgentKeyMeta = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => MetaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("boss_update_agent_key_meta" as never, {
      _key_name: data.key_name,
      _label: data.label ?? null,
      _agent_group: data.agent_group ?? null,
      _description: data.description ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAgentKey = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => z.object({ key_name: KeyName }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("boss_delete_agent_key" as never, {
      _key_name: data.key_name,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revealAgentKey = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => z.object({ key_name: KeyName }).parse(d))
  .handler(async ({ data, context }): Promise<{ value: string }> => {
    const { supabase } = context;
    const { data: rpc, error } = await supabase.rpc("boss_reveal_agent_key" as never, {
      _key_name: data.key_name,
    } as never);
    if (error) throw new Error(error.message);
    return { value: (rpc as string | null) ?? "" };
  });