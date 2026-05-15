import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateVaultRevealAccess,
  assertVaultRevealAllowed,
  VAULT_REAUTH_WINDOW_MS,
} from "@/lib/vault-reauth-gate";

const NOW = Date.parse("2026-05-15T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60_000).toISOString();

describe("evaluateVaultRevealAccess — server-side vault re-auth gate", () => {
  describe("allow paths", () => {
    it("allows VIP rank regardless of stream_verified_at", () => {
      const d = evaluateVaultRevealAccess({
        profile: { rank: "vip", stream_verified_at: null },
        hasAdminRole: false,
        now: NOW,
      });
      expect(d).toEqual({ allow: true, reason: "elevated_rank" });
    });

    it("allows BOSS rank regardless of stream_verified_at", () => {
      const d = evaluateVaultRevealAccess({
        profile: { rank: "boss", stream_verified_at: null },
        hasAdminRole: false,
        now: NOW,
      });
      expect(d).toEqual({ allow: true, reason: "elevated_rank" });
    });

    it("allows admin role even with no profile / unrelated rank", () => {
      const d = evaluateVaultRevealAccess({
        profile: { rank: "prospect", stream_verified_at: null },
        hasAdminRole: true,
        now: NOW,
      });
      expect(d).toEqual({ allow: true, reason: "admin_role" });

      const d2 = evaluateVaultRevealAccess({
        profile: null,
        hasAdminRole: true,
        now: NOW,
      });
      expect(d2.allow).toBe(true);
    });

    it("allows stream_user with FRESH stream_verified_at (just now, 1m, 11h59m)", () => {
      for (const ts of [
        new Date(NOW).toISOString(),
        minutesAgo(1),
        minutesAgo(60 * 11 + 59),
      ]) {
        const d = evaluateVaultRevealAccess({
          profile: { rank: "stream_user", stream_verified_at: ts },
          hasAdminRole: false,
          now: NOW,
        });
        expect(d).toEqual({ allow: true, reason: "fresh_stream_user" });
      }
    });
  });

  describe("deny paths", () => {
    it("denies stream_user with STALE stream_verified_at (>= 12h, 24h, never)", () => {
      const cases = [
        { ts: hoursAgo(12), label: "exactly 12h" },
        { ts: hoursAgo(24), label: "24h" },
        { ts: null, label: "null timestamp" },
        { ts: undefined, label: "undefined timestamp" },
      ];
      for (const c of cases) {
        const d = evaluateVaultRevealAccess({
          profile: { rank: "stream_user", stream_verified_at: c.ts },
          hasAdminRole: false,
          now: NOW,
        });
        expect(d).toEqual({
          allow: false,
          reason: "stream_verification_stale",
        });
      }
    });

    it("denies plain authenticated users (rank: prospect / null / unknown)", () => {
      for (const rank of ["prospect", "enforcer", null, undefined, "guest"]) {
        const d = evaluateVaultRevealAccess({
          profile: { rank: rank as never, stream_verified_at: minutesAgo(1) },
          hasAdminRole: false,
          now: NOW,
        });
        expect(d.allow).toBe(false);
        expect(d.reason).toBe("rank_not_eligible");
      }
    });

    it("denies when no profile row exists at all", () => {
      const d = evaluateVaultRevealAccess({
        profile: null,
        hasAdminRole: false,
        now: NOW,
      });
      expect(d).toEqual({ allow: false, reason: "no_profile" });
    });

    it("denies stream_user with future timestamp older than window after now-shift (boundary safety)", () => {
      // A malicious / drifted timestamp should not magically allow if it
      // sits outside [now - WINDOW, now]. Test with a timestamp from
      // exactly one window ago (boundary).
      const d = evaluateVaultRevealAccess({
        profile: {
          rank: "stream_user",
          stream_verified_at: new Date(NOW - VAULT_REAUTH_WINDOW_MS).toISOString(),
        },
        hasAdminRole: false,
        now: NOW,
      });
      expect(d.allow).toBe(false);
    });

    it("denies stream_user with garbage timestamp string", () => {
      const d = evaluateVaultRevealAccess({
        profile: { rank: "stream_user", stream_verified_at: "not-a-date" },
        hasAdminRole: false,
        now: NOW,
      });
      expect(d.allow).toBe(false);
      expect(d.reason).toBe("stream_verification_stale");
    });
  });

  describe("assertVaultRevealAllowed", () => {
    it("throws 'Vault re-auth required' on deny", () => {
      expect(() =>
        assertVaultRevealAllowed({
          profile: { rank: "prospect", stream_verified_at: null },
          hasAdminRole: false,
          now: NOW,
        }),
      ).toThrow("Vault re-auth required");
    });

    it("does not throw on allow", () => {
      expect(() =>
        assertVaultRevealAllowed({
          profile: { rank: "vip", stream_verified_at: null },
          hasAdminRole: false,
          now: NOW,
        }),
      ).not.toThrow();
    });
  });
});

/**
 * Bypass-resistance: the client sets a sessionStorage flag
 * (`vault:unlocked`) via VaultGuard. The server fn MUST NOT consult that
 * flag in any form. We assert this by static inspection of the source.
 */
describe("server-side vault fn cannot honour client-side `vault:unlocked` flag", () => {
  const root = resolve(__dirname, "..", "..");
  const serverFnSrc = readFileSync(
    resolve(root, "src/lib/vault.functions.ts"),
    "utf8",
  );
  const gateSrc = readFileSync(
    resolve(root, "src/lib/vault-reauth-gate.ts"),
    "utf8",
  );

  it("server fn does not reference the client unlock flag", () => {
    expect(serverFnSrc).not.toMatch(/vault:unlocked/);
    expect(serverFnSrc).not.toMatch(/sessionStorage/);
    expect(serverFnSrc).not.toMatch(/localStorage/);
    expect(serverFnSrc).not.toMatch(/isVaultUnlocked/);
  });

  it("pure gate has no client-storage references either", () => {
    // Strip line comments + block comments before scanning so docstrings
    // describing what we DON'T do don't trip the test.
    const code = gateSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\n)\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/vault:unlocked/);
    expect(code).not.toMatch(/sessionStorage\s*[.[]/);
    expect(code).not.toMatch(/localStorage\s*[.[]/);
    expect(code).not.toMatch(/\bwindow\s*[.[]/);
  });

  it("server fn calls the shared assertVaultRevealAllowed gate (not an ad-hoc inline check)", () => {
    expect(serverFnSrc).toMatch(/assertVaultRevealAllowed\(/);
  });
});
