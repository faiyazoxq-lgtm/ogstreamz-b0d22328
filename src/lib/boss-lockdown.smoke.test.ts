import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Network smoke test: with the public (anon) key, every boss_* RPC and
 * `admin_adjust_credits` MUST be rejected by PostgREST. Skipped automatically
 * when the env vars are not present (e.g. unit-only CI runs).
 *
 * Run locally with:
 *   bunx vitest run src/lib/boss-lockdown.smoke.test.ts
 */

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

const SAMPLE_RPCS: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: "boss_list_agent_keys", args: {} },
  { name: "boss_list_vault_credentials", args: {} },
  { name: "boss_list_vip_pass_pool", args: {} },
  { name: "boss_list_stream_requests", args: { _status: "pending" } },
  { name: "boss_list_exposed_functions", args: {} },
  { name: "boss_purge_view_events", args: { _older_than: "1 day" } },
  { name: "boss_set_banned", args: { _user_id: "00000000-0000-0000-0000-000000000000", _banned: true, _reason: "smoke" } },
  { name: "boss_set_og_tier", args: { _user_id: "00000000-0000-0000-0000-000000000000", _tier: "bronze" } },
  { name: "admin_adjust_credits", args: { _user_id: "00000000-0000-0000-0000-000000000000", _delta: 1, _reason: "smoke" } },
];

const ENABLED = Boolean(url && anon);
const d = ENABLED ? describe : describe.skip;

d("boss lockdown — anon client cannot call boss_*/admin_* RPCs", () => {
  const supabase = createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  it.each(SAMPLE_RPCS)("anon → $name is denied", async ({ name, args }) => {
    const { data, error } = await supabase.rpc(name as any, args as any);
    // PostgREST returns either an error (most common) or a non-2xx wrapped
    // shape. We accept any of these denial signals; success is what fails.
    if (!error) {
      // If no error came back, the data must be empty/null AND the test
      // should still fail loudly because the call should have been rejected
      // outright at the privilege layer.
      throw new Error(
        `${name}: anon call was NOT rejected (data=${JSON.stringify(data)}). ` +
          `Expected permission denied / 401 / 404.`,
      );
    }
    const msg = (error.message || "").toLowerCase();
    const code = (error as any).code as string | undefined;
    const denied =
      code === "42501" || // permission denied for function
      code === "PGRST202" || // could not find function (revoked / not exposed)
      code === "PGRST301" || // JWT required
      msg.includes("permission denied") ||
      msg.includes("not allowed") ||
      msg.includes("could not find the function") ||
      msg.includes("jwt");
    expect(denied, `unexpected error for ${name}: ${error.message} (code=${code})`).toBe(true);
  });
});
