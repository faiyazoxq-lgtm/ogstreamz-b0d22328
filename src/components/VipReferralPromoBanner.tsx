import { Link, useRouterState } from "@tanstack/react-router";
import { Crown, Gift, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Top-of-page promo banner shown ONLY to VIP / Real OG members.
 * Counterpart to <VipPromoBanner /> (which targets non-VIPs). Promotes
 * the VIP referral scheme — share your code, both sides earn coins.
 * Dismissible per session and hidden on transactional / form-heavy
 * routes so it never gets in the way.
 */
export function VipReferralPromoBanner() {
  const { user, profile, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem("vip_referral_promo_dismissed") === "1");
    } catch { /* noop */ }
  }, []);

  const isVip =
    isAdmin ||
    profile?.status === "vip" ||
    profile?.rank === "vip" ||
    profile?.rank === "boss" ||
    profile?.feature_flags?.real_og === true;

  // VIP-only banner. Hidden on auth, the dashboard pages where the
  // referral card already renders, checkout, and form flows.
  const HIDDEN_PREFIXES = [
    "/auth", "/vault-login", "/vip", "/dashboard", "/checkout",
    "/forgot-password", "/reset-password",
  ];
  if (!user || !isVip || dismissed) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const dismiss = () => {
    try { sessionStorage.setItem("vip_referral_promo_dismissed", "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="VIP referral promotion"
      className="relative isolate overflow-hidden border-b border-amber-300/40 bg-gradient-to-r from-[#0a0700] via-[#150e02] to-[#0a0700] supports-[backdrop-filter]:backdrop-blur-md"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-12 left-1/4 h-44 w-44 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(252,211,77,0.55),transparent)] motion-safe:animate-pulse" />
        <div className="absolute -bottom-12 right-1/4 h-44 w-44 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(245,158,11,0.4),transparent)]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-3 sm:px-5 py-2 sm:py-2.5 flex items-center gap-2.5 sm:gap-3">
        <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/60 bg-amber-300/10 shadow-[0_0_22px_-2px_rgba(252,211,77,0.7)]">
          <Gift className="h-4 w-4 text-amber-100" />
          <Crown className="absolute -top-2 -right-1 h-3 w-3 text-amber-200 animate-pulse" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.28em] text-amber-100 truncate flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[9px] tracking-[0.3em]">
              <Crown className="h-3 w-3" /> Real OG
            </span>
            Refer a friend — you both earn 2 🪙
          </p>
          <p className="hidden sm:block text-[11px] text-amber-200/70 truncate">
            Share your VIP code. Every signup tops up both wallets, instantly.
          </p>
        </div>

        <Link
          to="/vip"
          hash="referral"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-amber-300/60 bg-gradient-to-r from-amber-400/25 via-amber-300/15 to-amber-400/25 hover:from-amber-400/35 hover:to-amber-400/35 px-3 py-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-amber-50 shadow-[0_0_24px_-4px_rgba(252,211,77,0.85)] transition-all active:scale-[0.98]"
        >
          <Gift className="h-3.5 w-3.5" />
          Get my code
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss VIP referral promotion"
          className="shrink-0 rounded-md p-1 text-amber-200/60 hover:text-amber-100 hover:bg-white/5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}