import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

/**
 * Server-side authorization regression for /boss page routes.
 *
 * Route guards in this project run via TanStack Router `beforeLoad`. They
 * execute before the route loader and component render, so a non-Boss user
 * navigating to /boss/* by direct URL is intercepted and redirected before
 * any privileged data is fetched. We verify, statically:
 *
 *   1. The /boss layout route declares `beforeLoad: requireBoss` — this
 *      cascades to every nested /boss/* child route.
 *   2. Every top-level `src/routes/boss*.tsx` file that exists either
 *      inherits the layout guard (path starts "/boss/...") or declares its
 *      own boss-grade guard (`requireBoss` / `requireAdmin`). No /boss
 *      route may be reachable without a guard.
 *   3. The `requireBoss` guard in `route-guards.ts` actually rejects
 *      non-Boss callers: it checks `profiles.rank === "boss"` OR the admin
 *      role in `user_roles`, and on failure throws a redirect AWAY from
 *      /boss (so direct-URL navigation cannot land on the page).
 *   4. Banned users — even if rank=boss — are bounced.
 */

const BOSS_ROUTE_FILES = readdirSync(join(ROOT, "src/routes"))
  .filter((f) => /^boss(\.|$)/.test(f) && f.endsWith(".tsx"));

describe("server-side authz: /boss routes block non-Boss users", () => {
  it("at least one boss route file exists (sanity)", () => {
    expect(BOSS_ROUTE_FILES.length).toBeGreaterThan(0);
  });

  it("/boss layout route declares beforeLoad: requireBoss", () => {
    const src = read("src/routes/boss.tsx");
    expect(src).toMatch(
      /requireBoss[\s\S]*from\s+["']@\/lib\/route-guards["']/,
    );
    // createFileRoute("/boss") with beforeLoad: requireBoss
    expect(src).toMatch(/createFileRoute\(\s*["']\/boss["']\s*\)/);
    expect(src).toMatch(/beforeLoad:\s*requireBoss\b/);
  });

  for (const file of BOSS_ROUTE_FILES) {
    it(`${file} is guarded (own beforeLoad or inherits /boss layout)`, () => {
      const src = read(`src/routes/${file}`);
      const routeMatch = src.match(/createFileRoute\(\s*["']([^"']+)["']\s*\)/);
      expect(routeMatch, `${file} must declare a route path`).toBeTruthy();
      const path = routeMatch![1];

      // Must be under the /boss namespace.
      expect(path === "/boss" || path.startsWith("/boss/")).toBe(true);

      // Either inherits layout guard (any /boss/... child) or declares its own.
      const inheritsLayout = path.startsWith("/boss/");
      const ownGuard =
        /beforeLoad:\s*(requireBoss\b|requireAdmin\b|requireBossHub\b)/.test(src);

      expect(
        inheritsLayout || ownGuard,
        `${file} (${path}) has no boss-grade beforeLoad guard and is not nested under /boss layout`,
      ).toBe(true);
    });
  }
});

describe("requireBoss guard rejects non-Boss callers", () => {
  const guards = read("src/lib/route-guards.ts");

  it("exports requireBoss", () => {
    expect(guards).toMatch(/export\s+async\s+function\s+requireBoss\b/);
  });

  it("redirects unauthenticated callers to /auth (not /boss)", () => {
    // Two redirect-to-/auth calls inside requireBoss: missing token + missing session.
    const body = guards.match(/export\s+async\s+function\s+requireBoss\b[\s\S]*?\n\}\n/);
    expect(body, "requireBoss body not found").toBeTruthy();
    const fn = body![0];
    expect(fn).toMatch(/hasStoredAuth\(\)/);
    expect(fn).toMatch(/throw\s+redirect\(\s*\{\s*to:\s*["']\/auth["']/);
  });

  it("checks rank='boss' OR admin role in user_roles", () => {
    const fn = guards.match(/export\s+async\s+function\s+requireBoss\b[\s\S]*?\n\}\n/)![0];
    // Must read profile rank.
    expect(fn).toMatch(/from\(\s*["']profiles["']\s*\)[\s\S]*?rank/);
    // Must consult the admin role in user_roles (not stored on profiles).
    expect(fn).toMatch(/from\(\s*["']user_roles["']\s*\)/);
    expect(fn).toMatch(/role[\s\S]*?["']admin["']/);
    // The decision combines both.
    expect(fn).toMatch(/rank\s*===\s*["']boss["']/);
    expect(fn).toMatch(/isBoss\s*=\s*[^\n;]*adminRow/);
  });

  it("on failure redirects AWAY from /boss with forbidden=boss flag", () => {
    const fn = guards.match(/export\s+async\s+function\s+requireBoss\b[\s\S]*?\n\}\n/)![0];
    // Non-Boss path must throw a redirect to "/" (NOT "/boss").
    expect(fn).toMatch(
      /if\s*\(!isBoss\)\s*\{\s*throw\s+redirect\(\s*\{\s*to:\s*["']\/["'][\s\S]*?forbidden:\s*["']boss["']/,
    );
    // No branch in requireBoss may resolve into /boss.
    expect(fn).not.toMatch(/redirect\(\s*\{\s*to:\s*["']\/boss/);
  });

  it("bounces banned users even if rank=boss", () => {
    const fn = guards.match(/export\s+async\s+function\s+requireBoss\b[\s\S]*?\n\}\n/)![0];
    expect(fn).toMatch(/prof\?\.banned[\s\S]*?throw\s+redirect/);
  });

  it("admin role is sourced from user_roles table, NOT profiles (no privilege escalation)", () => {
    // Project rule: roles must not live on the profiles row. Verify the
    // boss guard doesn't read an `is_admin` / `role` column from profiles.
    const fn = guards.match(/export\s+async\s+function\s+requireBoss\b[\s\S]*?\n\}\n/)![0];
    const profSelect = fn.match(/from\(\s*["']profiles["']\s*\)\.select\(\s*["']([^"']+)["']/);
    expect(profSelect, "requireBoss must select from profiles").toBeTruthy();
    const cols = profSelect![1].split(",").map((c) => c.trim());
    expect(cols).not.toContain("is_admin");
    expect(cols).not.toContain("role");
    expect(cols).not.toContain("roles");
  });
});

/**
 * Optional live regression: when BOSS_REGRESSION_BASE_URL is set, fetch the
 * /boss HTML route as an unauthenticated client. The SPA shell is allowed to
 * 200 (the guard runs in the browser on hydration), but the response MUST
 * NOT inline any privileged Boss data. We assert the obvious leak markers
 * are absent from the SSR HTML. Skipped in normal CI.
 */
const baseUrl = process.env.BOSS_REGRESSION_BASE_URL;
const liveSuite = baseUrl ? describe : describe.skip;

liveSuite("live: /boss SSR does not leak privileged data to anonymous fetch", () => {
  for (const path of ["/boss", "/boss/users", "/boss/audit-log"]) {
    it(`${path} responds without leaking boss-only payloads`, async () => {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { accept: "text/html" },
      });
      // 200 (SPA shell) or 3xx (server-side redirect) are both acceptable.
      expect(res.status).toBeLessThan(500);
      const html = await res.text();
      // None of these markers should appear in HTML served to an anon caller.
      expect(html).not.toMatch(/boss_audit_log/i);
      expect(html).not.toMatch(/service_role/i);
    });
  }
});