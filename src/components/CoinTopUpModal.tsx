import { useState } from "react";
import { Coins, Zap, Flame, Check, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { CREDIT_PACK_LIST, type CreditPack } from "@/lib/credit-packs";

/** Coin-only top-up packs (excludes the recurring VIP/Boss subscription). */
const COIN_PACKS: CreditPack[] = CREDIT_PACK_LIST.filter(
  (p) => !p.recurring && (p.credits ?? 0) > 0,
);

function packIcon(priceId: string) {
  if (priceId === "starter_pack_10") return Zap;
  if (priceId === "enforcer_pack_50") return Flame;
  return Coins;
}

export function CoinTopUpModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { openCheckout, closeCheckout, isOpen: checkoutOpen, checkoutElement } = useStripeCheckout();
  const [selected, setSelected] = useState<string | null>("enforcer_pack_50");
  const [launching, setLaunching] = useState(false);

  const startCheckout = () => {
    const pack = COIN_PACKS.find((p) => p.priceId === selected);
    if (!pack || !user) return;
    setLaunching(true);
    openCheckout({
      priceId: pack.priceId,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
    // Close the picker so the embedded checkout modal can take over
    onOpenChange(false);
    setTimeout(() => setLaunching(false), 600);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg border-gold/40 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-[Montserrat] text-xl">
              <Coins className="h-5 w-5 text-gold" /> Top up coins
            </DialogTitle>
            <DialogDescription>
              Pick a coin pack — payment is processed securely on the next step. 1 🪙 = £1.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 grid gap-2.5">
            {COIN_PACKS.map((p) => {
              const Icon = packIcon(p.priceId);
              const active = selected === p.priceId;
              const coins = p.credits ?? Math.round(p.amountCents / 100);
              const perCoin = (p.amountCents / 100 / coins).toFixed(2);
              return (
                <button
                  key={p.priceId}
                  type="button"
                  onClick={() => setSelected(p.priceId)}
                  className={[
                    "relative w-full text-left flex items-center gap-3 rounded-xl border p-4 transition-all",
                    active
                      ? "border-gold/70 bg-gold/10 ring-2 ring-gold/40 shadow-[0_0_30px_-12px_oklch(0.82_0.16_88_/_0.6)]"
                      : "border-border bg-background/40 hover:border-gold/40 hover:bg-gold/5",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  <div className={`shrink-0 rounded-full p-2.5 border ${active ? "border-gold/60 bg-gold/15" : "border-border bg-card"}`}>
                    <Icon className="h-5 w-5 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-foreground">{p.name}</p>
                      <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        £{perCoin}/🪙
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{coins} 🪙 added to your wallet</p>
                  </div>
                  <div className="text-right">
                    <p className="font-[Montserrat] font-black text-lg text-foreground">
                      £{(p.amountCents / 100).toFixed(2)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-gold">{coins} 🪙</p>
                  </div>
                  {active && (
                    <Check className="absolute right-3 top-3 h-4 w-4 text-gold" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          {!user && (
            <p className="mt-2 text-xs text-destructive">Sign in to buy coins.</p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={startCheckout}
              disabled={!user || !selected || launching}
              className="flex-1 font-bold"
            >
              {launching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Coins className="h-4 w-4 mr-1" />}
              Continue to checkout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stripe embedded checkout overlay */}
      <Dialog open={checkoutOpen} onOpenChange={(v) => { if (!v) closeCheckout(); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-gold/40 bg-background">
          <DialogHeader className="px-5 pt-5 pb-2 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-gold" /> Coin checkout
            </DialogTitle>
            <button
              onClick={closeCheckout}
              className="rounded-md p-1 hover:bg-secondary"
              aria-label="Close checkout"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
          <div className="px-2 pb-4 max-h-[80vh] overflow-y-auto">
            {checkoutElement}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}