import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import allowlist from "./boss-functions.allowlist.json" with { type: "json" };

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/**
 * Parse a `*.functions.ts` source file and return a map of
 * `exportName -> middleware-array-source` for every `export const X =
 * createServerFn(...)...` declaration.
 *
 * We deliberately use a regex over an AST parser to keep the test
 * dependency-free. The pattern matches the project convention:
 *
 *   export const NAME = createServerFn({ ... })
 *     .middleware([requireBoss, ...])
 *     ...
 */
function extractExports(source: string): Map<string, string> {
  const out = new Map<string, string>();
  // Split on `export const ` so each chunk owns one server fn declaration.
  const chunks = source.split(/\nexport const /g);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const nameMatch = chunk.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*=/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (!/createServerFn\s*\(/.test(chunk)) continue;
    // Capture the middleware array body, if any.
    const mwMatch = chunk.match(/\.middleware\s*\(\s*\[([^\]]*)\]\s*\)/);
    out.set(name, mwMatch ? mwMatch[1] : "");
  }
  return out;
}

const entries = Object.entries(
  (allowlist as { boss_only_exports: Record<string, string[]> }).boss_only_exports,
);

describe("security regression: boss-only server functions", () => {
  for (const [relPath, names] of entries) {
    describe(relPath, () => {
      const abs = join(ROOT, relPath);

      it("source file exists", () => {
        expect(existsSync(abs), `${relPath} missing`).toBe(true);
      });

      const source = existsSync(abs) ? readFileSync(abs, "utf8") : "";
      const exportsMap = extractExports(source);

      it("imports requireBoss from the boss middleware module", () => {
        expect(source).toMatch(
          /from\s+["']@\/integrations\/supabase\/boss-middleware["']/,
        );
        expect(source).toMatch(/\brequireBoss\b/);
      });

      for (const name of names) {
        it(`${name}() is guarded by requireBoss`, () => {
          const mw = exportsMap.get(name);
          expect(
            exportsMap.has(name),
            `Export "${name}" not found in ${relPath}. ` +
              `If it was renamed or removed, update the allowlist.`,
          ).toBe(true);
          expect(
            mw,
            `Export "${name}" must declare a .middleware([...]) chain.`,
          ).toBeTruthy();
          expect(
            /\brequireBoss\b/.test(mw ?? ""),
            `Export "${name}" lost its requireBoss guard. ` +
              `Non-boss users could call this server function.`,
          ).toBe(true);
        });
      }
    });
  }

  it("requireBoss middleware itself still enforces boss-or-admin and 403s otherwise", () => {
    const src = readFileSync(
      join(ROOT, "src/integrations/supabase/boss-middleware.ts"),
      "utf8",
    );
    // Must build on top of the auth middleware (so anonymous calls get 401).
    expect(src).toMatch(/requireSupabaseAuth/);
    // Must consult is_boss + the admin role in user_roles.
    expect(src).toMatch(/is_boss/);
    expect(src).toMatch(/user_roles/);
    expect(src).toMatch(/['"]admin['"]/);
    // Must reject with HTTP 403 when neither check passes.
    expect(src).toMatch(/status:\s*403/);
  });
});

/**
 * Optional live regression: when BOSS_REGRESSION_BASE_URL is set we POST to
 * each boss-only server-fn endpoint without an Authorization header and
 * expect a 4xx response (401 from requireSupabaseAuth, or 403 from
 * requireBoss). Skipped in normal CI to keep tests hermetic.
 */
const baseUrl = process.env.BOSS_REGRESSION_BASE_URL;
const liveSuite = baseUrl ? describe : describe.skip;

liveSuite("live: boss-only server fns reject anonymous callers", () => {
  for (const [relPath, names] of entries) {
    for (const name of names) {
      it(`${relPath} :: ${name} rejects unauthenticated callers`, async () => {
        const url = `${baseUrl}/_serverFn/${name}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        // Anything in [401, 403, 404] proves the handler did not run as a
        // privileged caller. 200 means the guard is bypassed.
        expect([401, 403, 404]).toContain(res.status);
      });
    }
  }
});