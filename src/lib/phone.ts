/**
 * Phone number normalization + formatting helpers.
 * Default region: GB (United Kingdom). Stores numbers in E.164 form
 * (e.g. "+447347265145") and formats them for display either as
 * UK national ("07347 265145") or international ("+44 7347 265145").
 */

export type PhoneParseResult =
  | { ok: true; e164: string; national: string; display: string }
  | { ok: false; error: string };

/** Strip everything except digits and a leading "+". */
function stripFormatting(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^\d]/g, "");
}

/**
 * Parse a phone number, defaulting to UK if no country code is present.
 * Accepts: "07347265145", "07347 265145", "+447347265145",
 * "+44 7347 265145", "00447347265145".
 */
export function parsePhone(input: string): PhoneParseResult {
  if (!input || !input.trim()) {
    return { ok: false, error: "Phone number is required" };
  }
  let s = stripFormatting(input);

  // International "00" prefix → "+"
  if (s.startsWith("00")) s = "+" + s.slice(2);

  // Default UK: bare 0… becomes +44…
  if (!s.startsWith("+")) {
    if (s.startsWith("0")) s = "+44" + s.slice(1);
    else if (/^\d{10,15}$/.test(s)) s = "+" + s;
    else return { ok: false, error: "Enter a valid phone number" };
  }

  const digits = s.slice(1);
  if (!/^\d{8,15}$/.test(digits)) {
    return { ok: false, error: "Phone number must be 8–15 digits" };
  }

  // UK-specific shape check (must be 10 digits after country code)
  if (s.startsWith("+44") && digits.length !== 12) {
    return { ok: false, error: "UK numbers must be 11 digits (e.g. 07XXX XXXXXX)" };
  }

  return {
    ok: true,
    e164: s,
    national: toNational(s),
    display: toDisplay(s),
  };
}

/** Format an E.164 number as a UK national string when possible. */
export function toNational(e164: string): string {
  if (e164.startsWith("+44")) {
    const rest = e164.slice(3); // 10 digits
    return `0${rest.slice(0, 4)} ${rest.slice(4)}`;
  }
  return toDisplay(e164);
}

/** Format an E.164 number for display, grouping digits in readable chunks. */
export function toDisplay(e164: string): string {
  if (!e164.startsWith("+")) {
    // Best-effort: try to normalize unstored legacy values.
    const r = parsePhone(e164);
    if (r.ok) return toDisplay(r.e164);
    return e164;
  }
  if (e164.startsWith("+44") && e164.length === 13) {
    const rest = e164.slice(3);
    return `+44 ${rest.slice(0, 4)} ${rest.slice(4, 7)} ${rest.slice(7)}`;
  }
  // Generic: "+CC XXX XXX XXXX"
  const digits = e164.slice(1);
  const cc = digits.slice(0, digits.length > 11 ? 3 : 2);
  const rest = digits.slice(cc.length);
  return `+${cc} ${rest.replace(/(\d{3})(?=\d)/g, "$1 ").trim()}`;
}

/** Convenience: normalize to E.164 or throw. */
export function normalizePhoneOrThrow(input: string): string {
  const r = parsePhone(input);
  if (!r.ok) throw new Error(r.error);
  return r.e164;
}