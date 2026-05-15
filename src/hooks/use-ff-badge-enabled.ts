import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the global Friends & Family badge visibility flag.
 * Stored in hub_settings(hub_key='ff-badge').enabled. Defaults to true
 * while loading (so existing badges don't flicker out on first paint).
 */
export function useFFBadgeEnabled(): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("hub_settings")
        .select("enabled")
        .eq("hub_key", "ff-badge")
        .maybeSingle();
      if (!alive || !data) return;
      setEnabled(!!data.enabled);
    })();

    const channel = supabase
      .channel("ff-badge-setting")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "hub_settings", filter: "hub_key=eq.ff-badge" },
        (payload: any) => setEnabled(!!payload?.new?.enabled),
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return enabled;
}
