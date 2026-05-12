import { describe, it, expect } from "vitest";
import { parsePhone, toNational, toDisplay, normalizePhoneOrThrow } from "./phone";

function ok(input: string) {
  const r = parsePhone(input);
  if (!r.ok) throw new Error(`expected ok for ${input}, got: ${r.error}`);
  return r;
}

describe("parsePhone", () => {
  it("parses UK national 0… form", () => {
    const r = ok("07347265145");
    expect(r.e164).toBe("+447347265145");
    expect(r.national).toBe("07347 265145");
    expect(r.display).toBe("+44 7347 265 145");
  });

  it("ignores spaces and punctuation in 0… form", () => {
    const r = ok("  07347 265 145  ");
    expect(r.e164).toBe("+447347265145");
  });

  it("parses +44 international form with spaces", () => {
    const r = ok("+44 7347 265145");
    expect(r.e164).toBe("+447347265145");
    expect(r.national).toBe("07347 265145");
  });

  it("parses 00 international prefix as +", () => {
    const r = ok("00447347265145");
    expect(r.e164).toBe("+447347265145");
    expect(r.display).toBe("+44 7347 265 145");
  });

  it("parses non-UK + numbers", () => {
    const r = ok("+14155551234");
    expect(r.e164).toBe("+14155551234");
  });

  it("rejects empty input", () => {
    expect(parsePhone("").ok).toBe(false);
    expect(parsePhone("   ").ok).toBe(false);
  });

  it("rejects too-short numbers", () => {
    expect(parsePhone("123").ok).toBe(false);
  });

  it("rejects malformed UK length", () => {
    const r = parsePhone("+4473472651"); // too short for UK
    expect(r.ok).toBe(false);
  });

  it("rejects non-digit garbage", () => {
    expect(parsePhone("abcdef").ok).toBe(false);
  });

  it("normalizePhoneOrThrow returns E.164 or throws", () => {
    expect(normalizePhoneOrThrow("07347265145")).toBe("+447347265145");
    expect(() => normalizePhoneOrThrow("")).toThrow();
  });

  it("is idempotent across input variants", () => {
    const variants = [
      "07347265145",
      "07347 265145",
      "+447347265145",
      "+44 7347 265145",
      "00447347265145",
    ];
    const e164s = variants.map((v) => ok(v).e164);
    expect(new Set(e164s).size).toBe(1);
    expect(e164s[0]).toBe("+447347265145");
  });
});

describe("toNational", () => {
  it("formats UK E.164 as 0XXXX XXXXXX", () => {
    expect(toNational("+447347265145")).toBe("07347 265145");
  });

  it("falls back to display formatting for non-UK numbers", () => {
    expect(toNational("+14155551234")).toBe(toDisplay("+14155551234"));
  });
});

describe("toDisplay", () => {
  it("formats UK E.164 with country code and groups", () => {
    expect(toDisplay("+447347265145")).toBe("+44 7347 265 145");
  });

  it("formats generic international numbers in groups", () => {
    // Generic formatter uses a 2-digit country code when total digits ≤ 11.
    expect(toDisplay("+14155551234")).toBe("+14 155 551 234");
    // 12+ digits switch to a 3-digit country code group.
    expect(toDisplay("+331234567890")).toBe("+331 234 567 890");
  });

  it("normalizes legacy un-prefixed input via parsePhone", () => {
    expect(toDisplay("07347265145")).toBe("+44 7347 265 145");
  });

  it("returns input unchanged when it cannot be parsed", () => {
    expect(toDisplay("not-a-number")).toBe("not-a-number");
  });
});