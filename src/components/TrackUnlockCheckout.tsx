import { useEffect, useState } from "react";
import { CoinCheckout } from "@/components/CoinCheckout";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  trackId: string;
  /** Kept for backward compat; ignored in coin-only mode. */
  customerEmail?: string;
  returnUrl?: string;
  onSuccess?: () => void;
}

export function TrackUnlockCheckout({ trackId, onSuccess }: Props) {
  const [meta, setMeta] = useState<{ title: string; cost: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("tracks_public").select("title, price_cents").eq("id", trackId).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMeta({
          title: data.title,
          cost: Math.max(1, Math.ceil((data.price_cents ?? 200) / 100)),
        });
      });
    return () => { cancelled = true; };
  }, [trackId]);

  if (!meta) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">Loading…</div>;
  }

  return (
    <CoinCheckout
      kind="track_unlock"
      ref={trackId}
      cost={meta.cost}
      itemTitle={meta.title}
      onSuccess={onSuccess}
    />
  );
}