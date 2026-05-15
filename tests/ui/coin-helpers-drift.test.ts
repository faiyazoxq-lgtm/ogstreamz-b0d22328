import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const SRC = resolve(ROOT, "src");

/**
 * Files allowed to do raw cents→GBP math (i.e. the helper definitions
 * themselves, plus tests). Everything else must call `formatGbp` /
 * `coinChip` / `formatGbpWithCoins` / `formatMoneyWithCoins` from
 * `@/lib/coins` so coin pricing can never silently drift again.
 */
const ALLOWLIST = new Set<string>([
  "src/lib/coins.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, ent.name);
    if (ent.isDirectory()) {
      // skip generated / vendor
      if (/node_modules|\.gen\.|dist|\.cache/.test(ent.name)) continue;
      walk(full, out);
    } else if (ent.isFile() && /\.(ts|tsx)$/.test(ent.name) && !/\.(test|spec)\.tsx?$/.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);

function rel(p: string) {
  return relative(ROOT, p).replace(/\\/g, "/");
}

describe("Coin → GBP conversions must use shared helpers (lib/coins.ts)", () => {
  it("never multiplies coin counts by a hand-rolled GBP rate", () => {
    // Catches `credits * 0.99`, `Number(credits) * 1.0`, etc. — any direct
    // coin→£ multiplication that bypasses formatGbp(credits * 100).
    // Strategy: flag a multiplication of `credits|coins|balance` by a
    // *decimal* literal (the canonical `* 100` cents conversion is allowed).
    // Lines must also smell like GBP (£, GBP, gbp, formatGbp, currency)
    // to avoid catching unrelated arithmetic (progress bars, percentages).
    const offenders: string[] = [];
    const decimalMul = /\b(?:credits?|coins?|balance)\b[^\n;]{0,60}\*\s*\d+\.\d+/i;
    const moneyContext = /£|GBP|gbp|currency|formatGbp/;
    for (const f of files) {
      if (ALLOWLIST.has(rel(f))) continue;
      const src = readFileSync(f, "utf8");
      src.split("\n").forEach((line, i) => {
        const trimmed = line.trim();
        // skip pure comment lines
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (!decimalMul.test(line)) return;
        if (!moneyContext.test(line)) return;
        // allow lines that already route through the helper
        if (/formatGbp\s*\(/.test(line)) return;
        offenders.push(`${rel(f)}:${i + 1}  ${trimmed}`);
      });
    }
    expect(offenders, `Coin→GBP drift detected — route these through formatGbp/coinChip:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("never inlines `Intl.NumberFormat … currency: 'GBP'` outside the helper", () => {
    // formatGbp is the single approved producer of "£X" / "£X.YY" strings.
    const offenders: string[] = [];
    const re = /Intl\.NumberFormat[\s\S]{0,120}currency\s*:\s*["']GBP["']/i;
    for (const f of files) {
      if (ALLOWLIST.has(rel(f))) continue;
      const src = readFileSync(f, "utf8");
      if (re.test(src)) offenders.push(rel(f));
    }
    expect(offenders, `Inline GBP Intl.NumberFormat found — use formatGbp instead in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("never converts `credits` straight to a £ template literal without formatGbp", () => {
    // Catches `£${credits}` / `£${row.credits * X}` style literals that skip
    // the shared helper.
    const offenders: string[] = [];
    const pattern = /£\s*\$\{[^}]*\bcredits?\b[^}]*\}/i;
    for (const f of files) {
      if (ALLOWLIST.has(rel(f))) continue;
      const src = readFileSync(f, "utf8");
      src.split("\n").forEach((line, i) => {
        if (pattern.test(line) && !/formatGbp\s*\(/.test(line)) {
          offenders.push(`${rel(f)}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(offenders, `Inline £\${credits…} found — route through formatGbp:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("CoinChip routes its tooltip + label through the shared helper", () => {
    const src = readFileSync(resolve(SRC, "components/CoinChip.tsx"), "utf8");
    expect(src).toMatch(/formatGbp\s*\(\s*coins\s*\*\s*100\s*,\s*\{\s*decimals:\s*2\s*\}\s*\)/);
    expect(src).toMatch(/toLocaleString\(\s*["']en-GB["']\s*\)/);
    expect(src).toMatch(/aria-label=/);
  });
});