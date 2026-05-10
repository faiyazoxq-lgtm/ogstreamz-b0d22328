#!/usr/bin/env node
/**
 * CI guard: scan the codebase for hard-coded internal links and fail if any
 * referenced route does not exist on disk under src/routes/.
 *
 * Detects:
 *   <Link to="/foo/bar">                       (TanStack Router Link)
 *   <Link to="/posts/$postId" ...>
 *   navigate({ to: "/foo" })                    (useNavigate / router.navigate)
 *   router.navigate({ to: "/foo" })
 *   redirect({ to: "/foo" })                    (TanStack redirect)
 *   <a href="/foo">                             (plain anchor with internal href)
 *   href: "/foo"                                (object props, e.g. menu items)
 *   to: "/foo"                                  (object props, e.g. nav configs)
 *
 * Skips: external URLs (http/https/mailto/tel/#), api routes (/api/*),
 * the build output, node_modules, and generated route tree.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(process.cwd());
const ROUTES_DIR = join(ROOT, "src", "routes");
const SRC_DIR = join(ROOT, "src");

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".output", ".vinxi",
  ".tanstack", ".next", "coverage", "scripts",
]);
const IGNORE_FILES = new Set([
  "routeTree.gen.ts",
  "check-internal-links.mjs",
]);

// --------------------------------------------------------------------------
// 1. Discover routes from src/routes/
// --------------------------------------------------------------------------

/**
 * Convert a TanStack flat-file route filename into a route pattern.
 * Examples:
 *   index.tsx                  -> /
 *   about.tsx                  -> /about
 *   posts.$postId.tsx          -> /posts/$postId
 *   m.$slug.tsx                -> /m/$slug
 *   sitemap[.]xml.tsx          -> /sitemap.xml
 *   boss.analytics.tsx         -> /boss/analytics
 *   __root.tsx                 -> (skipped)
 */
function filenameToRoute(file) {
  if (file === "__root.tsx") return null;
  const noExt = file.replace(/\.(tsx?|jsx?)$/, "");
  // Resolve [.] escape -> literal .
  let segs = noExt.split(".");
  // Re-join escaped dots: any segment that ends with "[" plus next segment "]xxx"
  const merged = [];
  for (let i = 0; i < segs.length; i++) {
    let s = segs[i];
    while (s.endsWith("[") && i + 1 < segs.length) {
      // [.]xml -> "[" + "]xml" -> "."+"xml"
      const next = segs[++i];
      s = s.slice(0, -1) + "." + next.replace(/^\]/, "");
    }
    merged.push(s);
  }
  if (merged.length === 1 && merged[0] === "index") return "/";
  return "/" + merged.join("/");
}

function discoverRoutes() {
  const patterns = new Set();
  function walk(dir, prefix = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        // api/ contains server routes — keep them so /api/... refs validate
        walk(abs, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.isFile() && SCAN_EXTENSIONS.has(extOf(entry.name))) {
        const route = filenameToRoute(entry.name);
        if (route === null) continue;
        const full = prefix ? `/${prefix}${route}` : route;
        patterns.add(full);
      }
    }
  }
  walk(ROUTES_DIR);
  // Layout/parent-only files act as prefixes; also register their bare path.
  return patterns;
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i);
}

/**
 * Match a concrete URL (e.g. "/m/cool-slug") against a route pattern
 * (e.g. "/m/$slug"). Returns true on match.
 */
function matchesPattern(url, pattern) {
  if (pattern === url) return true;
  const u = url.split("/").filter(Boolean);
  const p = pattern.split("/").filter(Boolean);
  // Splat
  const splatIdx = p.indexOf("$");
  if (splatIdx !== -1) {
    if (u.length < splatIdx) return false;
    for (let i = 0; i < splatIdx; i++) {
      if (!segMatch(p[i], u[i])) return false;
    }
    return true;
  }
  if (u.length !== p.length) return false;
  for (let i = 0; i < p.length; i++) if (!segMatch(p[i], u[i])) return false;
  return true;
}
function segMatch(pSeg, uSeg) {
  if (pSeg === undefined || uSeg === undefined) return false;
  if (pSeg.startsWith("$")) return uSeg.length > 0;
  return pSeg === uSeg;
}

// --------------------------------------------------------------------------
// 2. Scan source files for internal link references
// --------------------------------------------------------------------------

const PATTERNS = [
  // <Link to="/foo">  /  to={"/foo"}
  { name: "Link to=", re: /<Link\b[^>]*?\bto=\{?["'`](\/[^"'`}\s]*)["'`]\}?/g },
  // navigate({ to: "/foo" })   /   redirect({ to: "/foo" })
  { name: "navigate to:", re: /\b(?:navigate|redirect|router\.navigate)\s*\(\s*\{[^}]*?\bto\s*:\s*["'`](\/[^"'`]*)["'`]/g },
  // <a href="/foo">  (plain anchor; ignore external)
  { name: "<a href=", re: /<a\b[^>]*?\bhref=\{?["'`](\/[^"'`}\s]*)["'`]\}?/g },
  // Object props commonly used for nav configs: { to: "/foo" } / { href: "/foo" }
  { name: "to: prop", re: /\bto\s*:\s*["'`](\/[^"'`]*)["'`]/g },
  { name: "href: prop", re: /\bhref\s*:\s*["'`](\/[^"'`]*)["'`]/g },
];

function shouldSkipUrl(url) {
  if (!url || !url.startsWith("/")) return true;
  if (url.startsWith("//")) return true;            // protocol-relative
  if (url.startsWith("/api/")) return true;          // server routes covered by api dir
  // strip query / hash
  return false;
}

function normalize(url) {
  // strip query + hash
  const noHash = url.split("#")[0];
  const noQuery = noHash.split("?")[0];
  // strip trailing slash (except root)
  return noQuery.length > 1 && noQuery.endsWith("/") ? noQuery.slice(0, -1) : noQuery;
}

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(abs, out);
    else if (entry.isFile()
      && SCAN_EXTENSIONS.has(extOf(entry.name))
      && !IGNORE_FILES.has(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

function lineColOf(text, index) {
  let line = 1, col = 1;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) { line++; col = 1; } else col++;
  }
  return { line, col };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

const routes = discoverRoutes();
// Always-allowed roots (e.g. publicly-fetchable assets / external service paths)
const STATIC_ALLOW = new Set([
  "/favicon.ico", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest",
]);

const files = listFiles(SRC_DIR);
const failures = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1];
      if (shouldSkipUrl(raw)) continue;
      // Collapse template-literal interpolations (e.g. "/b/${slug}") into a
      // synthetic param so they validate against routes like "/b/$slug".
      const collapsed = raw.replace(/\$\{[^}]*\}/g, "$x");
      const url = normalize(collapsed);
      if (url.includes("$")) {
        // Verify a registered pattern has the same shape (segment count + literals).
        let matched = false;
        for (const pat of routes) {
          if (matchesShape(url, pat)) { matched = true; break; }
        }
        if (!matched) {
          const { line, col } = lineColOf(text, m.index);
          failures.push({ file, line, col, url: raw, hint: name, kind: "pattern-missing" });
        }
        continue;
      }
      if (STATIC_ALLOW.has(url)) continue;
      // Verify against any registered route
      let matched = false;
      for (const pat of routes) {
        if (matchesPattern(url, pat)) { matched = true; break; }
      }
      if (!matched) {
        const { line, col } = lineColOf(text, m.index);
        failures.push({ file, line, col, url: raw, hint: name, kind: "url-missing" });
      }
    }
  }
}

const totalRefs = files.length;
console.log(`[check-internal-links] scanned ${totalRefs} source files`);
console.log(`[check-internal-links] discovered ${routes.size} route patterns`);

if (failures.length > 0) {
  console.error(`\n[check-internal-links] FAIL — ${failures.length} broken internal link(s):\n`);
  for (const f of failures) {
    const rel = relative(ROOT, f.file).split(sep).join("/");
    console.error(`  ${rel}:${f.line}:${f.col}  →  "${f.url}"  (${f.hint})`);
  }
  console.error(
    `\nFix: create the missing route file under src/routes/ ` +
    `(e.g. /foo → src/routes/foo.tsx, /posts/$id → src/routes/posts.$id.tsx) ` +
    `or update the link to a valid path.\n`,
  );
  process.exit(1);
}

console.log("[check-internal-links] OK — all internal links resolve.");
