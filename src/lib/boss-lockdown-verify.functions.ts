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
    const sql = `
      select n.nspname as schema,
             p.proname as name,
             pg_get_function_identity_arguments(p.oid) as args,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
             has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (p.proname like 'boss\\_%' escape '\\'
             or p.proname like 'admin\\_%' escape '\\')
    `;
    const { data, error } = await supabaseAdmin.rpc("exec_readonly_sql", { _sql: sql });
    // Fall back to a direct REST query if the helper RPC is not present.
    let rows: any[] = [];
    if (!error && Array.isArray(data)) {
      rows = data as any[];
    } else {
      // Build the list via supabase-js by calling individual catalog views is
      // not feasible; instead, hard-fail loudly so the operator wires up
      // `exec_readonly_sql` or runs the SQL manually.
      throw new Error(
        "verifyBossLockdown: unable to read pg_proc privileges (" +
          (error?.message ?? "no helper RPC") +
          "). Run the SQL in this function's source manually against the DB.",
      );
    }
    const offenders = rows.filter(
      (r) => r.anon_execute === true || r.auth_execute === true,
    );
    const missingServiceRole = rows.filter(
      (r) => r.service_role_execute !== true,
    );
    return {
      ok: offenders.length === 0 && missingServiceRole.length === 0,
      scanned: rows.length,
      offenders,
      missingServiceRole,
    };
  });
