import { Link, useRouterState } from "@tanstack/react-router";
import { Crown, Lock, Flame, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Top-of-page banner promoting the VIP / Real OG pass to every visitor
 * and member who isn't already VIP. Dismissible per session.
 * Hidden on /auth, /vault-login, /vip and /checkout to avoid noise.
 */
export function VipPromoBanner() {
  const { profile, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem("vip_promo_dismissed") === "1");
    } catch { /* noop */ }
  }, []);

  const isVip =
    isAdmin ||
    profile?.status === "vip" ||
    profile?.rank === "vip" ||
    profile?.rank === "boss" ||
    profile?.feature_flags?.real_og === true;

  const HIDDEN_PREFIXES = ["/auth", "/vault-login", "/vip", "/checkout", "/forgot-password", "/reset-password"];
  if (isVip || dismissed) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const dismiss = () => {
    try { sessionStorage.setItem("vip_promo_dismissed", "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="VIP Pass promotion"
      className="relative isolate overflow-hidden border-b border-cyan-400/40 bg-gradient-to-r from-[#02060f] via-[#040a1a] to-[#02060f]"
    >
      {/* Blue flame ambient */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-10 left-0 h-40 w-40 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(56,189,248,0.55),transparent)]" />
        <div className="absolute -bottom-10 right-0 h-40 w-40 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(96,165,250,0.5),transparent)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(56,189,248,0.08)_0_2px,transparent_2px_10px)]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-3 sm:px-5 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3">
        <div className="relative flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-md border border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_20px_rgba(56,189,248,0.55)]">
          <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-200" />
          <Flame className="absolute -top-2 -right-1 h-3 w-3 text-cyan-300 animate-pulse" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] sm:tracking-[0.25em] text-cyan-100 truncate">
            <span className="hidden sm:inline">0G-VAULT Access · </span>
            Unlock the VIP Pass — Real 0G status + rotating vault keys
          </p>
          <p className="hidden sm:block text-[11px] text-cyan-200/70 truncate">
            One-tap login to the vault. All your apps in one place.
          </p>
        </div>

        <Link
          to="/vip"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-cyan-300/60 bg-cyan-400/15 hover:bg-cyan-400/25 px-3 py-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100 shadow-[0_0_24px_-4px_rgba(56,189,248,0.7)] transition-colors"
        >
          <Crown className="h-3.5 w-3.5" />
          Get VIP
        </Link>
        <Link
          to="/vault-login"
          className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 hover:border-cyan-300/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/80 hover:text-cyan-100"
        >
          Vault Login
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss VIP promotion"
          className="shrink-0 rounded-md p-1 text-cyan-200/60 hover:text-cyan-100 hover:bg-white/5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
