#!/usr/bin/env node
/**
 * Build-time guard: fails if a server-only secret is referenced from
 * client-eligible code, or if its value/name leaks into the built browser bundle.
 *
 * Usage:
 *   node scripts/check-server-secrets.mjs            # static source scan
 *   node scripts/check-server-secrets.mjs --bundle   # also scan built client assets
 *
 * Server-only secrets:
 *   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, STRIPE_SECRET_KEY,
 *   STRIPE_WEBHOOK_SECRET, LOVABLE_API_KEY, SUPABASE_JWT_SECRET,
 *   OPENAI_API_KEY, RESEND_API_KEY, SUPABASE_PUBLISHABLE_KEY (server-side only)
 *
 * A reference is "client-eligible" unless the file is in an allow-list:
 *   - *.server.ts / *.server.tsx
 *   - *.functions.ts / *.functions.tsx (TanStack server fns — server-stripped)
 *   - src/server.ts (SSR entry)
 *   - src/routes/api/** (server route handlers)
 *   - scripts/** (build-only)
 *   - supabase/** (edge function code, not bundled to client)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Names that must never appear in the client bundle or be referenced from client code.
const FORBIDDEN_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "LOVABLE_API_KEY",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "PERPLEXITY_API_KEY",
];

// Directories/files that are server-only and may legitimately reference secrets.
function isServerOnlyPath(rel) {
  const norm = rel.split(sep).join("/");
  if (norm.startsWith("scripts/")) return true;
  if (norm.startsWith("supabase/")) return true;
  if (norm.startsWith("src/routes/api/")) return true;
  if (norm === "src/server.ts" || norm === "src/server.tsx") return true;
  if (/\.server\.[cm]?[jt]sx?$/.test(norm)) return true;
  if (/\.functions\.[cm]?[jt]sx?$/.test(norm)) return true;
  return false;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".output" ||
        entry === ".tanstack" || entry === ".workspace" || entry.startsWith(".git")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) out.push(full);
  }
  return out;
}

function scanSource() {
  const files = walk(SRC);
  const re = new RegExp(
    `\\bprocess\\.env\\.(${FORBIDDEN_NAMES.join("|")})\\b|` +
    `\\bimport\\.meta\\.env\\.(${FORBIDDEN_NAMES.join("|")})\\b`,
    "g"
  );
  const violations = [];
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (isServerOnlyPath(rel)) continue;
    const src = readFileSync(f, "utf8");
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src)) !== null) {
      const name = m[1] ?? m[2];
      const line = src.slice(0, m.index).split("\n").length;
      violations.push({ file: rel, line, name });
    }
  }
  return violations;
}

function scanBundle() {
  const candidates = [
    join(ROOT, "dist", "client"),
    join(ROOT, "dist"),
    join(ROOT, ".output", "public"),
  ];
  const root = candidates.find((p) => existsSync(p));
  if (!root) {
    console.warn(`[secrets] no client bundle found (looked in ${candidates.join(", ")}) — skipping bundle scan`);
    return [];
  }
  const files = [];
  (function rec(d) {
    for (const e of readdirSync(d)) {
      const full = join(d, e);
      const s = statSync(full);
      if (s.isDirectory()) rec(full);
      else if (/\.(js|mjs|cjs|html|css|map|json|txt)$/.test(e)) files.push(full);
    }
  })(root);
  const violations = [];
  for (const f of files) {
    const txt = readFileSync(f, "utf8");
    for (const name of FORBIDDEN_NAMES) {
      if (txt.includes(name)) {
        violations.push({ file: relative(ROOT, f), name });
      }
    }
    // Detect Supabase service-role JWTs by signature ("role":"service_role")
    if (/"role"\s*:\s*"service_role"/.test(txt) ||
        /role%22%3A%22service_role/.test(txt)) {
      violations.push({ file: relative(ROOT, f), name: "<service_role JWT>" });
    }
  }
  return violations;
}

const wantBundle = process.argv.includes("--bundle");

const sourceViolations = scanSource();
const bundleViolations = wantBundle ? scanBundle() : [];

if (sourceViolations.length === 0 && bundleViolations.length === 0) {
  console.log(
    `[secrets] OK — no server-only secrets referenced in client code` +
    (wantBundle ? ` and none found in client bundle` : ``)
  );
  process.exit(0);
}

if (sourceViolations.length) {
  console.error(`\n[secrets] FAIL — server-only secret(s) referenced from client-eligible code:`);
  for (const v of sourceViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.name}`);
  }
  console.error(`\n  Move these reads into createServerFn / createServerOnlyFn,`);
  console.error(`  or rename the file to *.server.ts / *.functions.ts so it is server-stripped.`);
}

if (bundleViolations.length) {
  console.error(`\n[secrets] FAIL — secret name/value found in client bundle:`);
  for (const v of bundleViolations) {
    console.error(`  ${v.file}  ${v.name}`);
  }
}

process.exit(1);
