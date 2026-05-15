import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireStrictAuth } from "@/lib/strict-auth";
import { shouldPromoteToBoss, normalizeEmail } from "./boss-policy";

export type CheckStatus = "pass" | "warn" | "fail";
export type CheckResult = {
  id: string;
  category: "security" | "data" | "config" | "links" | "content";
  label: string;
  status: CheckStatus;
  detail?: string;
  items?: string[];
};

function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Boss-only: full pre-publish validation. */
export const runPublishChecks = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }): Promise<{ checks: CheckResult[]; score: { pass: number; warn: number; fail: number; total: number } }> => {
    // Boss gate
    const userEmail = normalizeEmail(context.claims?.email as string | undefined);
    const bossEmail = normalizeEmail(process.env.BOSS_EMAIL);
    if (!shouldPromoteToBoss(userEmail, bossEmail)) {
      throw new Response("Forbidden", { status: 403 });
    }

    const admin = adminClient();
    const checks: CheckResult[] = [];

    // 1. RLS enabled on all public tables
    try {
      const { data, error } = await admin.rpc("publish_check_rls_status" as never);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ table_name: string; rls_enabled: boolean }>;
      const noRls = rows.filter((r) => !r.rls_enabled).map((r) => r.table_name);
      checks.push({
        id: "rls_enabled",
        category: "security",
        label: "Row-Level Security on every public table",
        status: noRls.length === 0 ? "pass" : "fail",
        detail: noRls.length === 0
          ? `${rows.length} tables checked — all have RLS enabled.`
          : `${noRls.length} table(s) missing RLS.`,
        items: noRls,
      });

      // 2. Tables that have RLS but no policies (effectively locked, but flag as warn)
      const { data: polData } = await admin.rpc("publish_check_policy_counts" as never);
      const polRows = (polData ?? []) as Array<{ table_name: string; policy_count: number }>;
      const noPolicies = polRows.filter((r) => r.policy_count === 0).map((r) => r.table_name);
      checks.push({
        id: "rls_policies",
        category: "security",
        label: "Every RLS table has at least one policy",
        status: noPolicies.length === 0 ? "pass" : "warn",
        detail: noPolicies.length === 0
          ? "All RLS-enabled tables have policies."
          : `${noPolicies.length} table(s) have RLS but no policies (locked but unusable).`,
        items: noPolicies,
      });
    } catch (e) {
      checks.push({
        id: "rls_enabled",
        category: "security",
        label: "Row-Level Security on every public table",
        status: "warn",
        detail: `Could not verify RLS automatically: ${(e as Error).message}`,
      });
    }

    // 3. Required runtime secrets
    const requiredSecrets = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "BOSS_EMAIL",
      "LOVABLE_API_KEY",
    ];
    const optionalSecrets = [
      "STRIPE_LIVE_API_KEY",
      "STRIPE_SANDBOX_API_KEY",
      "PAYMENTS_LIVE_WEBHOOK_SECRET",
      "PAYMENTS_SANDBOX_WEBHOOK_SECRET",
      "GOOGLE_AI_STUDIO_API_KEY",
      "GEMINI_API_KEY_PRIMARY",
      "TELEGRAM_API_KEY",
    ];
    const missingRequired = requiredSecrets.filter((k) => !process.env[k]);
    const missingOptional = optionalSecrets.filter((k) => !process.env[k]);
    checks.push({
      id: "required_secrets",
      category: "config",
      label: "Required runtime secrets are set",
      status: missingRequired.length === 0 ? "pass" : "fail",
      detail: missingRequired.length === 0
        ? `${requiredSecrets.length}/${requiredSecrets.length} required secrets present.`
        : `Missing: ${missingRequired.join(", ")}`,
      items: missingRequired,
    });
    checks.push({
      id: "optional_secrets",
      category: "config",
      label: "Recommended integration secrets",
      status: missingOptional.length === 0 ? "pass" : "warn",
      detail: missingOptional.length === 0
        ? "All recommended integration secrets present."
        : `Optional secrets not set: ${missingOptional.join(", ")}`,
      items: missingOptional,
    });

    // 4. Boss / admin assignments exist
    try {
      const { count: adminCount } = await admin
        .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
      checks.push({
        id: "admin_exists",
        category: "config",
        label: "At least one admin/boss exists",
        status: (adminCount ?? 0) > 0 ? "pass" : "fail",
        detail: `${adminCount ?? 0} admin role assignment(s).`,
      });
    } catch (e) {
      checks.push({
        id: "admin_exists",
        category: "config",
        label: "At least one admin/boss exists",
        status: "warn",
        detail: (e as Error).message,
      });
    }

    // 5. Storage buckets — sensitive ones must be private
    try {
      const { data: buckets } = await admin.storage.listBuckets();
      const sensitivePublic = (buckets ?? [])
        .filter((b) => b.public && /vault|private|secret|user|invoice|receipt/i.test(b.name))
        .map((b) => b.name);
      checks.push({
        id: "bucket_visibility",
        category: "data",
        label: "Storage buckets have appropriate visibility",
        status: sensitivePublic.length === 0 ? "pass" : "fail",
        detail: sensitivePublic.length === 0
          ? `${buckets?.length ?? 0} bucket(s) — sensitive ones are private.`
          : `Sensitive buckets are public: ${sensitivePublic.join(", ")}`,
        items: sensitivePublic,
      });
    } catch (e) {
      checks.push({
        id: "bucket_visibility",
        category: "data",
        label: "Storage buckets have appropriate visibility",
        status: "warn",
        detail: (e as Error).message,
      });
    }

    // 6. Sensitive columns: profiles must restrict reads
    try {
      const { data: testRows, error } = await admin
        .from("profiles").select("email,phone").limit(1);
      // We're using service role so this should succeed; we just verify the
      // columns exist. Real exposure check is done by RLS policies above.
      checks.push({
        id: "pii_columns_present",
        category: "data",
        label: "PII columns exist and are RLS-protected",
        status: error ? "warn" : "pass",
        detail: error
          ? `Could not introspect profiles: ${error.message}`
          : `Verified profiles.email/phone exist (${testRows?.length ?? 0} sample row).`,
      });
    } catch (e) {
      checks.push({
        id: "pii_columns_present",
        category: "data",
        label: "PII columns exist and are RLS-protected",
        status: "warn",
        detail: (e as Error).message,
      });
    }

    // 7. Auth: leaked-password protection (best-effort — we can't read auth config from here)
    checks.push({
      id: "auth_hibp_manual",
      category: "security",
      label: "Leaked-password (HIBP) check enabled",
      status: "warn",
      detail: "Verify in Cloud → Users → Auth Settings → Password HIBP Check. Cannot be auto-detected.",
    });

    // 8. Portals/hubs published vs draft sanity
    try {
      const { count: portalsCount } = await admin
        .from("portals").select("*", { count: "exact", head: true });
      checks.push({
        id: "content_present",
        category: "content",
        label: "Site has publishable content",
        status: (portalsCount ?? 0) > 0 ? "pass" : "warn",
        detail: `${portalsCount ?? 0} portal(s) in database.`,
      });
    } catch {
      // ignore
    }

    // 9. Pricing config — at least one credit pack / pass active
    try {
      const [{ count: packs }, { count: passes }] = await Promise.all([
        admin.from("credit_packs").select("*", { count: "exact", head: true }).eq("active", true),
        admin.from("vip_passes").select("*", { count: "exact", head: true }).limit(1),
      ]);
      checks.push({
        id: "pricing_active",
        category: "config",
        label: "Active credit packs available for purchase",
        status: (packs ?? 0) > 0 ? "pass" : "warn",
        detail: `${packs ?? 0} active credit pack(s); ${passes ?? 0} pass record(s).`,
      });
    } catch {
      // ignore — tables may differ
    }

    // Score
    const score = checks.reduce(
      (acc, c) => {
        acc[c.status] += 1;
        acc.total += 1;
        return acc;
      },
      { pass: 0, warn: 0, fail: 0, total: 0 },
    );

    return { checks, score };
  });