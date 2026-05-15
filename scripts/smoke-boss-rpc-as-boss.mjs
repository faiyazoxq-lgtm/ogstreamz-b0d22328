#!/usr/bin/env node
/**
 * Boss-positive smoke test (PostgREST surface).
 *
 * Provisions a throwaway boss user (profiles.rank='boss' + user_roles.role
 * 'admin') and tries to call every public.boss_* / admin_* RPC directly via
 * PostgREST as that boss-authenticated user.
 *
 * EXPECTED OUTCOME for THIS project: every call returns 42501 "permission
 * denied for function". boss_* / admin_* RPCs are intentionally only
 * EXECUTE-able by service_role; the Boss UI reaches them through TanStack
 * server functions (createServerFn + supabaseAdmin) that gate on rank='boss'
 * BEFORE elevating to service_role. That extra hop is the defense-in-depth
 * guarantee we want — a stolen user JWT (even one with rank='boss') can
 * never reach these RPCs by hitting /rest/v1/rpc/<name> directly.
 *
 * Exit 0 = every RPC behaves as designed (42501 to a boss-authenticated
 *         direct PostgREST call, OR a non-42501 response which means the
 *         RPC accidentally exposes itself to the authenticated role).
 * Exit 1 = at least one RPC is reachable directly by a boss-authenticated
 *         user — which is suspicious and worth a manual review (it means
 *         the RPC bypasses the server-fn elevation chokepoint).
 */
import { execFileSync } from "node:child_process";

const URL = process.env.SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SR || !PUB) {
  console.error("missing env (SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY/SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(2);
}

// --- discover boss_/admin_ RPCs (IN params only, via args_sig) ----------
const sql = `
  SELECT p.proname || '|' || pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname LIKE 'boss\\_%' OR p.proname LIKE 'admin\\_%')
  ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);
`;
const raw = execFileSync("psql", ["-At", "-c", sql], { encoding: "utf8" });
function parseArgsSig(sig) {
  if (!sig) return [];
  const parts = []; let depth = 0, buf = "";
  for (const ch of sig) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(buf.trim()); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.map((p) => {
    const noDefault = p.replace(/\s+DEFAULT\s+.*$/i, "").trim();
    const m = noDefault.match(/^(\S+)\s+(.+)$/);
    return m ? { name: m[1], type: m[2] } : null;
  }).filter(Boolean);
}
const fns = raw.trim().split("\n").filter(Boolean).map((line) => {
  const [name, args_sig = ""] = line.split("|");
  return { name, args_sig, args: parseArgsSig(args_sig) };
});
console.log(`Discovered ${fns.length} boss_/admin_ RPCs.\n`);

// --- synthetic args -----------------------------------------------------
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const FUTURE_TS = "2099-01-01T00:00:00Z";
function dummyForType(t, name) {
  const lt = String(t).toLowerCase();
  if (lt === "uuid") return ZERO_UUID;
  if (lt === "boolean") return false;
  if (["integer","bigint","smallint","numeric"].includes(lt)) return 0;
  if (lt.includes("timestamp") || lt === "date") return FUTURE_TS;
  if (lt === "jsonb" || lt === "json") return {};
  if (lt.endsWith("[]")) return [];
  // user-defined enums: pick a known-safe value where we can guess
  if (lt === "syndicate_rank") return "prospect";
  if (lt === "og_tier") return "free";
  if (lt === "app_role") return "user";
  return name?.includes("email") ? "x@x.test" : "x";
}
function buildArgs(fn) {
  const obj = {};
  for (const { name, type } of fn.args) obj[name] = dummyForType(type, name);
  return obj;
}

// --- provision boss user -----------------------------------------------
const email = `boss-smoke+${Date.now()}@ogstreamz.test`;
const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`;
const created = await fetch(`${URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then((r) => r.json());
const userId = created.id;
if (!userId) {
  console.error("failed to create user:", created);
  process.exit(2);
}

// Elevate via service-role REST (bypasses RLS). The handle_new_user trigger
// usually creates a profile row already; we PATCH the rank either way and
// insert the admin role for belt-and-suspenders coverage.
async function srFetch(path, init = {}) {
  return fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=merge-duplicates",
      ...(init.headers || {}),
    },
  });
}
await srFetch(`profiles?on_conflict=id`, {
  method: "POST",
  body: JSON.stringify([{ id: userId, email, rank: "boss" }]),
});
await srFetch(`profiles?id=eq.${userId}`, {
  method: "PATCH",
  body: JSON.stringify({ rank: "boss" }),
});
await srFetch(`user_roles?on_conflict=user_id,role`, {
  method: "POST",
  body: JSON.stringify([{ user_id: userId, role: "admin" }]),
});
console.log(`Provisioned boss user ${email} (${userId})\n`);

const jwt = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: PUB, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json()).then((b) => b.access_token);

// --- call every RPC as the boss user ------------------------------------
async function callRpc(name, args) {
  const res = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: PUB, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return { status: res.status, body: (await res.text()).slice(0, 220) };
}

// In this project, "denied to boss" is the EXPECTED outcome.
const expectedDenied = []; // 42501 — correct: only service_role can EXECUTE
const reachable = [];      // 2xx or non-42501 4xx — the boss reached the body

for (const fn of fns) {
  const r = await callRpc(fn.name, buildArgs(fn));
  const isExecuteDenied =
    r.status === 403 && /permission denied for function/i.test(r.body);
  if (isExecuteDenied) {
    expectedDenied.push({ ...r, name: fn.name });
    console.log(`[EXPECTED 42501] ${fn.name}(${fn.args_sig})`);
  } else {
    reachable.push({ ...r, name: fn.name });
    console.log(`[REACHABLE ${r.status}] ${fn.name}(${fn.args_sig}) :: ${r.body}`);
  }
}

// --- cleanup ------------------------------------------------------------
await srFetch(`user_roles?user_id=eq.${userId}`, { method: "DELETE" }).catch(() => {});
await srFetch(`profiles?id=eq.${userId}`, { method: "DELETE" }).catch(() => {});
await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
  method: "DELETE",
  headers: { apikey: SR, Authorization: `Bearer ${SR}` },
}).catch(() => {});

// --- report -------------------------------------------------------------
console.log(`\n=== Boss-positive PostgREST surface summary ===`);
console.log(`EXPECTED 42501 (only service_role can EXECUTE): ${expectedDenied.length}`);
console.log(`Reachable directly by boss JWT (review):        ${reachable.length}`);
console.log(`\nNOTE: boss_*/admin_* RPCs are intentionally not callable from a`);
console.log(`browser/JWT session in this project. The Boss UI reaches them via`);
console.log(`TanStack server functions in src/lib/*.functions.ts that gate on`);
console.log(`rank='boss' and then elevate to service_role.`);
if (reachable.length) {
  console.error(`\n!!! ${reachable.length} RPC(s) reachable directly by an authenticated boss — verify intent !!!`);
  for (const r of reachable) console.error(` - ${r.name} ${r.status} :: ${r.body}`);
  process.exit(1);
}
