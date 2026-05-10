import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Sparkles, Check, ShieldCheck, Infinity as InfinityIcon, Zap, Flame } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { RealOgCheckout } from "@/components/RealOgCheckout";

/**
 * Home-page promo card for the £20 one-off Real OG Pass.
 * - Guests see a "sign up to claim" CTA pointing at /auth.
 * - Members see "Become a Real OG" → opens an embedded Stripe checkout.
 * - Existing Real OGs (or Boss) see a celebratory card instead of the upsell.
 */
export function RealOgPromoCard() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);

  const isRealOg =
    profile?.feature_flags?.real_og === true ||
    profile?.rank === "boss" ||
    profile?.rank === "vip";

  return (
    <section className="relative max-w-5xl mx-auto px-5 sm:px-8 -mt-2 pb-12">
      {/* Outer blue-fire halo */}
      <div className="pointer-events-none absolute -inset-3 rounded-[2rem] blur-2xl opacity-80 bg-[conic-gradient(from_180deg_at_50%_50%,#0066ff_0deg,#00d4ff_60deg,#001a4d_140deg,#ff1a1a_200deg,#00aaff_280deg,#0066ff_360deg)] animate-pulse" />
      <div className="relative overflow-hidden rounded-3xl border-2 border-cyan-300/70 bg-gradient-to-br from-[#001233] via-[#000814] to-[#02000a] p-6 sm:p-8 shadow-[0_0_60px_-5px_rgba(0,180,255,0.7),0_30px_120px_-20px_rgba(255,30,30,0.35),inset_0_0_40px_rgba(0,120,255,0.15)]">
        {/* Blue fire aura blobs */}
        <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(0,200,255,0.7),transparent)]" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(20,80,255,0.55),transparent)]" />
        {/* Red highlight ember */}
        <div className="pointer-events-none absolute top-1/2 -right-20 h-56 w-56 -translate-y-1/2 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,30,30,0.45),transparent)]" />
        {/* Sharp diagonal scan-lines */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.10] bg-[repeating-linear-gradient(45deg,#3ad6ff_0_2px,transparent_2px_14px)]" />
        {/* Inner electric border */}
        <div className="pointer-events-none absolute inset-1 rounded-[1.4rem] border border-cyan-400/30" />

        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/70 bg-cyan-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.4em] font-bold text-cyan-100 shadow-[0_0_20px_rgba(0,180,255,0.45)]">
              <Flame className="h-3.5 w-3.5 text-red-400" />
              {isRealOg ? "You are a Real OG" : "Membership · One-off"}
            </div>

            <h2 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-4xl md:text-5xl tracking-tight text-white [text-shadow:_0_0_24px_rgba(0,200,255,0.85),_0_0_48px_rgba(0,120,255,0.55),_0_2px_0_rgba(255,30,30,0.55)]">
              {isRealOg ? "Real 0G — Top Shelf." : "Become a Real 0G."}
            </h2>

            <p className="mt-3 text-sm sm:text-base text-cyan-100/85 max-w-xl">
              {isRealOg
                ? "Lifetime status secured. Every portal opens for you. Wear the crown."
                : "One payment. Forever Real OG. Top-shelf access across every portal — no subs, no resets, no gimmicks."}
            </p>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2 text-[13px] text-cyan-50/95">
              <li className="flex items-center gap-2 rounded-md border border-cyan-400/30 bg-[#001a3d]/70 px-3 py-2 shadow-[inset_0_0_12px_rgba(0,160,255,0.15)]">
                <InfinityIcon className="h-4 w-4 text-cyan-300" /> Lifetime status — no renewal
              </li>
              <li className="flex items-center gap-2 rounded-md border border-red-500/40 bg-[#001a3d]/70 px-3 py-2 shadow-[inset_0_0_12px_rgba(255,40,40,0.15)]">
                <Crown className="h-4 w-4 text-red-400" /> "REAL 0G" badge on your profile
              </li>
              <li className="flex items-center gap-2 rounded-md border border-cyan-400/30 bg-[#001a3d]/70 px-3 py-2 shadow-[inset_0_0_12px_rgba(0,160,255,0.15)]">
                <Zap className="h-4 w-4 text-cyan-300" /> Unlimited tools & VIP scans
              </li>
              <li className="flex items-center gap-2 rounded-md border border-red-500/40 bg-[#001a3d]/70 px-3 py-2 shadow-[inset_0_0_12px_rgba(255,40,40,0.15)]">
                <ShieldCheck className="h-4 w-4 text-red-400" /> Priority access to all drops
              </li>
            </ul>
          </div>

          {/* Price + CTA */}
          <div className="relative flex flex-col items-center gap-3 rounded-2xl border-2 border-cyan-300/60 bg-gradient-to-b from-[#000814] to-[#001233] p-5 sm:p-6 min-w-[220px] shadow-[0_0_30px_-5px_rgba(0,180,255,0.7),inset_0_0_20px_rgba(255,30,30,0.12)]">
            <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-cyan-200">One-off</div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl sm:text-6xl font-black text-white [text-shadow:_0_0_18px_rgba(0,200,255,0.95),_0_0_36px_rgba(0,100,255,0.7),_0_2px_0_rgba(255,30,30,0.6)]">£20</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-red-300/90">Lifetime · No renewal</div>

            {isRealOg ? (
              <Link
                to="/dashboard"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-400/10 px-5 py-2.5 text-[12px] uppercase tracking-[0.25em] font-bold text-cyan-100 hover:bg-cyan-400/20"
              >
                <Check className="h-4 w-4" />
                Active
              </Link>
            ) : user ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00d4ff] via-[#0080ff] to-[#ff2a2a] px-5 py-3 text-[12px] uppercase tracking-[0.25em] font-black text-white shadow-[0_0_30px_rgba(0,180,255,0.85),0_10px_40px_-10px_rgba(255,30,30,0.7)] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
              >
                <Flame className="h-4 w-4" />
                Claim my pass
              </button>
            ) : (
              <Link
                to="/auth"
                search={{ mode: "signup" } as never}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00d4ff] via-[#0080ff] to-[#ff2a2a] px-5 py-3 text-[12px] uppercase tracking-[0.25em] font-black text-white shadow-[0_0_30px_rgba(0,180,255,0.85),0_10px_40px_-10px_rgba(255,30,30,0.7)] hover:brightness-110 active:scale-[0.98]"
              >
                <Crown className="h-4 w-4" />
                Sign up to claim
              </Link>
            )}

            <p className="text-[10px] text-cyan-200/70 text-center leading-relaxed max-w-[200px]">
              Secure checkout. Pass auto-issued. Receipt to your inbox.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded Stripe checkout dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-[#000814] border-cyan-300/50">
          <DialogHeader>
            <DialogTitle className="text-white font-[Montserrat] font-black text-2xl tracking-tight [text-shadow:_0_0_18px_rgba(0,200,255,0.7)]">
              <Crown className="inline h-5 w-5 mr-2 text-red-400" />
              Claim your Real OG Pass
            </DialogTitle>
            <DialogDescription className="text-cyan-200/80">
              £20 · One-off · Lifetime Real OG status. Auto-issued the moment payment clears.
            </DialogDescription>
          </DialogHeader>
          {open && user && (
            <RealOgCheckout
              customerEmail={user.email ?? undefined}
              returnUrl={`${window.location.origin}/?real_og=success&session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}