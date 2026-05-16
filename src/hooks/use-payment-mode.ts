import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setPaymentModeOverride } from "@/lib/stripe";

export type PaymentMode = "test" | "live";

let cached: PaymentMode | null = null;
let loaded = false;
const listeners = new Set<(m: PaymentMode) => void>();
let subscribed = false;

function applyMode(m: PaymentMode) {
  cached = m;
  setPaymentModeOverride(m);
  for (const fn of listeners) fn(m);
}

async function loadOnce() {
  // payments_settings reads are restricted to authenticated users only.
  // Skip the query (and the realtime subscription) for anonymous visitors
  // so we don't fall back to the default "test" banner on the live site.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  const { data } = await supabase
    .from("payments_settings")
    .select("mode")
    .eq("id", 1)
    .maybeSingle();
  if (data?.mode === "live" || data?.mode === "test") {
    loaded = true;
    applyMode(data.mode);
  }
}

function subscribe() {
  if (subscribed) return;
  subscribed = true;
  void loadOnce();
  // Re-load whenever auth state changes, so a sign-in picks up the
  // current mode and a sign-out clears it. The realtime subscription
  // is also gated behind a session because it requires authenticated
  // RLS on realtime.messages.
  supabase.auth.onAuthStateChange(() => {
    void loadOnce();
  });
  supabase
    .channel("payments_settings")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "payments_settings" },
      (payload) => {
        const next = (payload.new as { mode?: PaymentMode } | null)?.mode;
        if (next === "test" || next === "live") {
          loaded = true;
          applyMode(next);
        }
      },
    )
    .subscribe();
}

/** Returns the live/test mode, or `null` if it hasn't been loaded yet
 *  (e.g. for anonymous visitors who don't have read access). Consumers
 *  should hide test-mode UI when this is `null` instead of assuming "test". */
export function usePaymentMode(): PaymentMode | null {
  const [mode, setMode] = useState<PaymentMode | null>(loaded ? cached : null);
  useEffect(() => {
    subscribe();
    const fn = (m: PaymentMode) => setMode(m);
    listeners.add(fn);
    if (loaded && cached) setMode(cached);
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
  loaded = true;
  applyMode(mode);
}