import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Header-level master toggle for the Swearing Agent.
 * Flips `profile.feature_flags.swearing` for the signed-in user.
 * Replaces all per-panel/per-portal swearing on/off switches.
 */
export function MasterSwearToggle({ compact: _compact = false }: { compact?: boolean }) {
  const { user, profile, refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user || !profile) return null;
  const swearing = !!profile.feature_flags?.swearing;

  const toggle = async () => {
    if (busy) return;
    const next = !swearing;
    setBusy(true);
    try {
      const merged = { ...(profile.feature_flags ?? {}), swearing: next };
      const { error } = await supabase
        .from("profiles")
        .update({ feature_flags: merged })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      await refresh();
      toast.success(next ? "Swearing Agent: ON 🖕" : "Safe Mode: ON 💚");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to toggle swearing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={swearing}
      aria-label={swearing ? "Swearing Agent on — tap for Safe Mode" : "Safe Mode on — tap to enable Swearing Agent"}
      title={swearing ? "Swearing Agent ON — tap for Safe Mode" : "Safe Mode ON — tap to enable Swearing Agent"}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all select-none",
        "active:scale-95 disabled:opacity-60",
        swearing
          ? "border-rose-500/60 bg-rose-950/40 text-rose-200 hover:bg-rose-900/50 shadow-[0_0_12px_-2px_rgba(244,63,94,0.55)]"
          : "border-emerald-500/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40 shadow-[0_0_12px_-2px_rgba(16,185,129,0.5)]",
      ].join(" ")}
    >
      {swearing ? (
        // Middle finger — lucide has no glyph for this, emoji is the cleanest tiny version.
        <span aria-hidden className="text-base leading-none">🖕</span>
      ) : (
        <Heart aria-hidden className="h-4 w-4 fill-emerald-400 text-emerald-400" />
      )}
    </button>
  );
}

export default MasterSwearToggle;