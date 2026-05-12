import { Link, useRouterState } from "@tanstack/react-router";
import { Crown, Lock, Flame, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Top-of-page banner promoting the VIP / Real OG pass to signed-in
 * members who aren't already VIP. Hidden from anonymous guests (no sales
 * pitch until they're inside) and from existing VIPs (never re-sell to
 * paid members). Dismissible per session. Hidden on /auth, /vault-login,
 * /vip and /checkout to avoid noise.
 */
export function VipPromoBanner() {
  const { user, profile, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dismissed, setDismissed] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem("vip_promo_dismissed") === "1");
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "vip_promo_banner_enabled")
        .maybeSingle();
      if (cancelled) return;
      if (data?.value === false || data?.value === "false") setEnabled(false);
      else setEnabled(true);
    })();
    const ch = supabase
      .channel("app_settings_vip_promo")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.vip_promo_banner_enabled" },
        (payload) => {
          const v = (payload.new as { value?: unknown } | null)?.value;
          setEnabled(!(v === false || v === "false"));
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  const isVip =
    isAdmin ||
    profile?.status === "vip" ||
    profile?.rank === "vip" ||
    profile?.rank === "boss" ||
    profile?.feature_flags?.real_og === true;

  const HIDDEN_PREFIXES = ["/auth", "/vault-login", "/vip", "/checkout", "/forgot-password", "/reset-password"];
  // Members-only promo: never show to guests or to existing VIPs.
  if (!enabled || !user || isVip || dismissed) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const dismiss = () => {
    try { sessionStorage.setItem("vip_promo_dismissed", "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="VIP Pass promotion"
      className="relative isolate overflow-hidden border-b border-cyan-400/40 bg-gradient-to-r from-[#02060f] via-[#040a1a] to-[#02060f] supports-[backdrop-filter]:backdrop-blur-md"
    >
      {/* Blue flame ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-12 left-1/4 h-44 w-44 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(56,189,248,0.55),transparent)] motion-safe:animate-pulse" />
        <div className="absolute -bottom-12 right-1/4 h-44 w-44 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(96,165,250,0.5),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.08),transparent)]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-3 sm:px-5 py-2 sm:py-2.5 flex items-center gap-2.5 sm:gap-3">
        <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_22px_-2px_rgba(56,189,248,0.7)]">
          <Crown className="h-4 w-4 text-cyan-100" />
          <Flame className="absolute -top-2 -right-1 h-3 w-3 text-cyan-300 animate-pulse" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.28em] text-cyan-100 truncate flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-[9px] tracking-[0.3em]">
              <Lock className="h-3 w-3" /> Members
            </span>
            Become a Real OG — lifetime VIP perks
          </p>
          <p className="hidden sm:block text-[11px] text-cyan-200/70 truncate">
            One-off pass. Vault keys, free unlocks, exclusive drops — forever.
          </p>
        </div>

        <Link
          to="/vip"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-cyan-300/60 bg-gradient-to-r from-cyan-400/25 via-cyan-300/15 to-cyan-400/25 hover:from-cyan-400/35 hover:to-cyan-400/35 px-3 py-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-cyan-50 shadow-[0_0_24px_-4px_rgba(56,189,248,0.85)] transition-all active:scale-[0.98]"
        >
          <Crown className="h-3.5 w-3.5" />
          Get VIP
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss VIP promotion"
          className="shrink-0 rounded-md p-1 text-cyan-200/60 hover:text-cyan-100 hover:bg-white/5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
