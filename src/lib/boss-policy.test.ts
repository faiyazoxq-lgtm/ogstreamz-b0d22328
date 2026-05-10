import { describe, it, expect } from "vitest";
import { shouldPromoteToBoss, normalizeEmail } from "./boss-policy";

const BOSS = "boss@example.com";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Boss@Example.COM  ")).toBe("boss@example.com");
  });
  it("handles null/undefined", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("")).toBe("");
  });
});

describe("shouldPromoteToBoss — exact-match policy", () => {
  it("grants boss only on exact email match", () => {
    expect(shouldPromoteToBoss(BOSS, BOSS)).toBe(true);
  });

  it("is case-insensitive and whitespace-tolerant on the user side", () => {
    expect(shouldPromoteToBoss("  BOSS@Example.com ", BOSS)).toBe(true);
  });

  it("rejects when BOSS_EMAIL is unset", () => {
    expect(shouldPromoteToBoss(BOSS, "")).toBe(false);
    expect(shouldPromoteToBoss(BOSS, null)).toBe(false);
    expect(shouldPromoteToBoss(BOSS, undefined)).toBe(false);
  });

  it("rejects when user email is empty", () => {
    expect(shouldPromoteToBoss("", BOSS)).toBe(false);
    expect(shouldPromoteToBoss(null, BOSS)).toBe(false);
    expect(shouldPromoteToBoss(undefined, BOSS)).toBe(false);
  });

  it("rejects different addresses", () => {
    expect(shouldPromoteToBoss("intruder@example.com", BOSS)).toBe(false);
    expect(shouldPromoteToBoss("boss@evil.com", BOSS)).toBe(false);
  });
});

describe("shouldPromoteToBoss — legacy 'faiyaz' backdoor is closed", () => {
  // Historical regex granted VIP to any email whose local part contained
  // "faiyaz". These cases assert that path is gone.
  const previouslyAllowed = [
    "faiyaz@gmail.com",
    "faiyazoxq@gmail.com",
    "Faiyaz.Khan@outlook.com",
    "mr-faiyaz@proton.me",
    "faiyaz123@yahoo.com",
    "x.faiyaz.y@example.org",
  ];

  it.each(previouslyAllowed)("denies %s when BOSS_EMAIL is different", (email) => {
    expect(shouldPromoteToBoss(email, BOSS)).toBe(false);
  });

  it.each(previouslyAllowed)("denies %s even when BOSS_EMAIL is unset", (email) => {
    expect(shouldPromoteToBoss(email, "")).toBe(false);
  });

  it("does not match by substring or local-part", () => {
    expect(shouldPromoteToBoss("boss-impersonator@example.com", BOSS)).toBe(false);
    expect(shouldPromoteToBoss("boss@example.com.attacker.io", BOSS)).toBe(false);
    expect(shouldPromoteToBoss("xboss@example.com", BOSS)).toBe(false);
  });
});