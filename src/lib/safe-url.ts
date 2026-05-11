import { normalizeDomain, urlMatchesDenylist } from "./use-domain-denylist";

const DANGEROUS_SCHEMES = /^(javascript|data|vbscript|file):/i;

/**
 * Returns a safe href, or null if blocked.
 * - rejects javascript:, data:, vbscript:, file: schemes
 * - rejects URLs whose host matches the denylist (incl. subdomains)
 */
export function sanitizeUrl(input: string | null | undefined, denylist: string[] = []): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  if (DANGEROUS_SCHEMES.test(raw)) return null;
  // mailto/tel/internal anchors are OK as-is (no host)
  if (/^(mailto:|tel:|#|\/)/i.test(raw)) return raw;
  if (urlMatchesDenylist(raw, denylist)) return null;
  return raw;
}

export function textContainsBlockedDomain(text: string, denylist: string[]): boolean {
  if (!text) return false;
  const hay = text.toLowerCase();
  return denylist.some((d) => {
    const n = normalizeDomain(d);
    if (!n) return false;
    return new RegExp(`(^|[^a-z0-9._-])${n.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(hay);
  });
}