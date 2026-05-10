import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setPaymentModeOverride } from "@/lib/stripe";

export type PaymentMode = "test" | "live";

let cached: PaymentMode | null = null;
const listeners = new Set<(m: PaymentMode) => void>();
let subscribed = false;

function applyMode(m: PaymentMode) {
  cached = m;
  setPaymentModeOverride(m);
  for (const fn of listeners) fn(m);
}

async function loadOnce() {
  const { data } = await supabase
    .from("payments_settings")
    .select("mode")
    .eq("id", 1)
    .maybeSingle();
  if (data?.mode === "live" || data?.mode === "test") applyMode(data.mode);
}

function subscribe() {
  if (subscribed) return;
  subscribed = true;
  void loadOnce();
  supabase
    .channel("payments_settings")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "payments_settings" },
      (payload) => {
        const next = (payload.new as { mode?: PaymentMode } | null)?.mode;
        if (next === "test" || next === "live") applyMode(next);
      },
    )
    .subscribe();
}

export function usePaymentMode(): PaymentMode {
  const [mode, setMode] = useState<PaymentMode>(cached ?? "test");
  useEffect(() => {
    subscribe();
    const fn = (m: PaymentMode) => setMode(m);
    listeners.add(fn);
    if (cached) setMode(cached);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return mode;
}

export async function setPaymentMode(mode: PaymentMode): Promise<void> {
  const { error } = await supabase
    .from("payments_settings")
    .update({ mode, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
  applyMode(mode);
}