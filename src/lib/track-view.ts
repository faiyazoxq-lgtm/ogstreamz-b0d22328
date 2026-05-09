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

/**
 * Anonymous public-view analytics. Records one event per visitor per slug per session
 * (deduped via sessionStorage so reloads in the same tab don't double-count).
 */
export async function trackPortalView(kind: "portal" | "battle", slug: string) {
  if (typeof window === "undefined" || !slug) return;
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