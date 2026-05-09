import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GlobalMood = "og" | "normal";

type Ctx = { mood: GlobalMood; enabled: boolean; loading: boolean };
const MoodContext = createContext<Ctx>({ mood: "og", enabled: true, loading: true });

export function GlobalMoodProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<GlobalMood>("og");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase
        .from("hub_settings")
        .select("enabled, tuning")
        .eq("hub_key", "shape-bridge")
        .maybeSingle();
      if (!alive) return;
      const t = (data?.tuning ?? {}) as { mode?: string };
      setMood(t.mode === "normal" ? "normal" : "og");
      setEnabled(data?.enabled ?? true);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel("global-mood")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hub_settings", filter: "hub_key=eq.shape-bridge" },
        (payload: any) => {
          const row = payload.new ?? payload.record ?? {};
          const t = (row.tuning ?? {}) as { mode?: string };
          setMood(t.mode === "normal" ? "normal" : "og");
          setEnabled(row.enabled ?? true);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.mood = mood;
  }, [mood]);

  return (
    <MoodContext.Provider value={{ mood, enabled, loading }}>{children}</MoodContext.Provider>
  );
}

export function useGlobalMood() {
  return useContext(MoodContext);
}