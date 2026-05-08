import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Crown, Coins, LogOut, Shield, Sparkles, Zap, Flame, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import bgFlame from "@/assets/bg-flame.png";
import { CREDIT_PACK_LIST } from "@/lib/credit-packs";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Vault · 0G-PORTAL" },
      { name: "description", content: "Your 0G-PORTAL membership vault." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Loading vault…</main>;
  }

  const isVip = profile?.status === "vip";
  const isBoss = profile?.rank === "boss";
  const credits = profile?.credits ?? 0;
  // Cap visual scale: full bar at 100 credits.
  const creditPct = Math.max(2, Math.min(100, (credits / 100) * 100));

  const buy = (priceId: string) => {
    if (!user) return;
    openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <main className="relative min-h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img src={bgFlame} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
      </div>

      <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <header className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
            Member Vault
          </p>
          <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-5xl text-metallic">
            Welcome back
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">{isBoss ? "— BOSS ACCOUNT —" : (profile?.email ?? user.email)}</p>
        </header>

        <section className="grid sm:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8 animate-pulse-gold">
            <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em]">
              {isVip ? <Crown className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              Access Level
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-[Montserrat] font-black text-4xl sm:text-5xl text-metallic">
                {isBoss ? "BOSS" : isVip ? "VIP" : "Free"}
              </span>
              {isVip && <Sparkles className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {isBoss ? "Sovereign access. All systems unlocked." : isVip ? "All vaults unlocked. Premium frequencies active." : "Unlock VIP for premium tracks and tools."}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em]">
              <Coins className="h-4 w-4" />
              Credit Balance
            </div>
            <div className="mt-4">
              <span className="digital-display inline-block px-5 py-3 text-4xl sm:text-5xl">
                {isBoss ? "∞" : credits}
              </span>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-secondary/60 overflow-hidden border border-[oklch(0.72_0.22_245/0.3)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[oklch(0.55_0.24_255)] via-[var(--neon-blue-bright)] to-[oklch(0.85_0.18_235)] shadow-[0_0_18px_oklch(0.72_0.22_245/0.9)] transition-all"
                style={{ width: `${isBoss ? 100 : creditPct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{isBoss ? "Unlimited reserve. No caps." : "Spend credits to unlock single VIP items."}</p>
          </div>
        </section>

        {/* Buy Credits */}
        <section className="mt-12">
          <header className="text-center mb-6">
            <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
              Vault Wallet
            </p>
            <h2 className="mt-3 font-[Montserrat] font-black text-2xl sm:text-3xl text-metallic">
              Buy 0G Credits
            </h2>
          </header>
          <div className="grid sm:grid-cols-3 gap-4">
            {CREDIT_PACK_LIST.map((p) => {
              const Icon = p.priceId === "starter_pack_10" ? Zap : p.priceId === "enforcer_pack_50" ? Flame : Skull;
              const featured = p.recurring;
              return (
                <div
                  key={p.priceId}
                  className={
                    "relative rounded-2xl p-6 bg-card border " +
                    (featured
                      ? "border-[oklch(0.72_0.22_245/0.7)] shadow-[0_0_40px_-10px_oklch(0.72_0.22_245/0.8)]"
                      : "border-border")
                  }
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full bg-[var(--neon-blue-bright)] text-black">
                      VIP
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
        </section>

        <section className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAdmin && (
            <Link
              to="/admin"
              className="btn-glass-blue inline-flex items-center gap-2 px-6 py-3 rounded-md text-xs uppercase tracking-[0.25em] font-bold text-white"
            >
              <Shield className="h-4 w-4" />
              Admin Console
            </Link>
          )}
          <Button onClick={signOut} variant="outline" className="h-11 px-6 uppercase tracking-[0.25em] text-xs font-bold">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </section>

        {isOpen && (
          <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-8">
              <button
                onClick={closeCheckout}
                className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white mb-4"
              >
                ← Back to Vault
              </button>
              {checkoutElement}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}