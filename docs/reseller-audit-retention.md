# Reseller admin audit — retention & archive

## Policy

- **Live table:** `public.reseller_admin_audit` keeps the most recent **90 days** of `bossCreateReseller` / `bossTopupReseller` events.
- **Archive table:** `public.reseller_admin_audit_archive` stores everything older than 90 days, indefinitely. Original `id` and `created_at` are preserved; `archived_at` records when the row was moved.
- **Job:** Postgres function `public.archive_reseller_admin_audit(_retention_days int default 90)` moves rows older than the cutoff in a single transaction and returns the number of rows archived.
- **Schedule:** `pg_cron` job `archive-reseller-admin-audit-daily` runs every day at **03:15 UTC**.

Both tables have RLS enabled with **no policies** — they are reachable only via the service-role client (`supabaseAdmin`) used by trusted server functions. anon / authenticated roles have no access.

## Accessing archived logs

All access goes through service-role server-side code. Two supported paths:

### 1. From a boss-gated server function

```ts
// e.g. in a new src/lib/boss-audit-archive.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const bossListResellerAuditArchive = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .inputValidator((d: { targetUserId?: string; limit?: number }) => ({
    targetUserId: d.targetUserId ?? null,
    limit: Math.min(Math.max(Number(d.limit ?? 200), 1), 1000),
  }))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("reseller_admin_audit_archive")
      .select("id,action,actor_user_id,target_user_id,reseller_id,delta,reason,created_at,archived_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.targetUserId) q = q.eq("target_user_id", data.targetUserId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
```

### 2. Direct SQL (Lovable Cloud → SQL editor, postgres role)

```sql
-- Recent archive entries for a reseller
SELECT created_at, action, delta, reason, actor_user_id
FROM public.reseller_admin_audit_archive
WHERE target_user_id = '<uuid>'
ORDER BY created_at DESC
LIMIT 100;

-- Combined live + archive view (ad-hoc)
SELECT created_at, action, delta, reason, actor_user_id, target_user_id, 'live' AS source
FROM public.reseller_admin_audit
UNION ALL
SELECT created_at, action, delta, reason, actor_user_id, target_user_id, 'archive'
FROM public.reseller_admin_audit_archive
ORDER BY created_at DESC
LIMIT 200;
```

## Operations

- **Run archive immediately:** `SELECT public.archive_reseller_admin_audit(90);` (returns rows moved).
- **Change retention window:** pass a different value, e.g. `SELECT public.archive_reseller_admin_audit(30);`. To make the change permanent, unschedule and re-create the cron job with the new arg.
- **Inspect the schedule:** `SELECT * FROM cron.job WHERE jobname = 'archive-reseller-admin-audit-daily';`
- **Inspect runs:** `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'archive-reseller-admin-audit-daily') ORDER BY start_time DESC LIMIT 20;`
- **Disable:** `SELECT cron.unschedule('archive-reseller-admin-audit-daily');`

## Why no purge?

Archive rows are kept indefinitely for traceability of historical credit movements. If/when a hard-delete policy is required (e.g. data-protection request), add a separate explicit job — do not extend the archive function.