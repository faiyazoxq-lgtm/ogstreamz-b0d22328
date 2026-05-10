import { Link } from "@tanstack/react-router";
import { Lock, Tv, Crown, ShieldAlert } from "lucide-react";
import { useAccess, TIER_LABEL, type AccessTier } from "@/lib/access";
import type { ReactNode } from "react";

type Props = {
  /** Minimum tier needed to render children. */
  min: AccessTier;
  /** What this gate protects (used in the upgrade message). */
  feature?: string;
  /** Optional custom fallback. Overrides the default upgrade card. */
  fallback?: ReactNode;
  children: ReactNode;
};

/**
 * Front-end role gate. Renders `children` only when the current user meets
 * the required access tier; otherwise shows a tier-appropriate upgrade card.
 *
 * NOTE: this is presentation only — always pair with a server-side guard
 * (assertUsageAccess / assertVipAccess / RLS) for any privileged action.
 */
export function RoleGate({ min, feature = "this feature", fallback, children }: Props) {
  const a = useAccess();
  if (a.atLeast(min)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return <UpgradeCard tier={a.tier} need={min} feature={feature} banned={a.banned} signedIn={a.signedIn} />;
}

function UpgradeCard({
  tier, need, feature, banned, signedIn,
}: {
  tier: AccessTier; need: AccessTier; feature: string; banned: boolean; signedIn: boolean;
}) {
  if (banned) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
        <ShieldAlert className="h-7 w-7 mx-auto text-destructive" />
        <h3 className="mt-3 text-lg font-black text-destructive">Account suspended</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account has been banned. Contact Boss if you believe this is a mistake.
        </p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Lock className="h-7 w-7 mx-auto text-muted-foreground" />
        <h3 className="mt-3 text-lg font-black">Members only</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign up free to unlock {feature}.
        </p>
        <Link to="/auth" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
          Sign in / Sign up
        </Link>
      </div>
    );
  }

  if (need === "stream") {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
        <Tv className="h-7 w-7 mx-auto text-amber-400" />
        <h3 className="mt-3 text-lg font-black">OGSTREAMZ approval required</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You're a <strong className="text-foreground">{TIER_LABEL[tier]}</strong> — link your stream account so Boss can promote you to OGSTREAMZ User and unlock {feature}.
        </p>
        <Link to="/profile" className="mt-4 inline-block rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:opacity-90">
          Link stream account
        </Link>
      </div>
    );
  }

  if (need === "vip" || need === "boss") {
    return (
      <div className="rounded-2xl border border-gold/40 bg-gold/5 p-6 text-center">
        <Crown className="h-7 w-7 mx-auto text-gold" />
        <h3 className="mt-3 text-lg font-black text-metallic">VIP / Real OG required</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You're a <strong className="text-foreground">{TIER_LABEL[tier]}</strong>. Upgrade to VIP / Real OG to unlock {feature}.
        </p>
        <Link to="/store" className="mt-4 inline-block rounded-md bg-gold px-4 py-2 text-sm font-bold text-black hover:opacity-90">
          Upgrade in store
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <Lock className="h-7 w-7 mx-auto text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{TIER_LABEL[need]} access required for {feature}.</p>
    </div>
  );
}
