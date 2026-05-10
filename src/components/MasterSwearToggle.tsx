import { useState } from "react";
import { Flame, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Header-level master toggle for the Swearing Agent.
 * Flips `profile.feature_flags.swearing` for the signed-in user.
 * Replaces all per-panel/per-portal swearing on/off switches.
 */
export function MasterSwearToggle({ compact = false }: { compact?: boolean }) {
  const { user, profile, refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user || !profile) return null;
  const swearing = !!profile.feature_flags?.swearing;

  const onChange = async (next: boolean) => {
    setBusy(true);
    try {
      const merged = { ...(profile.feature_flags ?? {}), swearing: next };
      const { error } = await supabase
        .from("profiles")
        .update({ feature_flags: merged })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      await refresh();
      toast.success(next ? "Swearing Agent: ON 🔥" : "Swearing Agent: OFF");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to toggle swearing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <label
      className={[
        "inline-flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors select-none cursor-pointer",
        swearing
          ? "border-rose-600/60 bg-rose-950/30 text-rose-200"
          : "border-emerald-700/40 bg-black/30 text-emerald-300",
      ].join(" ")}
      title={swearing ? "Swearing Agent is ON for your account" : "Swearing Agent is OFF for your account"}
    >
      {swearing ? (
        <Flame className="h-3.5 w-3.5 text-rose-300" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
      )}
      {!compact && (
        <span className="text-[10px] uppercase tracking-[0.25em] font-black">
          Swear
        </span>
      )}
      <Switch
        checked={swearing}
        disabled={busy}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-rose-500"
        aria-label="Toggle Swearing Agent"
      />
      <span className="text-[10px] font-black uppercase tracking-widest">
        {swearing ? "ON" : "OFF"}
      </span>
    </label>
  );
}

export default MasterSwearToggle;