import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Lock, Bot, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SiteGuideSwearChat } from "@/components/SiteGuideSwearChat";

/**
 * Wraps any spawn / generate form. For non-VIP (and non-Boss) users:
 *   - the form children are visually shown but locked (pointer-events: none)
 *   - an OG-Bot chat panel + VIP upsell are overlaid on top so non-VIPs can
 *     still draft prompts via chat, but cannot actually submit.
 * VIPs and Boss see children unchanged.
 */
export function NonVipFormGate({
  children,
  label = "Generate",
}: {
  children: ReactNode;
  label?: string;
}) {
  const { user, profile, isAdmin } = useAuth();
  const isBoss = isAdmin;
  const isVip = isBoss || profile?.status === "vip";
  if (isVip) return <>{children}</>;

  return (
    <div className="space-y-4">
      {/* Locked original form (visible but inert) */}
      <div
        aria-hidden="true"
        tabIndex={-1}
        inert={"" as unknown as boolean}
        className="relative pointer-events-none select-none opacity-40 blur-[1px]"
      >
        {children}
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-background/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold shadow-[0_0_24px_-6px_var(--gold)]">
            <Lock className="h-3.5 w-3.5" /> VIP only — {label} disabled
          </span>
        </div>
      </div>

      {/* OG-Bot drafts the brief for non-VIPs */}
      <section className="rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-gradient-to-br from-background via-background to-[oklch(0.2_0.08_245/0.25)] p-3 sm:p-4 shadow-[0_0_60px_-20px_oklch(0.72_0.22_245/0.6)]">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Bot className="h-4 w-4" style={{ color: "var(--neon-blue-bright, #6cb6ff)" }} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/80">
            OG-Bot · Draft mode
          </span>
        </div>
        <p className="px-1 pb-2 text-xs text-muted-foreground">
          Chat with OG-Bot to shape your idea. To actually spawn, you'll need a Real OG VIP Pass.
        </p>
        <div className="overflow-hidden rounded-xl">
          <SiteGuideSwearChat />
        </div>
      </section>

      {/* VIP upsell */}
      <div className="rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/10 via-background to-background p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">
            Ready to spawn?
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Real OGs unlock unlimited spawns across every HUB, Live Roast, vault reveals & exclusive drops.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <Link
            to="/vip"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-gold text-primary-foreground hover:bg-gold/90 text-xs uppercase tracking-[0.25em] font-bold"
          >
            <Crown className="h-4 w-4" /> Get the VIP Pass
          </Link>
          {!user && (
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-gold/50 text-xs uppercase tracking-[0.25em] font-bold text-foreground hover:bg-gold/10"
            >
              Sign in first
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}