import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Brain, ShieldAlert, ShieldCheck, Skull, Loader2, Link2, Heart, EyeOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { SyndicateProtocolSwitch } from "@/components/SyndicateProtocolSwitch";
import { getCivility, setCivilityDefault } from "@/lib/civility.functions";
import { supabase } from "@/integrations/supabase/client";
import { updateGlobalMoodToggle } from "@/lib/global-mood.functions";
import { ChaosModeIndicator } from "@/components/boss/ChaosModeIndicator";

/**
 * Unified Global Mood · Syndicate Protocol panel.
 *
 * Brings together every OG-mode toggle that used to be scattered across
 * /admin, /boss/civility and /boss/power into one place:
 *   1. Full-Site Syndicate Protocol  (hub_settings hub_key="shape-bridge")
 *   2. OG Bot persona switch         (hub_settings hub_key="og-bot")
 *   3. Global Civility default       (civility_settings.swear_default)
 *
 * Drop-in: render anywhere a Boss can see it. Per-item civility (the
 * deep CivilityPanel) is still reachable via the link in the footer.
 */
export function GlobalMoodPanel({ heading = true }: { heading?: boolean }) {
  return (
    <div className="space-y-4">
      {heading && (
        <header className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 ring-1 ring-rose-500/40">
            <Brain className="h-4 w-4 text-rose-300" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
              Global Mood
            </div>
            <h2 className="syndicate-header text-lg md:text-xl text-white/95">
              Syndicate Protocol · OG-Mode Controls
            </h2>
            <p className="text-xs text-white/55 mt-0.5">
              Every OG-mode lever in one place — full-site voice, OG Bot persona,
              and the global civility default.
            </p>
          </div>
        </header>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ChaosModeIndicator hubKey="shape-bridge" label="Full Site" />
        <ChaosModeIndicator hubKey="og-bot" label="OG Bot" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SyndicateProtocolSwitch
          hubKey="shape-bridge"
          eyebrow="Full Site · Visual Mood"
          titleNormal="Global Mood · NORMAL"
          titleOg="Global Mood · OG-MODE"
          descriptionNormal={
            <>
              <span className="mood-accent">NORMAL</span> — site-wide visual mood flips to the
              clean Analyst palette. Sets <code>data-mood="normal"</code> on the root, switches
              accent colors in the Enforcer Console, Live Thinking Feed, System Glitch overlay
              and <code>/console</code>. Cosmetic only — does not change any Gemini prompt or
              the OG Bot voice.
            </>
          }
          descriptionOg={
            <>
              <span className="mood-accent">OG-MODE</span> — site-wide visual mood goes red.
              Sets <code>data-mood="og"</code> on the root, lights up the Enforcer Console,
              Live Thinking Feed, System Glitch overlay and <code>/console</code> in the
              hostile palette. Visual only — Gemini prompts and the OG Bot voice are
              controlled separately.
            </>
          }
          ogBadge="Full Site · Visual OG"
        />
        <SyndicateProtocolSwitch
          hubKey="og-bot"
          eyebrow="OG Bot · Draft Assistant"
          titleNormal="Global Mood · NORMAL"
          titleOg="Global Mood · OG-MODE"
          descriptionNormal={
            <>
              <span className="mood-accent">NORMAL</span> — OG Bot, the in-app draft sidekick
              that powers the Portal Brief Wizard, Spawn Portal card and every hub draft
              surface (jokes, music, battle, fleet, connect, formhub, letterhub, appealhub,
              tools, boss hub editor), speaks in the short, punchy, brand-safe voice. No
              swearing. Also dampens the site-guide chaos modulation. Off-switch on this
              card forces NORMAL regardless of the mode toggle.
            </>
          }
          descriptionOg={
            <>
              <span className="mood-accent">OG-MODE</span> — OG Bot becomes the foul-mouthed
              British enforcer in every in-app draft (Portal Brief Wizard, Spawn Portal,
              all hub draft helpers) and amplifies the site-guide chaos modulation. Persistent
              memory and tool-calling are unchanged. Scoped to OG Bot — does not touch the
              site-wide visual mood.
            </>
          }
          ogBadge="OG Bot · Foul-Mouthed Drafts"
        />
      </div>

      <CivilityDefaultRow />
      <FriendsFamilyBadgeRow />
    </div>
  );
}

function CivilityDefaultRow() {
  const fetchCivility = useServerFn(getCivility);
  const saveCivility = useServerFn(setCivilityDefault);
  const [defaultOn, setDefaultOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await fetchCivility();
        setDefaultOn(!!c.swear_default);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load civility");
      }
    })();
  }, [fetchCivility]);

  const flip = async (next: boolean) => {
    setBusy(true);
    const prev = defaultOn;
    setDefaultOn(next);
    try {
      const res = await saveCivility({ data: { enabled: next, applyToAll: false } });
      setDefaultOn(res.swear_default);
      toast.success(next ? "New items spawn with swear chat ON" : "New items spawn CIVIL");
    } catch (e: any) {
      setDefaultOn(prev);
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const isOn = defaultOn === true;

  return (
    <div
      className="rounded-3xl border p-4 md:p-5 glass-obsidian"
      style={{ borderColor: isOn ? "rgba(255,46,85,0.45)" : "rgba(0,242,255,0.35)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1"
          style={{
            background: isOn ? "rgba(255,46,85,0.12)" : "rgba(0,242,255,0.10)",
            borderColor: isOn ? "rgba(255,46,85,0.5)" : "rgba(0,242,255,0.4)",
          }}
        >
          {isOn ? (
            <Skull className="h-4 w-4" style={{ color: "#ff2e55" }} />
          ) : (
            <ShieldCheck className="h-4 w-4" style={{ color: "#00F2FF" }} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] mood-accent terminal-mono">
            Civility Default
          </div>
          <div className="syndicate-header text-sm md:text-base text-white/95">
            New portals / battles / hubs spawn{" "}
            {defaultOn === null ? "…" : isOn ? "GUTTERMOUTH" : "CIVIL"}
          </div>
          <p className="text-[11px] text-white/55 mt-0.5">
            Single source of truth for the swear-chat default. Per-item overrides
            still live in the deep Civility console.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || defaultOn === null}
          onClick={() => flip(!isOn)}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition disabled:opacity-60"
          style={{
            borderColor: isOn ? "rgba(255,46,85,0.6)" : "rgba(0,242,255,0.5)",
            background: isOn ? "rgba(255,46,85,0.12)" : "rgba(0,242,255,0.08)",
            color: isOn ? "#ff8aa1" : "#9ff0ff",
          }}
          aria-pressed={isOn}
          title="Flip the default swear-chat state for newly created items"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isOn ? (
            <ShieldAlert className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {isOn ? "Guttermouth · ON" : "Civil · ON"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/55">
        <Link
          to="/boss/civility"
          className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-white/85"
        >
          <Link2 className="h-3 w-3" /> Per-item overrides
        </Link>
        <Link
          to="/boss/lexicon"
          className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-white/85"
        >
          <Link2 className="h-3 w-3" /> Edit swear lexicon
        </Link>
        <Link
          to="/boss/power"
          className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-white/85"
        >
          <Link2 className="h-3 w-3" /> Power bar mirror
        </Link>
      </div>
    </div>
  );
}

export default GlobalMoodPanel;

function FriendsFamilyBadgeRow() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const saveToggle = useServerFn(updateGlobalMoodToggle);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("hub_settings")
        .select("enabled")
        .eq("hub_key", "ff-badge")
        .maybeSingle();
      if (!alive) return;
      if (error) {
        toast.error(error.message);
        return;
      }
      setEnabled(!!data?.enabled);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const flip = async (next: boolean) => {
    setBusy(true);
    const prev = enabled;
    setEnabled(next);
    try {
      const res = await saveToggle({ data: { hubKey: "ff-badge", enabled: next } });
      setEnabled(res.enabled);
      toast.success(res.enabled ? "Friends & Family badge ON site-wide" : "Friends & Family badge HIDDEN site-wide");
    } catch (e: any) {
      setEnabled(prev);
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const isOn = enabled === true;

  return (
    <div
      className="rounded-3xl border p-4 md:p-5 glass-obsidian"
      style={{ borderColor: isOn ? "rgba(255,85,119,0.5)" : "rgba(255,255,255,0.15)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1"
          style={{
            background: isOn ? "rgba(255,85,119,0.14)" : "rgba(255,255,255,0.06)",
            borderColor: isOn ? "rgba(255,85,119,0.5)" : "rgba(255,255,255,0.2)",
          }}
        >
          {isOn ? (
            <Heart className="h-4 w-4" style={{ color: "#ffb3c4" }} />
          ) : (
            <EyeOff className="h-4 w-4 text-white/55" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] mood-accent terminal-mono">
            Friends &amp; Family Badge
          </div>
          <div className="syndicate-header text-sm md:text-base text-white/95">
            F&amp;F badge is{" "}
            {enabled === null ? "…" : isOn ? "VISIBLE site-wide" : "HIDDEN site-wide"}
          </div>
          <p className="text-[11px] text-white/55 mt-0.5">
            Master switch for the pink F&amp;F chip on every OG Pass card.
            Per-user F&amp;F status is unchanged — only the badge is hidden.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || enabled === null}
          onClick={() => flip(!isOn)}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition disabled:opacity-60"
          style={{
            borderColor: isOn ? "rgba(255,85,119,0.6)" : "rgba(255,255,255,0.25)",
            background: isOn ? "rgba(255,85,119,0.14)" : "rgba(255,255,255,0.04)",
            color: isOn ? "#ffb3c4" : "rgba(255,255,255,0.6)",
          }}
          aria-pressed={isOn}
          title="Show or hide the Friends & Family badge across the whole site"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isOn ? (
            <Heart className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          {isOn ? "Badge · ON" : "Badge · OFF"}
        </button>
      </div>
    </div>
  );
}