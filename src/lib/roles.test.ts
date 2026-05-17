import { describe, expect, it } from "vitest";
import {
  ROLE_CONFIG,
  hasRole,
  isBossProfile,
  isStreamProfile,
  isVipProfile,
  isVipProfileWithPass,
} from "./roles";

describe("roles config (single source of truth)", () => {
  it("vip config implies boss (boss outranks vip everywhere)", () => {
    expect(ROLE_CONFIG.vip.ranks).toContain("boss");
    expect(ROLE_CONFIG.stream.ranks).toContain("boss");
    expect(ROLE_CONFIG.stream.ranks).toContain("vip");
  });

  it("isBossProfile matches rank=boss and admins, nothing else", () => {
    expect(isBossProfile({ rank: "boss" })).toBe(true);
    expect(isBossProfile(null, { isAdmin: true })).toBe(true);
    expect(isBossProfile({ rank: "vip", status: "vip" })).toBe(false);
    expect(isBossProfile({ rank: "stream_user" })).toBe(false);
    expect(isBossProfile(null)).toBe(false);
  });

  it("isVipProfile accepts rank vip/boss, status vip, real_og flag, admins", () => {
    expect(isVipProfile({ rank: "vip" })).toBe(true);
    expect(isVipProfile({ rank: "boss" })).toBe(true);
    expect(isVipProfile({ status: "vip" })).toBe(true);
    expect(isVipProfile({ feature_flags: { real_og: true } })).toBe(true);
    expect(isVipProfile(null, { isAdmin: true })).toBe(true);
    expect(isVipProfile({ rank: "stream_user" })).toBe(false);
    expect(isVipProfile({ rank: "enforcer" })).toBe(false);
    expect(isVipProfile(null)).toBe(false);
  });

  it("banned users never satisfy any role even with matching rank", () => {
    expect(isVipProfile({ rank: "vip", banned: true })).toBe(false);
    expect(isBossProfile({ rank: "boss", banned: true })).toBe(false);
    expect(isStreamProfile({ rank: "stream_user", banned: true })).toBe(false);
  });

  it("isStreamProfile includes stream_user, vip, boss, status=vip, admins", () => {
    expect(isStreamProfile({ rank: "stream_user" })).toBe(true);
    expect(isStreamProfile({ rank: "vip" })).toBe(true);
    expect(isStreamProfile({ rank: "boss" })).toBe(true);
    expect(isStreamProfile({ status: "vip" })).toBe(true);
    expect(isStreamProfile(null, { isAdmin: true })).toBe(true);
    expect(isStreamProfile({ rank: "prospect" })).toBe(false);
  });

  it("isVipProfileWithPass honours an active pass", () => {
    expect(isVipProfileWithPass({ rank: "enforcer" }, { hasActivePass: true })).toBe(true);
    expect(isVipProfileWithPass({ rank: "enforcer" }, { hasActivePass: false })).toBe(false);
  });

  it("hasRole dispatches by role key", () => {
    expect(hasRole("boss", { rank: "boss" })).toBe(true);
    expect(hasRole("vip", { status: "vip" })).toBe(true);
    expect(hasRole("stream", { rank: "stream_user" })).toBe(true);
    expect(hasRole("member", { rank: "prospect" })).toBe(true);
    expect(hasRole("member", { rank: "prospect", banned: true })).toBe(false);
    expect(hasRole("member", null)).toBe(false);
  });

  it("adding a new rank to the config grants every page that uses helpers", () => {
    // Simulates extending the ladder without touching call sites — the helpers
    // immediately recognise the new rank because they read from ROLE_CONFIG.
    const originalRanks = ROLE_CONFIG.vip.ranks;
    (ROLE_CONFIG.vip as any).ranks = [...originalRanks, "lifetime"];
    try {
      expect(isVipProfile({ rank: "lifetime" })).toBe(true);
    } finally {
      (ROLE_CONFIG.vip as any).ranks = originalRanks;
    }
  });
});