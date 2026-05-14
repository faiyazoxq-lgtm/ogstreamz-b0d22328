#!/usr/bin/env node
/**
 * Build-time guard: validate that every "HUB link" — anything pointing at
 * a slug-based portal route (/m/:slug, /p/:slug, /td/:slug, /b/:slug,
 * /t/:slug, /f/:slug, /hub/:slug) — actually resolves to a real row in
 * the database.
 *
 * Two link sources are checked:
 *
 *   1. DB-stored links — `public.custom_hubs.href`. These are the curated
 *      tiles that show on the home grid and elsewhere; if they point at a
 *      portal that no longer exists, users hit a 404.
 *
 *   2. Source-code links — any string literal in `src/` of the form
 *      "/{m|p|td|b|t|f|hub}/<slug>" that is NOT a route param template
 *      ("/m/$slug") and NOT an example placeholder. Today the codebase
 *      uses dynamic `params={{ slug }}` everywhere, so this is mostly a
 *      regression guard.
 *
 * Resolution rules:
 *   /m/<s>   → portals.slug AND kind='music'
 *   /td/<s>  → portals.slug AND kind='trade'
 *   /f/<s>   → portals.slug AND kind='form'
 *   /p/<s>   → portals.slug (any kind: joke / news / generic)
 *   /b/<s>   → battles.slug
 *   /t/<s>   → calculators.slug
 *   /hub/<s> → custom_hubs.slug
 *
 * Behaviour:
 *   - Exits 0 with a warning if Supabase env vars are missing (so offline
 *     / detached builds still pass — the CI pipeline supplies them).
 *   - Exits 1 if any link cannot be resolved.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SRC_DIR = join(ROOT, "src");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    "[check-hub-portals] SUPABASE_URL / key not set — skipping DB link validation."
  );
  process.exit(0);
}

// --------------------------------------------------------------------------
// 1. Load every valid slug from the database
// --------------------------------------------------------------------------

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(
      `Supabase ${path} → ${res.status} ${res.statusText}: ${await res.text()}`
    );
  }
  return res.json();
}

console.log("[check-hub-portals] Loading slugs from database…");

let portals, battles, tools, hubs, customHubLinks;
try {
  [portals, battles, tools, hubs] = await Promise.all([
    rest("portals_public?select=slug,kind&limit=5000"),
    rest("battles?select=slug&limit=5000"),
    rest("calculators?select=slug,published&limit=5000"),
    rest("custom_hubs?select=slug,href&limit=2000"),
  ]);
  customHubLinks = hubs;
} catch (e) {
  console.error("[check-hub-portals] Failed to query Supabase:", e.message);
  process.exit(1);
}

const portalsByKind = new Map(); // kind → Set<slug>
const allPortalSlugs = new Set();
for (const p of portals) {
  allPortalSlugs.add(p.slug);
  if (!portalsByKind.has(p.kind)) portalsByKind.set(p.kind, new Set());
  portalsByKind.get(p.kind).add(p.slug);
}
const battleSlugs = new Set(battles.map((b) => b.slug));
const toolSlugs = new Set(
  tools.filter((t) => t.published !== false).map((t) => t.slug)
);
const hubSlugs = new Set(customHubLinks.map((h) => h.slug));

console.log(
  `[check-hub-portals]   portals=${allPortalSlugs.size} battles=${battleSlugs.size} tools=${toolSlugs.size} custom_hubs=${hubSlugs.size}`
);

// --------------------------------------------------------------------------
// 2. Resolution helper
// --------------------------------------------------------------------------

/** Returns null if href is not a hub-link we care about, true if valid,
 *  or a string error message if invalid. */
function checkHref(href) {
  if (typeof href !== "string") return null;
  const m = href.match(/^\/(m|p|td|b|t|f|hub)\/([a-z0-9][a-z0-9-]{0,80})\/?(?:\?|#|$)/i);
  if (!m) return null;
  const [, prefix, slug] = m;
  const s = slug.toLowerCase();
  switch (prefix) {
    case "m":
      return portalsByKind.get("music")?.has(s)
        ? true
        : `${href} → no music portal with slug "${s}"`;
    case "td":
      return portalsByKind.get("trade")?.has(s)
        ? true
        : `${href} → no trade portal with slug "${s}"`;
    case "f":
      return portalsByKind.get("form")?.has(s)
        ? true
        : `${href} → no form portal with slug "${s}"`;
    case "p":
      return allPortalSlugs.has(s)
        ? true
        : `${href} → no portal with slug "${s}"`;
    case "b":
      return battleSlugs.has(s) ? true : `${href} → no battle with slug "${s}"`;
    case "t":
      return toolSlugs.has(s)
        ? true
        : `${href} → no published tool/calculator with slug "${s}"`;
    case "hub":
      return hubSlugs.has(s)
        ? true
        : `${href} → no custom hub with slug "${s}"`;
  }
  return null;
}

// --------------------------------------------------------------------------
// 3. Validate DB-stored hub links
// --------------------------------------------------------------------------

const failures = [];

for (const row of customHubLinks) {
  if (!row.href) continue;
  const result = checkHref(row.href);
  if (typeof result === "string") {
    failures.push(`custom_hubs[slug=${row.slug}]: ${result}`);
  }
}

// --------------------------------------------------------------------------
// 4. Scan source for hard-coded portal URLs
// --------------------------------------------------------------------------

const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".mdx"]);
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".output", ".vinxi",
  ".tanstack", ".next", "coverage", "scripts",
]);
const IGNORE_FILES = new Set(["routeTree.gen.ts"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      yield* walk(full);
    } else {
      if (IGNORE_FILES.has(name)) continue;
      const dot = name.lastIndexOf(".");
      if (dot === -1) continue;
      if (!SCAN_EXT.has(name.slice(dot))) continue;
      yield full;
    }
  }
}

// Match string literals like "/m/some-slug" inside double or single quotes.
// Excludes "$slug" templates (route params) and ":slug" placeholders.
const LITERAL_RE = /["'`](\/(?:m|p|td|b|t|f|hub)\/[a-z0-9][a-z0-9-]{0,80})\/?["'`]/gi;

for (const file of walk(SRC_DIR)) {
  const text = readFileSync(file, "utf8");
  let m;
  while ((m = LITERAL_RE.exec(text)) !== null) {
    const href = m[1];
    if (href.includes("$") || href.includes(":")) continue;
    const result = checkHref(href);
    if (typeof result === "string") {
      // Compute line number for a friendlier error
      const line = text.slice(0, m.index).split("\n").length;
      failures.push(`${relative(ROOT, file)}:${line}: ${result}`);
    }
  }
}

// --------------------------------------------------------------------------
// 5. Report
// --------------------------------------------------------------------------

if (failures.length === 0) {
  console.log(
    "[check-hub-portals] ✓ All HUB links resolve to existing portals."
  );
  process.exit(0);
}

console.error(
  `\n[check-hub-portals] ✗ ${failures.length} broken HUB link${
    failures.length === 1 ? "" : "s"
  }:\n`
);
for (const f of failures) console.error("  • " + f);
console.error(
  "\nFix these by either updating the link target or deleting the stale row.\n"
);
process.exit(1);