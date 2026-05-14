import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Verifies that non-Boss users never see the Credits Reserve navigation
 * surface — neither the card itself nor any of its links ("Adjust member
 * credits", "Boss console") nor the "Boss · Credits Reserve" header label.
 *
 * The card is rendered exclusively from src/routes/profile.tsx and is
 * wrapped in `{isBoss && (...)}`. To keep that guarantee under refactors we
 * also walk every .ts/.tsx file under src/ and assert that any occurrence of
 * the reserve-only copy lives in profile.tsx (or in non-rendered comments).
 */

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PROFILE_PATH = resolve(ROOT, "src/routes/profile.tsx");
const PROFILE = readFileSync(PROFILE_PATH, "utf8");

function reserveCardSlice(): { card: string; before: string } {
  const start = PROFILE.indexOf("Boss-only Credits Reserve status card");
  expect(start, "Reserve card marker not found").toBeGreaterThan(-1);
  const end = PROFILE.indexOf("Buy Credits — hidden for Boss", start);
  expect(end, "Reserve card end marker not found").toBeGreaterThan(start);
  return { card: PROFILE.slice(start, end), before: PROFILE.slice(Math.max(0, start - 200), start) };
}

function* walkSrc(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walkSrc(full);
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      yield full;
    }
  }
}

describe("Credits Reserve is hidden for non-Boss users", () => {
  const { card, before } = reserveCardSlice();

  it("the entire card is wrapped in {isBoss && (...)}", () => {
    // The marker comment sits immediately inside the gated section; the
    // opener `{isBoss && (` must appear in the surrounding context.
    expect(before).toMatch(/\{isBoss && \(/);
    // And the closing `{!isBoss && (` for the next section must follow,
    // proving the gate closes before any non-boss UI begins.
    expect(PROFILE.indexOf("{!isBoss && (", PROFILE.indexOf(card))).toBeGreaterThan(-1);
  });

  it("no /boss or /boss/users <Link> appears outside the gated card in profile.tsx", () => {
    const cardStart = PROFILE.indexOf(card);
    const cardEnd = cardStart + card.length;
    const outside = PROFILE.slice(0, cardStart) + PROFILE.slice(cardEnd);
    // Strip JSX comments so the marker comment around the card doesn't trip us.
    const clean = outside.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(clean).not.toMatch(/<Link[^>]*to=["']\/boss(?:\/users)?["']/);
  });

  it("'Adjust member credits' and 'Boss console' link labels live only inside the gated card", () => {
    const cardStart = PROFILE.indexOf(card);
    const cardEnd = cardStart + card.length;
    const outside = PROFILE.slice(0, cardStart) + PROFILE.slice(cardEnd);
    expect(outside).not.toMatch(/Adjust member credits/);
    expect(outside).not.toMatch(/Boss console/);
  });

  it("no other source file renders the Reserve card copy as JSX", () => {
    const banned = [
      /Boss\s*·\s*Credits Reserve/,
      /Adjust member credits/,
    ];
    const offenders: string[] = [];
    for (const file of walkSrc(resolve(ROOT, "src"))) {
      if (file === PROFILE_PATH) continue;
      const src = readFileSync(file, "utf8");
      // Ignore matches that only appear inside // line comments or /* block */
      // comments — those are documentation, not rendered UI.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const re of banned) {
        if (re.test(stripped)) offenders.push(`${file} :: ${re}`);
      }
    }
    expect(offenders, `Reserve copy leaked into:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("isBoss is derived from the authenticated profile rank, not a client flag", () => {
    // Sanity: ensure the gate is bound to a real role check, not e.g. a
    // localStorage toggle that an attacker could flip.
    expect(PROFILE).toMatch(/isBoss\s*=\s*[^;]*rank[^;]*===\s*["']boss["']/);
  });
});