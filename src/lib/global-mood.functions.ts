import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { logBossAction } from "@/lib/boss-audit.functions";

/**
 * Boss-only updater for the three Global Mood · Syndicate Protocol toggles
 * exposed in /admin and /boss/ai-agent. All writes flow through here so we
 * can:
 *  - validate hub_key against an allowlist
 *  - validate enabled / mode against fixed enums
 *  - write a single atomic update
 *  - record a `global_mood.update` entry in boss_audit_log with before/after
 *
 * Without this, the panel was talking to hub_settings directly from the
 * browser — the row would change but no one could later see who flipped it
 * or when.
 */

const ALLOWED_KEYS = ["shape-bridge", "og-bot", "ff-badge"] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

export type GlobalMoodRow = {
  hub_key: AllowedKey;
  enabled: boolean;
  mode: "og" | "normal" | null;
};

export const updateGlobalMoodToggle = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { hubKey: string; enabled?: boolean; mode?: string }) => {
    const hubKey = String(d?.hubKey ?? "").trim();
    if (!ALLOWED_KEYS.includes(hubKey as AllowedKey)) {
      throw new Error(`Invalid hubKey: ${hubKey}`);
    }
    const out: { hubKey: AllowedKey; enabled?: boolean; mode?: "og" | "normal" } = {
      hubKey: hubKey as AllowedKey,
    };
    if (d.enabled !== undefined) {
      if (typeof d.enabled !== "boolean") throw new Error("enabled must be boolean");
      out.enabled = d.enabled;
    }
    if (d.mode !== undefined) {
      if (d.mode !== "og" && d.mode !== "normal") {
        throw new Error("mode must be 'og' or 'normal'");
      }
      out.mode = d.mode;
    }
    if (out.enabled === undefined && out.mode === undefined) {
      throw new Error("Nothing to update — provide enabled and/or mode");
    }
    return out;
  })
  .handler(async ({ data, context }): Promise<GlobalMoodRow> => {
    const { supabase } = context as { supabase: any };

    // Read current row for the audit before/after diff.
    const { data: current, error: readErr } = await supabase
      .from("hub_settings")
      .select("id, enabled, tuning")
      .eq("hub_key", data.hubKey)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error(`hub_settings row '${data.hubKey}' not found`);

    const prevTuning = (current.tuning ?? {}) as { mode?: string; [k: string]: unknown };
    const prevMode = prevTuning.mode === "normal" ? "normal" : "og";

    const nextEnabled = data.enabled === undefined ? !!current.enabled : data.enabled;
    const nextMode: "og" | "normal" = data.mode ?? prevMode;
    const nextTuning = { ...prevTuning, mode: nextMode };

    const { error: writeErr } = await supabase
      .from("hub_settings")
      .update({
        enabled: nextEnabled,
        tuning: nextTuning,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id);
    if (writeErr) throw new Error(writeErr.message);

    // Best-effort audit. Never block the toggle on logging.
    await logBossAction(supabase, {
      action: "global_mood.update",
      surface: "/boss/ai-agent",
      before: { enabled: !!current.enabled, mode: prevMode },
      after: { enabled: nextEnabled, mode: nextMode },
      metadata: { hub_key: data.hubKey },
    });

    return {
      hub_key: data.hubKey,
      enabled: nextEnabled,
      mode: data.hubKey === "ff-badge" ? null : nextMode,
    };
  });
