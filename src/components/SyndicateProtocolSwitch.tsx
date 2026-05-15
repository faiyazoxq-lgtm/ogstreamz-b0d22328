import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck } from "lucide-react";

/**
 * Syndicate Protocol — branded mood switch. Reads & writes a single
 * row in hub_settings identified by `hubKey`. Defaults to the
 * full-site `shape-bridge` config (the GlobalMoodProvider listener).
 */
export type SyndicateProtocolSwitchProps = {
  compact?: boolean;
  hubKey?: string;
  eyebrow?: string;
  titleNormal?: string;
  titleOg?: string;
  description?: React.ReactNode;
  descriptionNormal?: React.ReactNode;
  descriptionOg?: React.ReactNode;
  ogBadge?: string;
};

export function SyndicateProtocolSwitch({
  compact = false,
  hubKey = "shape-bridge",
  eyebrow = "Syndicate Protocol",
  titleNormal = "Global Mood · NORMAL",
  titleOg = "Global Mood · OG-MODE",
  description,
  descriptionNormal,
  descriptionOg,
  ogBadge = "OG Brutal · all-or-nothing",
}: SyndicateProtocolSwitchProps) {
  const [mode, setMode] = useState<"og" | "normal">("og");
  const [enabled, setEnabled] = useState(true);
  const [id, setId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("hub_settings")
        .select("id, enabled, tuning")
        .eq("hub_key", hubKey)
        .maybeSingle();
      if (!alive || !data) return;
      setId(data.id);
      setEnabled(!!data.enabled);
      const t = (data.tuning ?? {}) as { mode?: string };
      setMode(t.mode === "normal" ? "normal" : "og");
    })();
    return () => { alive = false; };
  }, [hubKey]);

  async function flip(next: "og" | "normal") {
    if (!id || saving || next === mode) return;
    setSaving(true);
    const prev = mode;
    setMode(next);
    const { error } = await supabase
      .from("hub_settings")
      .update({ tuning: { mode: next, intensity: "chaotic" }, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (error) {
      setMode(prev);
      toast.error(error.message);
      return;
    }
    toast.success(`Syndicate Protocol → ${next === "og" ? "OG-MODE · ENFORCER" : "NORMAL · ANALYST"}`);
  }

  async function toggleOnline(v: boolean) {
    if (!id || saving) return;
    setSaving(true);
    setEnabled(v);
    const { error } = await supabase
      .from("hub_settings")
      .update({ enabled: v, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (error) { setEnabled(!v); toast.error(error.message); }
  }

  const isOg = mode === "og";

  return (
    <div
      className={`glass-obsidian rounded-3xl p-5 md:p-6 ${compact ? "" : "md:p-8"}`}
      style={{ borderColor: "color-mix(in srgb, var(--syndicate-glow) 45%, transparent)" }}
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] mood-accent terminal-mono">
            {eyebrow}
          </div>
          <div className="syndicate-header text-lg md:text-xl mt-1 text-white/95">
            {isOg ? titleOg : titleNormal}
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggleOnline(!enabled)}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] terminal-mono px-3 py-1.5 rounded-full border"
          style={{
            borderColor: enabled ? "color-mix(in srgb, var(--syndicate-glow) 55%, transparent)" : "rgba(255,255,255,0.15)",
            color: enabled ? "var(--syndicate-glow)" : "rgba(255,255,255,0.5)",
            background: enabled ? "color-mix(in srgb, var(--syndicate-glow) 8%, transparent)" : "transparent",
          }}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "animate-pulse" : ""}`} style={{ background: "currentColor" }} />
          {enabled ? "Online" : "Offline"}
        </button>
      </div>

      {/* The Switch */}
      <div
        role="switch"
        aria-checked={isOg}
        tabIndex={0}
        onClick={() => flip(isOg ? "normal" : "og")}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && flip(isOg ? "normal" : "og")}
        className="relative grid grid-cols-2 rounded-2xl overflow-hidden cursor-pointer select-none border"
        style={{
          borderColor: "color-mix(in srgb, var(--syndicate-glow) 40%, transparent)",
          boxShadow: "inset 0 0 32px color-mix(in srgb, var(--syndicate-glow) 12%, transparent)",
          background: "rgba(0,0,0,0.45)",
        }}
      >
        <motion.div
          aria-hidden
          className="absolute inset-y-0 w-1/2 rounded-2xl"
          animate={{ left: isOg ? "50%" : "0%" }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          style={{
            background: isOg
              ? "linear-gradient(135deg, #FF003C 0%, #ff5577 100%)"
              : "linear-gradient(135deg, #00F2FF 0%, #4dd2ff 100%)",
            boxShadow: `0 0 32px ${isOg ? "#FF003C" : "#00F2FF"}99, inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        />
        {[
          { key: "normal" as const, label: "NORMAL", sub: "Elite Analyst", Icon: ShieldCheck },
          { key: "og" as const, label: "OG-MODE", sub: "Enforcer", Icon: ShieldAlert },
        ].map(({ key, label, sub, Icon }) => {
          const active = mode === key;
          return (
            <div
              key={key}
              className="relative z-[1] py-4 px-4 flex items-center justify-center gap-3 text-center"
            >
              <Icon className={`h-5 w-5 ${active ? "" : "neon-icon"}`} style={active ? { color: "#0a0a0a" } : undefined} />
              <div className="text-left">
                <div
                  className="syndicate-header text-sm md:text-base"
                  style={{ color: active ? "#0a0a0a" : "rgba(255,255,255,0.85)" }}
                >
                  {label}
                </div>
                <div
                  className="terminal-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: active ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.45)" }}
                >
                  {sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-white/55 terminal-mono leading-relaxed">
        {(isOg ? descriptionOg : descriptionNormal) ?? description ?? (
          <>
            Flips <span className="mood-accent">system_instruction</span> for every Gemini 3 call across
            the Syndicate — Boss Chat, Shape Bridge &amp; all hub agents — instantly.
          </>
        )}
      </p>

      {isOg && (
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2"
          style={{
            borderColor: "color-mix(in srgb, var(--syndicate-glow) 70%, transparent)",
            background: "color-mix(in srgb, var(--syndicate-glow) 12%, transparent)",
          }}>
          <ShieldAlert className="h-3.5 w-3.5" style={{ color: "var(--syndicate-glow)" }} />
          <span className="text-[10px] uppercase tracking-[0.3em] terminal-mono font-black text-white/90">
            {ogBadge}
          </span>
        </div>
      )}
    </div>
  );
}

export default SyndicateProtocolSwitch;