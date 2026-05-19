import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import fingerUp from "@/assets/chaos-finger-up.png";
import fistBump from "@/assets/chaos-fist-bump.png";
import { updateGlobalMoodToggle } from "@/lib/global-mood.functions";

type HubKey = "shape-bridge" | "og-bot";

type Props = {
  hubKey: HubKey;
  label: string;
};

/**
 * Compact admin status chip for one of the Global Mood hubs.
 * - Reads current mode + enabled from hub_settings.
 * - Toggle = a flipping middle finger / fist bump image.
 *   - ON  (mode === "og"  AND  enabled): finger up · CHAOS MODE · ON
 *   - OFF (anything else): fist bump   · CHAOS MODE · OFF
 * - Clicking the image flips ONLY the mode (og <-> normal). The Online/Offline
 *   switch lives on the bigger SyndicateProtocolSwitch — this is purely a
 *   compact at-a-glance + quick-flip chip.
 */
export function ChaosModeIndicator({ hubKey, label }: Props) {
  const [mode, setMode] = useState<"og" | "normal" | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [flipKey, setFlipKey] = useState(0);
  const save = useServerFn(updateGlobalMoodToggle);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("hub_settings")
        .select("enabled, tuning")
        .eq("hub_key", hubKey)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        toast.error(error.message);
        return;
      }
      const t = (data?.tuning ?? {}) as { mode?: string };
      setMode(t.mode === "normal" ? "normal" : "og");
      setEnabled(!!data?.enabled);
    })();
    return () => {
      alive = false;
    };
  }, [hubKey]);

  const isChaosOn = mode === "og" && enabled;

  const flip = async () => {
    if (busy || mode === null) return;
    const nextMode: "og" | "normal" = mode === "og" ? "normal" : "og";
    setBusy(true);
    const prev = mode;
    setMode(nextMode);
    setFlipKey((k) => k + 1);
    try {
      const res = await save({ data: { hubKey, mode: nextMode } });
      setMode(res.mode === "normal" ? "normal" : "og");
      toast.success(
        `${label} → ${res.mode === "og" && res.enabled ? "CHAOS · ON" : "CHAOS · OFF"}`,
      );
    } catch (e: any) {
      setMode(prev);
      toast.error(e?.message ?? "Failed to flip");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={flip}
      disabled={busy || mode === null}
      aria-pressed={isChaosOn}
      title={`${label} · click to ${isChaosOn ? "calm down" : "go feral"}`}
      className="group inline-flex items-center gap-3 rounded-2xl border px-3 py-2 transition disabled:opacity-60"
      style={{
        borderColor: isChaosOn ? "rgba(255,46,85,0.55)" : "rgba(0,242,255,0.4)",
        background: isChaosOn ? "rgba(255,46,85,0.10)" : "rgba(0,242,255,0.06)",
        boxShadow: isChaosOn
          ? "0 0 24px rgba(255,46,85,0.25), inset 0 0 16px rgba(255,46,85,0.10)"
          : "0 0 18px rgba(0,242,255,0.18), inset 0 0 12px rgba(0,242,255,0.08)",
      }}
    >
      <span
        className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl"
        style={{
          perspective: "400px",
        }}
      >
        <img
          key={`${isChaosOn ? "up" : "fist"}-${flipKey}`}
          src={isChaosOn ? fingerUp : fistBump}
          alt={isChaosOn ? "Middle finger up — OG mode on" : "Fist bump — OG mode off"}
          width={40}
          height={40}
          loading="lazy"
          className="h-10 w-10 object-contain animate-chaos-flip drop-shadow-[0_0_6px_rgba(0,0,0,0.6)]"
          style={{
            filter: isChaosOn
              ? "drop-shadow(0 0 6px rgba(255,46,85,0.7))"
              : "drop-shadow(0 0 6px rgba(0,242,255,0.6))",
          }}
        />
      </span>
      <span className="flex flex-col items-start text-left leading-tight">
        <span
          className="text-[9px] uppercase tracking-[0.32em] terminal-mono"
          style={{ color: isChaosOn ? "#ffb3c4" : "#9ff0ff" }}
        >
          {label}
        </span>
        <span
          className="syndicate-header text-sm font-black"
          style={{ color: isChaosOn ? "#ff2e55" : "#00F2FF" }}
        >
          OG MODE · {mode === null ? "…" : isChaosOn ? "ON" : "OFF"}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          {!enabled
            ? "Hub Offline"
            : mode === "og"
              ? "OG · Enforcer"
              : "Normal · Analyst"}
        </span>
      </span>
    </button>
  );
}

export default ChaosModeIndicator;
