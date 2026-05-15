import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Boss-only server fns wrapping the boss_list_exposed_functions /
 * boss_list_function_grant_log / boss_revoke_function_execute /
 * boss_restore_function_execute RPCs. EXECUTE on those RPCs is granted
 * only to service_role — the admin client bypasses the lockdown.
 */

export const bossListExposedFunctions = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async () => {
    const { data, error } = await supabaseAdmin.rpc("boss_list_exposed_functions");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as any[] };
  });

export const bossListFunctionGrantLog = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async () => {
    const { data, error } = await supabaseAdmin.rpc("boss_list_function_grant_log");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as any[] };
  });

export const bossRevokeFunctionExecute = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({
      signature: z.string().min(3).max(500),
      role_name: z.enum(["anon", "authenticated", "public"]),
      reason: z.string().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).rpc("boss_revoke_function_execute", {
      _signature: data.signature,
      _role_name: data.role_name,
      _reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bossRestoreFunctionExecute = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) =>
    z.object({ log_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("boss_restore_function_execute", { _log_id: data.log_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });