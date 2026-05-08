import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Crown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/vip")({
  component: VipPage,
  head: () => ({
    meta: [
      { title: "0G-Syndicate VIP — Unlock Every Track" },
      { name: "description", content: "One sub. Every portal, every full HQ download, VIP Telegram drops, unlimited trade scans." },
    ],
  }),
});

const PERKS = [
  "Full HQ MP3 downloads on every portal",
  "VIP-only Telegram broadcast channel",
  "Unlimited trade scans + Power-Pack execution",
  "First-access to every new portal we spawn",
  "Cancel any time — keep access until period end",
];

function VipPage() {
  const { user, profile, isAdmin } = useAuth();
  const isVip = isAdmin || profile?.status === "vip";
  const [plan, setPlan] = useState<"vip_monthly" | "vip_yearly">("vip_yearly");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const checkoutFn = useServerFn(createCheckoutSession);

  const start = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    setLoading(true);
    try {
      const cs = await checkoutFn({
        data: {
          priceId: plan,
          environment: getStripeEnvironment(),
          customerEmail: user.email,
          userId: user.id,
          returnUrl: `${window.location.origin}/dashboard?vip=success&session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      setClientSecret(cs);
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-500/40 text-yellow-300 text-[10px] uppercase tracking-[0.4em] mb-4">
            <Crown className="h-3 w-3" /> 0G-Syndicate VIP
          </div>
          <h1 className="text-4xl sm:text-6xl font-black leading-tight">Unlock Every Track. Forever.</h1>
          <p className="mt-3 opacity-70 max-w-xl mx-auto">
            One subscription. Every song from every portal. Full quality. No per-track checkouts.
          </p>
        </div>

        {isVip ? (
          <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-8 text-center">
            <Crown className="h-10 w-10 mx-auto mb-3 text-yellow-300" />
            <p className="text-lg font-bold">You're already VIP.</p>
            <p className="opacity-70 text-sm mt-1">Every portal is unlocked for your account.</p>
            <Link to="/dashboard"><Button className="mt-4">Go to dashboard</Button></Link>
          </div>
        ) : !clientSecret ? (
          <>
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {(["vip_monthly", "vip_yearly"] as const).map((p) => {
                const isYear = p === "vip_yearly";
                const active = plan === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className={`text-left rounded-2xl border-2 p-5 transition ${active ? "border-yellow-400 bg-yellow-500/10" : "border-white/10 hover:border-white/30"}`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.3em] opacity-70">{isYear ? "Annual · save 35%" : "Monthly"}</p>
                    <p className="mt-1 text-3xl font-black">${isYear ? "149" : "19"}<span className="text-sm opacity-60">/{isYear ? "yr" : "mo"}</span></p>
                    <p className="mt-1 text-xs opacity-70">{isYear ? "$12.42/mo billed yearly" : "Billed monthly"}</p>
                  </button>
                );
              })}
            </div>

            <ul className="space-y-2 mb-8">
              {PERKS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-yellow-300 mt-0.5 flex-shrink-0" /> {p}
                </li>
              ))}
            </ul>

            <Button
              onClick={start}
              disabled={loading}
              className="w-full h-14 text-sm uppercase tracking-[0.3em] font-black bg-yellow-400 text-black hover:bg-yellow-300"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</> : <><Crown className="h-4 w-4 mr-2" />Become VIP</>}
            </Button>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] opacity-50">Cancel anytime · Stripe-secured</p>
          </>
        ) : (
          <div className="rounded-2xl bg-white overflow-hidden">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  );
}