import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SIGNUP_BONUS_CREDITS } from "@/components/AuthGate";

export function useSignupBonus(): number {
  const [bonus, setBonus] = useState<number>(SIGNUP_BONUS_CREDITS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "signup_bonus_credits")
        .maybeSingle();
      if (cancelled) return;
      const v = Number(data?.value);
      if (Number.isFinite(v) && v >= 0) setBonus(Math.trunc(v));
    })();
    const ch = supabase
      .channel("app_settings_signup_bonus")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.signup_bonus_credits" },
        (payload) => {
          const v = Number((payload.new as { value?: unknown } | null)?.value);
          if (Number.isFinite(v) && v >= 0) setBonus(Math.trunc(v));
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);
  return bonus;
}
