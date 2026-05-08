import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Coins, Zap, Flame, Skull, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { CREDIT_PACK_LIST } from "@/lib/credit-packs";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { toast } from "sonner";

type Search = { reason?: "empty" | "topup" };

export const Route = createFileRoute("/store")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    reason: s.reason === "empty" || s.reason === "topup" ? (s.reason as "empty" | "topup") : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Syndicate Store · 0G-PORTAL" },
      { name: "description", content: "Top up your 0G Credits and unlock the full Syndicate." },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { reason } = Route.useSearch();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (reason === "empty") {
      toast.error("0 credits left — top up to keep firing.", { duration: 5000 });
    }
  }, [reason]);

  if (loading || !user) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Loading store…</main>;
  }

  const credits = profile?.credits ?? 0;
  const isVip = profile?.status === "vip";
  const pct = Math.max(2, Math.min(100, (credits / 100) * 100));

  const buy = (priceId: string) => {
    openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <main className="relative max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <Link
        to="/profile"
        className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Vault
      </Link>

      <header className="text-center mt-6 mb-10">
        <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          Syndicate Store
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-6xl text-metallic">
          Top Up the Vault
        </h1>
        <p className="mt-3 text-muted-foreground">Credits power Live Wire jokes, VIP tools, AI lyrics, and custom tracks.</p>
      </header>

      <section className="rounded-2xl electric-border bg-card p-6 sm:p-8 mb-10 tv-screen">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Coins className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Current Balance</p>
              <p className="font-[Montserrat] font-black text-3xl sm:text-4xl text-metallic mt-1 tabular-nums">{credits}</p>
            </div>
          </div>
          {isVip && (
            <span className="text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full bg-[var(--neon-blue-bright)] text-black">
              VIP ACTIVE
            </span>
          )}
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-secondary/60 overflow-hidden border border-[oklch(0.72_0.22_245/0.3)]">
          <div
            className="h-full bg-gradient-to-r from-[oklch(0.55_0.24_255)] via-[var(--neon-blue-bright)] to-[oklch(0.85_0.18_235)] shadow-[0_0_18px_oklch(0.72_0.22_245/0.9)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <div className="grid sm:grid-cols-3 gap-5">
        {CREDIT_PACK_LIST.map((p) => {
          const Icon = p.priceId === "starter_pack_10" ? Zap : p.priceId === "enforcer_pack_50" ? Flame : Skull;
          const featured = p.recurring;
          return (
            <div
              key={p.priceId}
              className={
                "relative rounded-2xl p-6 bg-card tv-screen " +
                (featured ? "electric-border" : "border border-border")
              }
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full bg-[var(--neon-blue-bright)] text-black">
                  BOSS
                </span>
              )}
              <Icon className="h-6 w-6" style={{ color: "var(--neon-blue-bright)" }} />
              <h3 className="mt-4 font-[Montserrat] font-black text-xl text-white">{p.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
              <p className="mt-4 font-[Montserrat] font-black text-3xl text-metallic">
                ${(p.amountCents / 100).toFixed(2)}
                {p.recurring && <span className="text-sm text-muted-foreground font-normal">/mo</span>}
              </p>
              <Button
                onClick={() => buy(p.priceId)}
                className="btn-glass-blue mt-5 w-full text-white text-xs uppercase tracking-[0.25em] font-bold py-5"
              >
                {p.recurring ? "Go Boss" : "Top Up"}
              </Button>
            </div>
          );
        })}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-8">
            <button
              onClick={closeCheckout}
              className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white mb-4"
            >
              ← Back to Store
            </button>
            {checkoutElement}
          </div>
        </div>
      )}
    </main>
  );
}