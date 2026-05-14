import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PROFILE = readFileSync(resolve(ROOT, "src/routes/profile.tsx"), "utf8");

/**
 * Isolate the Boss-only Credits Reserve card so we only assert against the
 * two action buttons inside it (and not similarly-named links elsewhere).
 */
function reserveCardSource(): string {
  const start = PROFILE.indexOf("Boss-only Credits Reserve status card");
  expect(start, "Credits Reserve card marker not found").toBeGreaterThan(-1);
  const end = PROFILE.indexOf("Buy Credits — hidden for Boss", start);
  expect(end, "Reserve card end marker not found").toBeGreaterThan(start);
  return PROFILE.slice(start, end);
}

describe("Credits Reserve card buttons", () => {
  const card = reserveCardSource();

  it("Adjust member credits links to /boss/users", () => {
    const re = /<Link[^>]*to=["']\/boss\/users["'][^>]*>[\s\S]*?Adjust member credits[\s\S]*?<\/Link>/;
    expect(card).toMatch(re);
  });

  it("Boss console links to /boss", () => {
    const re = /<Link[^>]*to=["']\/boss["'][^>]*>[\s\S]*?Boss console[\s\S]*?<\/Link>/;
    expect(card).toMatch(re);
  });

  it("only renders for Boss users (gated by isBoss)", () => {
    // `{isBoss && (` opens the section right after the marker comment.
    const idx = PROFILE.indexOf("Boss-only Credits Reserve status card");
    const after = PROFILE.slice(idx, idx + 200);
    expect(after).toMatch(/\{isBoss && \(/);
  });

  it("both target routes have matching route files", () => {
    expect(() => readFileSync(resolve(ROOT, "src/routes/boss.users.tsx"), "utf8")).not.toThrow();
    expect(() => readFileSync(resolve(ROOT, "src/routes/boss.tsx"), "utf8")).not.toThrow();
  });
});