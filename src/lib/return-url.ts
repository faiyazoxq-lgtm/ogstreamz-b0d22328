const ALLOWED_RETURN_ORIGINS = [
  "https://ogstreamz.co.uk",
  "https://www.ogstreamz.co.uk",
  "https://ogstreamz.lovable.app",
];

/**
 * Validate a Stripe checkout `return_url` against an allowlist of origins
 * we control. Prevents an authenticated attacker from creating a checkout
 * session that redirects the payer to a phishing site after payment.
 *
 * Also permits any *.lovable.app preview/published origin so dev + preview
 * flows keep working.
 */
export function validateReturnUrl(input: unknown): string {
  const raw = String(input ?? "").slice(0, 500);
  if (!raw) throw new Error("Invalid returnUrl");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid returnUrl");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Invalid returnUrl");
  }
  const origin = `${url.protocol}//${url.host}`;
  const ok =
    ALLOWED_RETURN_ORIGINS.includes(origin) ||
    /\.lovable\.app$/i.test(url.hostname) ||
    /\.lovable\.dev$/i.test(url.hostname) ||
    /\.lovableproject\.com$/i.test(url.hostname) ||
    /\.sandbox\.lovable\.dev$/i.test(url.hostname) ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1";
  if (!ok) throw new Error("Invalid returnUrl: origin not allowed");
  return raw;
}