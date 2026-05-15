import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches `credits` for a list of profile IDs and returns a map keyed by id.
 * Used by roster/list views to render <CoinChip /> next to each user name.
 */
export function useCreditsMap(ids: Array<string | null | undefined>): Record<string, number> {
  const [map, setMap] = useState<Record<string, number>>({});
  // Stable key from sorted unique ids
  const key = Array.from(new Set(ids.filter(Boolean) as string[])).sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(",") : [];
    if (list.length === 0) {
      setMap({});
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("id,credits").in("id", list);
      if (cancelled || !data) return;
      const next: Record<string, number> = {};
      for (const r of data as Array<{ id: string; credits: number | null }>) {
        next[r.id] = Number(r.credits ?? 0);
      }
      setMap(next);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [key]);

  return map;
}