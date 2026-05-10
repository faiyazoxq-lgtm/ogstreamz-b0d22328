import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AlertCategory = "fallback" | "api_error";
export type AlertSeverity = "info" | "warn" | "error";

export interface SystemAlertInput {
  category: AlertCategory;
  severity?: AlertSeverity;
  source: string;
  title: string;
  message?: string;
  metadata?: Record<string, unknown>;
  related_job_id?: string | null;
}

/**
 * Server-only helper to record a system alert visible on the Boss dashboard.
 * Failures are swallowed (logged) so alert plumbing never breaks the caller.
 */
export async function recordSystemAlert(input: SystemAlertInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("system_alerts").insert({
      category: input.category,
      severity: input.severity ?? (input.category === "api_error" ? "error" : "warn"),
      source: input.source,
      title: input.title,
      message: input.message ?? null,
      metadata: (input.metadata ?? {}) as any,
      related_job_id: input.related_job_id ?? null,
    });
    if (error) console.error("[system-alerts] insert failed:", error.message);
  } catch (e) {
    console.error("[system-alerts] threw:", e);
  }
}