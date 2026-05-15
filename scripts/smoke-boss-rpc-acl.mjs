#!/usr/bin/env node
/**
 * Smoke test: every public.boss_* (and admin_*) RPC must be EXECUTE-denied
 * to anon and to authenticated non-boss users, and reachable only by
 * service_role. The list is discovered dynamically from pg_proc so newly
 * added boss RPCs are covered automatically.
 *
 * Required env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Exit 0 = all RPCs correctly locked down.
 * Exit 1 = at least one RPC leaked to anon/authenticated, or service_role
 *         was unexpectedly EXECUTE-denied.
 */
import { Client } from "pg";

const URL = process.env.SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
const DB = process.env.SUPABASE_DB_URL || (process.env.PGHOST
  ? `postgres://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD)}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`
  : null);

if (!URL || !SR || !PUB || !DB) {
  console.error("missing env (SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY/SUPABASE_SERVICE_ROLE_KEY/PG*)");
  process.exit(2);
}

// 1. Discover every boss_/admin_ RPC + its arg names/types
const pg = new Client({ connectionString: DB });
await pg.connect();
const { rows: fns } = await pg.query(`
  SELECT
    p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS args_sig,
    p.proargnames AS arg_names,
    p.proargtypes::regtype[] AS arg_types,
    p.pronargdefaults AS n_defaults,
    p.pronargs AS n_args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname LIKE 'boss\\_%' OR p.proname LIKE 'admin\\_%')
  ORDER BY p.proname, args_sig;
`);
await pg.end();

console.log(`Discovered ${fns.length} boss_/admin_ RPCs in public schema.\n`);

// 2. Build a synthetic args object for each fn (named-arg invocation).
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const FUTURE_TS = "2099-01-01T00:00:00Z";
function dummyForType(t, name) {
  const lt = String(t).toLowerCase();
  if (lt === "uuid") return ZERO_UUID;
  if (lt === "boolean") return false;
  if (lt === "integer" || lt === "bigint" || lt === "smallint" || lt === "numeric") return 0;
  if (lt.includes("timestamp") || lt === "date") return FUTURE_TS;
  if (lt === "jsonb" || lt === "json") return {};
  if (lt.endsWith("[]")) return [];
  if (lt === "text" || lt === "character varying") return name?.includes("email") ? "x@x.test" : "x";
  // user-defined enums fall through here — best-effort empty string; many will
  // still get rejected by the EXECUTE check before validation runs.
  return "x";
}
function buildArgs(fn) {
  const obj = {};
  if (!fn.arg_names) return obj;
  for (let i = 0; i < fn.arg_names.length; i++) {
    const n = fn.arg_names[i];
    if (!n) continue;
    obj[n.startsWith("_") ? n : `_${n}`] = dummyForType(fn.arg_types[i], n);
  }
  return obj;
}

// 3. Provision a throwaway authenticated non-boss user.
const email = `acl-smoke+${Date.now()}@ogstreamz.test`;
const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`;
const created = await fetch(`${URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then(r => r.json());
const userId = created.id;
const userJwt = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: PUB, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
}).then(r => r.json()).then(b => b.access_token);
console.log(`Provisioned non-boss user ${email}\n`);

// 4. Hit each RPC as three identities and classify.
async function callRpc(name, args, identity) {
  const headers = { apikey: PUB, "Content-Type": "application/json" };
  if (identity === "anon") headers.Authorization = `Bearer ${PUB}`;
  if (identity === "authed") headers.Authorization = `Bearer ${userJwt}`;
  if (identity === "service") {
    headers.apikey = SR;
    headers.Authorization = `Bearer ${SR}`;
  }
  const res = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  return { status: res.status, body: (await res.text()).slice(0, 220) };
}
const isExecuteDenied = (r) =>
  r.status === 401 || r.status === 403 || /permission denied for function/i.test(r.body);

const failures = [];
for (const fn of fns) {
  const args = buildArgs(fn);
  const [a, u, s] = await Promise.all([
    callRpc(fn.name, args, "anon"),
    callRpc(fn.name, args, "authed"),
    callRpc(fn.name, args, "service"),
  ]);
  const anonOk = isExecuteDenied(a);
  const authedOk = isExecuteDenied(u);
  // service_role should NOT be EXECUTE-denied. It MAY return another error
  // (bad UUID, missing target row, enum cast) — that's fine; what we're
  // verifying is the absence of a 42501.
  const serviceOk = !/permission denied for function/i.test(s.body);
  const ok = anonOk && authedOk && serviceOk;
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${fn.name}(${fn.args_sig})`);
  console.log(`        anon=${a.status} authed=${u.status} service=${s.status}`);
  if (!ok) {
    if (!anonOk) console.log(`        anon LEAK: ${a.body}`);
    if (!authedOk) console.log(`        authed LEAK: ${u.body}`);
    if (!serviceOk) console.log(`        service DENIED: ${s.body}`);
    failures.push(fn.name);
  }
}

// 5. Cleanup
await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
  method: "DELETE",
  headers: { apikey: SR, Authorization: `Bearer ${SR}` },
}).catch(() => {});

console.log(`\n${fns.length - failures.length}/${fns.length} RPCs correctly locked to service_role.`);
if (failures.length) {
  console.error(`\n${failures.length} FAILURES: ${failures.join(", ")}`);
  process.exit(1);
}
