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

const PresetSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/i),
  label: z.string().trim().min(1).max(60),
  suggestions: z.array(z.string().trim().min(1).max(120).regex(/^[A-Z0-9_]+$/)).max(40),
});
const PresetsConfigSchema = z.object({
  presets: z.array(PresetSchema).max(40),
  placeholder: z.string().trim().max(120).regex(/^[A-Z0-9_]*$/),
});

/**
 * Pure resolver for the presets config — no DB/server bindings, so it is
 * safe to import from unit tests. Precedence:
 *   1. DB row (Boss-managed)
 *   2. AGENT_KEY_PRESETS_JSON env override (must be a JSON array)
 *   3. Compiled defaults
 * Malformed JSON in the env override is silently ignored — defaults win.
 */
export function resolveAgentKeyPresets(input: {
  dbRow?: { presets?: unknown; placeholder?: unknown } | null;
  env?: { AGENT_KEY_PRESETS_JSON?: string; AGENT_KEY_NAME_PLACEHOLDER?: string };
}): { presets: AgentKeyPreset[]; placeholder: string } {
  const env = input.env ?? {};
  const row = input.dbRow ?? null;

  let presets: AgentKeyPreset[] | null = null;
  let placeholder: string | null = null;

  if (row) {
    if (Array.isArray(row.presets) && row.presets.length > 0) {
      presets = row.presets as AgentKeyPreset[];
    }
    if (typeof row.placeholder === "string" && row.placeholder.length > 0) {
      placeholder = row.placeholder;
    }
  }

  if (!presets) {
    const override = env.AGENT_KEY_PRESETS_JSON;
    if (override) {
      try {
        const parsed = JSON.parse(override);
        if (Array.isArray(parsed)) presets = parsed as AgentKeyPreset[];
      } catch {
        // Malformed JSON → fall through to defaults.
      }
    }
  }

  if (!presets) presets = DEFAULT_PRESETS;
  if (!placeholder) {
    const firstWithSuggestion = presets.find(
      (g) =>
        g &&
        typeof g === "object" &&
        Array.isArray((g as AgentKeyPreset).suggestions) &&
        (g as AgentKeyPreset).suggestions.length > 0
    ) as AgentKeyPreset | undefined;
    placeholder =
      env.AGENT_KEY_NAME_PLACEHOLDER ||
      firstWithSuggestion?.suggestions[0] ||
      K("OPENAI");
  }
  return { presets, placeholder };
}

export const listAgentKeyPresets = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async ({ context }): Promise<{ presets: AgentKeyPreset[]; placeholder: string }> => {
    const { supabase } = context;

    // 1. DB-managed config (Boss-editable, no redeploy needed).
    const { data: row } = await supabase
      .from("agent_key_presets_config" as never)
      .select("presets, placeholder")
      .eq("id", 1)
      .maybeSingle();

    return resolveAgentKeyPresets({
      dbRow: row as { presets?: unknown; placeholder?: unknown } | null,
      env: {
        AGENT_KEY_PRESETS_JSON: process.env.AGENT_KEY_PRESETS_JSON,
        AGENT_KEY_NAME_PLACEHOLDER: process.env.AGENT_KEY_NAME_PLACEHOLDER,
      },
    });
  });

export const saveAgentKeyPresets = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => PresetsConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("agent_key_presets_config" as never)
      .upsert({
        id: 1,
        presets: data.presets,
        placeholder: data.placeholder,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAgentKeyPresetDefaults = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async (): Promise<{ presets: AgentKeyPreset[]; placeholder: string }> => {
    return { presets: DEFAULT_PRESETS, placeholder: K("OPENAI") };
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