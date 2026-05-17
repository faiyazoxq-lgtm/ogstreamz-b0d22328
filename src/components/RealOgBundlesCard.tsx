import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Coins, Flame, Sparkles, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { REAL_OG_BUNDLES, bundleSavingsCents, type RealOgBundle } from "@/lib/real-og-bundles";
import { RealOgBundleCheckout } from "@/components/RealOgBundleCheckout";

/**
 * VIP Bundles — Real OG Pass + a Coin pack at a single discounted price.
 * Hidden for users who already have Real OG (they don't need the pass again).
 */
export function RealOgBundlesCard() {
  const { user, profile } = useAuth();
  const [openSku, setOpenSku] = useState<string | null>(null);

  const isRealOg = isVipProfile(profile);

  if (isRealOg) return null;

  return (
    <section className="relative max-w-5xl mx-auto px-5 sm:px-8 pb-8">
      <div className="relative overflow-hidden rounded-3xl border-2 border-yellow-400/60 bg-gradient-to-br from-[#1a1100] via-[#000814] to-[#02000a] p-6 sm:p-8 shadow-[0_0_60px_-10px_rgba(255,200,0,0.5),0_30px_80px_-20px_rgba(0,180,255,0.3)]">
        {/* gold + blue aura */}
        <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,200,0,0.45),transparent)]" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(0,180,255,0.4),transparent)]" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-300/60 bg-yellow-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.4em] font-bold text-yellow-100 shadow-[0_0_18px_rgba(255,200,0,0.35)]">
              <Sparkles className="h-3.5 w-3.5 text-yellow-300" /> VIP Bundles · Best Value
            </span>
          </div>
          <h2 className="mt-3 font-[Montserrat] font-black text-2xl sm:text-4xl tracking-tight text-white [text-shadow:_0_0_18px_rgba(255,200,0,0.55)]">
            Real 0G + Coins — Bundle & Save
          </h2>
          <p className="mt-2 text-sm text-yellow-50/80 max-w-2xl">
            Lock in Lifetime Real OG status <strong className="text-white">and</strong> a Coin stack in a single payment.
            Cheaper than buying them separately.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {REAL_OG_BUNDLES.map((b, idx) => (
              <BundleTile
                key={b.sku}
                bundle={b}
                featured={idx === REAL_OG_BUNDLES.length - 1}
                onClaim={() => setOpenSku(b.sku)}
                signedIn={!!user}
              />
            ))}
          </div>

          <p className="mt-4 text-[11px] text-yellow-200/60">
            Bundles auto-issue your Real OG Pass and Coins the moment payment clears. One-off — no subscription.
          </p>
        </div>
      </div>

      <Dialog open={!!openSku} onOpenChange={(o) => !o && setOpenSku(null)}>
        <DialogContent className="max-w-2xl bg-[#000814] border-yellow-300/40">
          <DialogHeader>
            <DialogTitle className="text-white font-[Montserrat] font-black text-2xl tracking-tight">
              <Crown className="inline h-5 w-5 mr-2 text-yellow-300" />
              Claim your VIP Bundle
            </DialogTitle>
            <DialogDescription className="text-yellow-100/80">
              One payment · Lifetime Real OG Pass + Coins · Auto-issued.
            </DialogDescription>
          </DialogHeader>
          {openSku && user && (
            <RealOgBundleCheckout
              sku={openSku}
              customerEmail={user.email ?? undefined}
              returnUrl={`${window.location.origin}/?real_og_bundle=success&session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function BundleTile({
  bundle,
  featured,
  onClaim,
  signedIn,
}: {
  bundle: RealOgBundle;
  featured: boolean;
  onClaim: () => void;
  signedIn: boolean;
}) {
  const savings = bundleSavingsCents(bundle);
  const total = bundle.amountCents / 100;
  const ogPrice = bundle.ogStandaloneCents / 100;
  const packPrice = bundle.packStandaloneCents / 100;

  return (
    <div
      className={`relative rounded-2xl border-2 p-5 ${
        featured
          ? "border-yellow-300/70 bg-gradient-to-b from-[#1a1200] to-[#000814] shadow-[0_0_30px_-5px_rgba(255,200,0,0.55)]"
          : "border-cyan-400/40 bg-gradient-to-b from-[#001233] to-[#000814]"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-black shadow-[0_0_18px_rgba(255,200,0,0.7)]">
          <Flame className="h-3 w-3" /> Best Deal
        </span>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-yellow-200/90">{bundle.name}</p>
          <p className="mt-1 text-sm font-bold text-white">{bundle.tagline}</p>
        </div>
        <Coins className={`h-7 w-7 ${featured ? "text-yellow-300" : "text-cyan-300"}`} />
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-[Montserrat] font-black text-4xl text-white [text-shadow:_0_0_14px_rgba(255,200,0,0.55)]">
          £{total.toFixed(0)} <span className="text-xl text-yellow-200">({total.toFixed(0)} 🪙)</span>
        </span>
        <span className="text-xs text-white/50 line-through">£{(ogPrice + packPrice).toFixed(0)}</span>
      </div>

      <p className="mt-1 text-[11px] text-yellow-100/80">
        £{ogPrice.toFixed(0)} OG Pass + £{packPrice.toFixed(0)} Coins
        {savings > 0 && (
          <>
            {" · "}
            <span className="font-black text-yellow-300">save £{(savings / 100).toFixed(0)}</span>
          </>
        )}
      </p>

      <ul className="mt-4 space-y-1.5 text-[12px] text-cyan-50/90">
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-yellow-300" /> Lifetime Real OG status</li>
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-yellow-300" /> {bundle.credits} Coins 🪙 added to your wallet</li>
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-yellow-300" /> All portals + VIP tools unlocked</li>
      </ul>

      {signedIn ? (
        <button
          type="button"
          onClick={onClaim}
          className={`mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-[12px] uppercase tracking-[0.25em] font-black text-black hover:brightness-110 active:scale-[0.98] ${
            featured
              ? "bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-300 shadow-[0_0_30px_rgba(255,200,0,0.7)]"
              : "bg-gradient-to-r from-cyan-300 via-cyan-400 to-yellow-200 shadow-[0_0_22px_rgba(0,200,255,0.55)]"
          }`}
        >
          <Flame className="h-4 w-4" /> Grab bundle
        </button>
      ) : (
        <Link
          to="/auth"
          search={{ mode: "signup" } as never}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-300 px-4 py-3 text-[12px] uppercase tracking-[0.25em] font-black text-black shadow-[0_0_22px_rgba(255,200,0,0.55)]"
        >
          <Crown className="h-4 w-4" /> Sign up to claim
        </Link>
      )}
    </div>
  );
}