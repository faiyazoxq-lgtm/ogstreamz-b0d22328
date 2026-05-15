import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Runtime guard: scans pg_proc for any boss_* / admin_* function in `public`
 * that is still executable by `anon` or `authenticated`. Should always
 * return an empty `offenders` array in a fully locked-down environment.
 *
 * Used by:
 *   - the boss UI ("Verify lockdown" button on /boss/function-audit), and
 *   - the `boss-lockdown.smoke.test.ts` smoke test.
 */
export const verifyBossLockdown = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async () => {
    const { data, error } = await (supabaseAdmin as any).rpc("boss_lockdown_audit");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      schema: string;
      name: string;
      args: string;
      anon_execute: boolean;
      auth_execute: boolean;
      service_role_execute: boolean;
    }>;
    const offenders = rows.filter((r) => r.anon_execute || r.auth_execute);
    const missingServiceRole = rows.filter((r) => !r.service_role_execute);
    return {
      ok: offenders.length === 0 && missingServiceRole.length === 0,
      scanned: rows.length,
      offenders,
      missingServiceRole,
    };
  });
