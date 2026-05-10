import { Link } from "@tanstack/react-router";
import { Crown, Lock, Sparkles } from "lucide-react";

/**
 * Inline VIP paywall used inside the Music/Jokes/Tool HUB action areas.
 * Replaces the spawn CTA for non-VIPs with a clear upgrade prompt.
 * Tone: respectful invitation — never patronising.
 */
export function VipPaywallInline({
  hub,
  isAuthenticated,
}: {
  hub: "music" | "jokes" | "tools";
  isAuthenticated: boolean;
}) {
  const label =
    hub === "music" ? "Spawn a Studio" : hub === "jokes" ? "Activate the Portal" : "Spawn a Tool";
  const flavour =
    hub === "music"
      ? "MusicHUB studios are a Real OG perk."
      : hub === "jokes"
      ? "JokesHUB portals are reserved for Real OGs."
      : "ToolHUB spawns are a Real OG perk.";

  return (
    <div className="mt-5 rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/10 via-background to-background p-5 sm:p-6 shadow-[0_0_60px_-10px_oklch(0.82_0.16_88_/_0.5)]">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="h-4 w-4 text-gold" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">VIP Pass Required</span>
      </div>
      <h3 className="font-[Montserrat] font-black text-xl sm:text-2xl text-metallic leading-tight">
        {label} as a <span className="text-gradient-gold">Real OG</span>.
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {flavour} Grab the VIP Pass to spawn unlimited, get street-OG respect across the platform,
        and unlock every HUB.
      </p>
      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-gold shrink-0" /> Unlimited HUB spawns (Music · Jokes · Tools)</li>
        <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-gold shrink-0" /> Live Roast, VIP-only tools & exclusive drops</li>
        <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-gold shrink-0" /> Boss-line comms — treated like an OG, never sworn at</li>
      </ul>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <Link
          to="/vip"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-gold text-primary-foreground hover:bg-gold/90 text-xs uppercase tracking-[0.25em] font-bold"
        >
          <Crown className="h-4 w-4" /> Get the VIP Pass
        </Link>
        {!isAuthenticated && (
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-gold/50 text-xs uppercase tracking-[0.25em] font-bold text-foreground hover:bg-gold/10"
          >
            Sign in first
          </Link>
        )}
      </div>
    </div>
  );
}