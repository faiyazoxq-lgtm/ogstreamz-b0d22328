import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cookieless Cloudflare Web Analytics beacon.
 * Token is read from public.store_settings.cf_analytics_token (Boss-editable).
 * The CF beacon token is a public client snippet — safe to ship to the browser.
 * No-ops until a token is set.
 */
export function CloudflareAnalytics() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("store_settings")
      .select("cf_analytics_token")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setToken((data?.cf_analytics_token ?? "").trim() || null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    if (document.querySelector('script[data-cf-beacon-injected="1"]')) return;
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token }));
    s.setAttribute("data-cf-beacon-injected", "1");
    document.head.appendChild(s);
  }, [token]);

  return null;
}