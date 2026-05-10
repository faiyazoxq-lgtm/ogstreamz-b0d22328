import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Sparkles, Check, ShieldCheck, Infinity as InfinityIcon, Zap } from "lucide-react";
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
      <div className="relative overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-br from-[#1a0f00] via-[#0a0a0a] to-[#0a0500] p-6 sm:p-8 shadow-[0_30px_120px_-30px_rgba(255,200,80,0.45)]">
        {/* Gold ambient glow */}
        <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,200,80,0.55),transparent)]" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,140,40,0.35),transparent)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[repeating-linear-gradient(45deg,#ffd166_0_2px,transparent_2px_14px)]" />

        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.4em] font-bold text-amber-200">
              <Crown className="h-3.5 w-3.5" />
              {isRealOg ? "You are a Real OG" : "Membership · One-off"}
            </div>

            <h2 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-4xl md:text-5xl tracking-tight text-amber-100 [text-shadow:_0_0_30px_rgba(255,200,80,0.35)]">
              {isRealOg ? "Real 0G — Top Shelf." : "Become a Real 0G."}
            </h2>

            <p className="mt-3 text-sm sm:text-base text-amber-100/80 max-w-xl">
              {isRealOg
                ? "Lifetime status secured. Every portal opens for you. Wear the crown."
                : "One payment. Forever Real OG. Top-shelf access across every portal — no subs, no resets, no gimmicks."}
            </p>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2 text-[13px] text-amber-50/90">
              <li className="flex items-center gap-2 rounded-md border border-amber-300/20 bg-black/40 px-3 py-2">
                <InfinityIcon className="h-4 w-4 text-amber-300" /> Lifetime status — no renewal
              </li>
              <li className="flex items-center gap-2 rounded-md border border-amber-300/20 bg-black/40 px-3 py-2">
                <Crown className="h-4 w-4 text-amber-300" /> "REAL 0G" badge on your profile
              </li>
              <li className="flex items-center gap-2 rounded-md border border-amber-300/20 bg-black/40 px-3 py-2">
                <Zap className="h-4 w-4 text-amber-300" /> Unlimited tools & VIP scans
              </li>
              <li className="flex items-center gap-2 rounded-md border border-amber-300/20 bg-black/40 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-amber-300" /> Priority access to all drops
              </li>
            </ul>
          </div>

          {/* Price + CTA */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-300/40 bg-black/60 p-5 sm:p-6 min-w-[220px]">
            <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-amber-200/80">One-off</div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl sm:text-6xl font-black text-amber-100 [text-shadow:_0_0_24px_rgba(255,200,80,0.5)]">£20</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-amber-200/70">Lifetime · No renewal</div>

            {isRealOg ? (
              <Link
                to="/dashboard"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/40 bg-amber-300/10 px-5 py-2.5 text-[12px] uppercase tracking-[0.25em] font-bold text-amber-100 hover:bg-amber-300/20"
              >
                <Check className="h-4 w-4" />
                Active
              </Link>
            ) : user ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 px-5 py-3 text-[12px] uppercase tracking-[0.25em] font-black text-black shadow-[0_10px_40px_-10px_rgba(255,200,80,0.8)] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80"
              >
                <Sparkles className="h-4 w-4" />
                Claim my pass
              </button>
            ) : (
              <Link
                to="/auth"
                search={{ mode: "signup" } as never}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 px-5 py-3 text-[12px] uppercase tracking-[0.25em] font-black text-black shadow-[0_10px_40px_-10px_rgba(255,200,80,0.8)] hover:brightness-110 active:scale-[0.98]"
              >
                <Crown className="h-4 w-4" />
                Sign up to claim
              </Link>
            )}

            <p className="text-[10px] text-amber-200/60 text-center leading-relaxed max-w-[200px]">
              Secure checkout. Pass auto-issued. Receipt to your inbox.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded Stripe checkout dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-[#0a0a0a] border-amber-300/40">
          <DialogHeader>
            <DialogTitle className="text-amber-100 font-[Montserrat] font-black text-2xl tracking-tight">
              <Crown className="inline h-5 w-5 mr-2 text-amber-300" />
              Claim your Real OG Pass
            </DialogTitle>
            <DialogDescription className="text-amber-200/70">
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