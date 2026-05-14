import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("Boss redirect guard (route-guards.ts)", () => {
  const guards = read("src/lib/route-guards.ts");

  it("exports redirectBossAway", () => {
    expect(guards).toMatch(/export\s+async\s+function\s+redirectBossAway\b/);
  });

  it("redirects users whose profile rank is 'boss'", () => {
    // The guard reads profiles.rank and throws redirect when rank === 'boss'.
    expect(guards).toMatch(/rank\s*===\s*["']boss["']/);
    expect(guards).toMatch(/throw\s+redirect\(\s*\{\s*to:\s*["']\/profile["']/);
  });
});

describe("/wallet redirects Boss users", () => {
  const wallet = read("src/routes/wallet.tsx");

  it("imports redirectBossAway from route-guards", () => {
    expect(wallet).toMatch(/redirectBossAway[\s\S]*from\s+["']@\/lib\/route-guards["']/);
  });

  it("invokes redirectBossAway in beforeLoad", () => {
    // beforeLoad block must call redirectBossAway(ctx) so Boss never lands here.
    const m = wallet.match(/beforeLoad:\s*async[\s\S]*?\}\s*,\s*\n/);
    expect(m, "beforeLoad block not found in wallet route").toBeTruthy();
    expect(m![0]).toMatch(/redirectBossAway\s*\(/);
  });
});

describe("/store buy buttons are hidden for Boss", () => {
  const store = read("src/routes/store.tsx");

  it("renders BossPackControls instead of the Buy Credits button when isBoss", () => {
    // The PackCard ternary must branch on isBoss so the purchase button never
    // renders for Boss accounts.
    expect(store).toMatch(/\{isBoss \? \(\s*<BossPackControls[\s\S]*?\) : \(\s*<Button[\s\S]*?Buy Credits/);
  });

  it("hides the heading and pack grid behind !isBoss gates", () => {
    // Multiple `{!isBoss && (` gates wrap the purchase-facing sections.
    const gateCount = (store.match(/\{!isBoss && \(/g) ?? []).length;
    expect(gateCount).toBeGreaterThanOrEqual(2);
  });
});

describe("CoinTopUpModal cannot open for Boss", () => {
  // Find every file that imports the modal.
  function filesImportingModal(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const ent of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${ent.name}`;
        if (ent.isDirectory()) {
          if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
          walk(rel);
        } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
          const src = read(rel);
          if (/from\s+["'][^"']*CoinTopUpModal["']/.test(src)) out.push(rel);
        }
      }
    };
    walk("src");
    return out;
  }

  const consumers = filesImportingModal().filter((f) => !f.endsWith("CoinTopUpModal.tsx"));

  it("is only imported by /wallet (single audited entry point)", () => {
    expect(consumers).toEqual(["src/routes/wallet.tsx"]);
  });

  it("every consumer also calls redirectBossAway in beforeLoad", () => {
    for (const file of consumers) {
      const src = read(file);
      expect(src, `${file} must call redirectBossAway`).toMatch(/redirectBossAway\s*\(/);
    }
  });

  it("every setTopUpOpen(true) call in /wallet is gated by !isBoss", () => {
    const src = read("src/routes/wallet.tsx");
    // Strip the modal-close call (`setTopUpOpen(false)`) and look at openers.
    const openers = [...src.matchAll(/setTopUpOpen\(\s*true\s*\)/g)];
    expect(openers.length).toBeGreaterThan(0);
    for (const m of openers) {
      // Look back ~400 chars for either a JSX `!isBoss && (` block or an
      // inline `if (... && !isBoss)` guard. Both patterns are used in the file.
      const window = src.slice(Math.max(0, m.index! - 400), m.index!);
      const guarded = /!isBoss/.test(window);
      expect(guarded, `setTopUpOpen(true) at index ${m.index} is not guarded by !isBoss`).toBe(true);
    }
  });
});