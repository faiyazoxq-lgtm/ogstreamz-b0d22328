import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "ogs_visitor_id";

function getVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

const SESSION_KEY = "ogs_view_session";

// Common bot / crawler / preview-fetcher signatures. Kept lower-case.
const BOT_UA_RE = /bot|crawler|spider|crawling|slurp|bingpreview|mediapartners|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|skypeuripreview|pinterest|embedly|quora|outbrain|vkshare|w3c_validator|redditbot|applebot|duckduckbot|yandex|baiduspider|sogou|petalbot|ahrefs|semrush|mj12bot|dotbot|seznambot|ia_archiver|archive\.org_bot|gptbot|claudebot|anthropic|chatgpt-user|perplexitybot|ccbot|google-inspectiontool|google-extended|bytespider|amazonbot|headlesschrome|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|chrome-lighthouse|node-fetch|axios|python-requests|curl|wget|httpclient|okhttp|go-http-client|java\/|libwww-perl|scrapy|nutch|cypress|prerender|prerendercloud|http-client|monitor|uptimerobot|pingdom|statuscake|newrelic|datadog/i;

function looksLikeBot(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = (navigator.userAgent || "").toLowerCase();
  if (!ua) return true;
  if (BOT_UA_RE.test(ua)) return true;
  // Headless Chromium signal
  // @ts-expect-error — webdriver is non-standard but widely available
  if (navigator.webdriver) return true;
  return false;
}

/**
 * Anonymous public-view analytics. Records one event per visitor per slug per session
 * (deduped via sessionStorage so reloads in the same tab don't double-count).
 * Skips obvious bots / crawlers / headless browsers entirely.
 */
export async function trackPortalView(kind: "portal" | "battle", slug: string) {
  if (typeof window === "undefined" || !slug) return;
  if (looksLikeBot()) return;
  try {
    const dedupeKey = `${SESSION_KEY}:${kind}:${slug}`;
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, "1");
  } catch { /* ignore */ }

  try {
    await supabase.from("portal_view_events").insert({
      kind,
      slug,
      visitor_id: getVisitorId(),
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
      path: window.location.pathname + window.location.search,
    });
  } catch { /* swallow — analytics must never break the page */ }
}