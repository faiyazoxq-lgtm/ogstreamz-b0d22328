import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import {
  Crown, Check, Loader2, Lock, Flame, Send, Youtube, Instagram, Music2,
  Star, Zap, Headphones, Download, Radio, ShieldCheck, Sparkles, KeyRound,
  Infinity as InfinityIcon, Trophy, MessageCircle, ArrowRight, Quote, PartyPopper, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { PlanChip, StatusBadge } from "@/components/SubscriptionBadges";
import { VaultGuard } from "@/components/VaultGuard";
import { VipReferralCard } from "@/components/VipReferralCard";
import { VipMembersDashboard } from "@/components/VipMembersDashboard";
import { requireMember } from "@/lib/route-guards";

export const Route = createFileRoute("/vip")({
  beforeLoad: requireMember,
  component: () => (
    <VaultGuard>
      <VipPage />
    </VaultGuard>
  ),
  validateSearch: (search: Record<string, unknown>) => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "VIP Pass · 0G-VAULT — All Your Apps. One Vault." },
      { name: "description", content: "Become a Real 0G. Lifetime VIP Pass: full HQ downloads, rotating 0G-VAULT keys, VIP Telegram drops, unlimited tools, every portal unlocked." },
      { property: "og:title", content: "0G-VAULT VIP Pass — Real 0G Status" },
      { property: "og:description", content: "Vault-style access to every 0G app. Full HQ music, VIP Telegram, unlimited tools, rotating vault keys every 15 minutes." },
      { property: "og:type", content: "product" },
    ],
  }),
});

const SOCIALS = [
  { label: "Telegram", handle: "@og_portal", url: "https://t.me/og_portal", Icon: Send, color: "from-sky-500/30 to-sky-600/10", border: "border-sky-400/40", text: "text-sky-300" },
  { label: "Instagram", handle: "@ogstreamz", url: "https://instagram.com/ogstreamz", Icon: Instagram, color: "from-pink-500/30 to-rose-600/10", border: "border-pink-400/40", text: "text-pink-300" },
  { label: "TikTok", handle: "@ogstreamz", url: "https://tiktok.com/@ogstreamz", Icon: Music2, color: "from-fuchsia-500/30 to-purple-600/10", border: "border-fuchsia-400/40", text: "text-fuchsia-300" },
  { label: "YouTube", handle: "@ogstreamz", url: "https://youtube.com/@ogstreamz", Icon: Youtube, color: "from-red-500/30 to-red-600/10", border: "border-red-400/40", text: "text-red-300" },
  { label: "X (Twitter)", handle: "@ogstreamz", url: "https://x.com/ogstreamz", Icon: MessageCircle, color: "from-white/20 to-white/5", border: "border-white/30", text: "text-white" },
];

const HERO_PERKS = [
  { Icon: Download, title: "Full HQ Downloads", body: "Every track, every portal — no per-song checkouts." },
  { Icon: KeyRound, title: "Rotating Vault Keys", body: "0G-VAULT credentials refresh every 15 mins. Yours on tap." },
  { Icon: Send, title: "VIP Telegram Drops", body: "Private broadcast channel — leaks, drops, exclusives." },
  { Icon: Zap, title: "Unlimited Tools", body: "Trade scans, Power-Pack execution, AI tooling — uncapped." },
  { Icon: Crown, title: "Real 0G Badge", body: "Permanent profile flair. Top-shelf status across the network." },
  { Icon: Sparkles, title: "First-Access Drops", body: "New portals open for VIPs first. Always." },
];

const COMPARE = [
  { feature: "Full HQ music downloads", free: false, vip: true },
  { feature: "Per-track unlocks (credits)", free: "Yes (1 credit)", vip: "Free, unlimited" },
  { feature: "0G-VAULT rotating credentials", free: false, vip: true },
  { feature: "VIP Telegram broadcast channel", free: false, vip: true },
  { feature: "Trade scans & Power-Pack tools", free: "Limited", vip: "Unlimited" },
  { feature: "Early access to new portals", free: false, vip: true },
  { feature: "Real 0G profile badge", free: false, vip: true },
  { feature: "Cancel anytime", free: "—", vip: true },
];

const FAQ = [
  { q: "What's actually included?", a: "Every portal we run — music, jokes, tools, trade — opens for you in full. Plus the 0G-VAULT rotating keys and a private Telegram channel." },
  { q: "Will my VIP rotate too?", a: "Your VIP status is permanent for the billing period. Only the 0G-VAULT external credentials rotate every 15 mins for security." },
  { q: "Can I cancel?", a: "Yes — cancel any time, keep access until the end of your period. No questions, no friction." },
  { q: "Is the £20 Real OG pass the same?", a: "The £20 Real OG is a one-off lifetime pass with the same VIP perks. The subscription option is for those who prefer monthly/yearly." },
  { q: "How fast do new perks roll out?", a: "VIPs get every new portal, tool and drop on day one — usually weeks before public release." },
];

const TESTIMONIALS = [
  { quote: "The vault keys rotating thing is wild. Feels like I'm in the matrix.", name: "@deshi.og", role: "VIP since launch" },
  { quote: "Stopped paying per track. Got the pass. Never looked back.", name: "@kxng.flow", role: "Producer" },
  { quote: "Telegram drops alone are worth it. Heard 3 unreleased before anyone.", name: "@nightowl", role: "DJ" },
];

function VipPage() {
  const { user, profile, isAdmin } = useAuth();
  const isVip = isAdmin || profile?.status === "vip";
  const search = Route.useSearch();
  const [plan, setPlan] = useState<"vip_monthly" | "vip_yearly">("vip_yearly");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const checkoutFn = useServerFn(createCheckoutSession);

  // Shared subscription view (env-filtered + realtime). Mirrors /dashboard.
  const { sub: activeSub, planLabel, renewalExact, timezone } = useSubscription({
    userId: user?.id ?? null,
    pollOnSuccess: search.checkout === "success",
  });

  const billingLine = renewalExact
    ? activeSub?.cancel_at_period_end
      ? `Access until ${renewalExact}${timezone ? ` (${timezone})` : ""}`
      : `Next billing ${renewalExact}${timezone ? ` (${timezone})` : ""}`
    : null;

  // Surface a one-time toast on return from Stripe checkout.
  useEffect(() => {
    if (search.checkout === "success") {
      toast.success("VIP Pass activated", {
        description: "Welcome to the syndicate. Every portal is open.",
      });
    } else if (search.checkout === "canceled") {
      toast.message("Checkout canceled — no charge made");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.checkout]);

  const start = async () => {
    if (!user) { toast.error("Sign in first to unlock VIP"); return; }
    setLoading(true);
    try {
      const cs = await checkoutFn({
        data: {
          priceId: plan,
          environment: getStripeEnvironment(),
          customerEmail: user.email,
          userId: user.id,
          returnUrl: `${window.location.origin}/vip?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      setClientSecret(cs);
      // Scroll to checkout
      setTimeout(() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const scrollToPricing = () => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="min-h-screen text-white overflow-x-hidden">
      <PaymentTestModeBanner />

      {/* Members area — only shown when the visitor is already VIP. */}
      <VipMembersDashboard />

      {/* STATUS BANNER — clear, prominent state of the user's VIP */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {search.checkout === "success" ? (
          <div role="status" className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-2xl border border-emerald-400/50 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 p-4 shadow-[0_0_60px_-10px_rgba(16,185,129,0.5)]">
            <PartyPopper className="h-6 w-6 text-emerald-300 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200 flex flex-wrap items-center gap-2">
                VIP Pass activated
                <PlanChip planLabel={planLabel} tone="emerald" />
                <StatusBadge sub={activeSub} />
              </p>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Your status is live. Every portal, every track, every tool — unlocked.
                {billingLine && <> · {billingLine}</>}
                {search.session_id && <> · Receipt ref: <span className="font-mono text-[10px]">{search.session_id.slice(-12)}</span></>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400 hover:bg-emerald-300 text-black font-bold uppercase tracking-[0.2em] px-3 py-2 text-[11px]">
                Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/vault-login" className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300/50 hover:bg-cyan-400/10 text-cyan-100 font-bold uppercase tracking-[0.2em] px-3 py-2 text-[11px]">
                <Lock className="h-3.5 w-3.5" /> Open Vault
              </Link>
            </div>
          </div>
        ) : search.checkout === "canceled" ? (
          <div role="status" className="flex items-center gap-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4">
            <XCircle className="h-5 w-5 text-rose-300 shrink-0" />
            <p className="text-sm text-rose-100">Checkout canceled — no charge made. Pick a plan below whenever you're ready.</p>
          </div>
        ) : isVip ? (
          <div role="status" className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500/15 to-amber-400/5 p-4 shadow-[0_0_60px_-10px_rgba(255,200,80,0.5)]">
            <Crown className="h-6 w-6 text-amber-300 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-200 flex flex-wrap items-center gap-2">
                You're VIP
                <PlanChip planLabel={planLabel} tone="amber" />
                <StatusBadge sub={activeSub} />
              </p>
              <p className="text-xs text-amber-100/80 mt-0.5">
                Real 0G status active{user?.email ? <> · <span className="font-mono">{user.email}</span></> : null}. Every portal is unlocked.
                {billingLine && <> · {billingLine}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase tracking-[0.2em] px-3 py-2 text-[11px]">
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/vault-login" className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300/50 hover:bg-cyan-400/10 text-cyan-100 font-bold uppercase tracking-[0.2em] px-3 py-2 text-[11px]">
                <Lock className="h-3.5 w-3.5" /> Open Vault
              </Link>
            </div>
          </div>
        ) : user ? (
          <div role="status" className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-400/5 p-3">
            <ShieldCheck className="h-5 w-5 text-cyan-300 shrink-0" />
            <p className="flex-1 text-xs sm:text-sm text-cyan-100/85">
              Signed in as <span className="font-mono">{user.email}</span> · <span className="text-cyan-300/80">Free tier</span> — upgrade to unlock the full vault.
            </p>
            <button
              type="button"
              onClick={scrollToPricing}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black uppercase tracking-[0.2em] px-3 py-2 text-[11px] shadow-[0_0_30px_-5px_rgba(56,189,248,0.7)]"
            >
              <Crown className="h-3.5 w-3.5" /> Upgrade now
            </button>
          </div>
        ) : null}

        {isVip && (
          <div className="mt-4">
            <VipReferralCard />
          </div>
        )}
      </div>

      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.28),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(2,6,15,1),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_at_bottom,rgba(56,189,248,0.35),transparent_60%)] animate-pulse" />
          <div className="absolute inset-0 opacity-25 bg-[repeating-linear-gradient(0deg,rgba(56,189,248,0.12)_0_1px,transparent_1px_4px)]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-400/10 px-3 py-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.35em] font-bold text-cyan-200 shadow-[0_0_30px_-5px_rgba(56,189,248,0.6)]">
            <Crown className="h-3 w-3" /> 0G-Syndicate VIP Pass
          </div>

          <h1 className="mt-5 font-[Montserrat] font-black text-4xl sm:text-6xl md:text-7xl tracking-tight leading-[1.05] text-cyan-100 [text-shadow:_0_0_50px_rgba(56,189,248,0.5)]">
            All Your Apps.
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-blue-400 bg-clip-text text-transparent">One Vault.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-cyan-100/80 max-w-2xl mx-auto">
            Real 0G status. Lifetime swagger. Vault-grade access to every portal we run — music, tools, trade, drops — plus rotating 0G-VAULT keys you can flash to flex.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={scrollToPricing}
              className="h-14 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black uppercase tracking-[0.25em] shadow-[0_0_60px_-5px_rgba(56,189,248,0.8)]"
            >
              <Crown className="h-4 w-4 mr-2" /> Get VIP Pass
            </Button>
            <Link
              to="/vault-login"
              className="inline-flex items-center gap-2 h-14 px-6 rounded-md border border-cyan-300/40 bg-black/40 hover:bg-cyan-400/10 text-cyan-100 font-bold uppercase tracking-[0.2em] text-sm"
            >
              <Lock className="h-4 w-4" /> Vault Login
            </Link>
          </div>

          {/* Trust bar */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.25em] text-cyan-200/60">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Stripe-secured</span>
            <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-amber-300" /> 4.9 / 5 from 1,200+ OGs</span>
            <span className="inline-flex items-center gap-1.5"><InfinityIcon className="h-3.5 w-3.5" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* PERKS GRID */}
      {/* ANNOUNCEMENT — official 0G VIP Pass to the Vault */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-2">
        <div className="relative overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-500/15 via-cyan-500/10 to-transparent p-6 sm:p-8 shadow-[0_0_80px_-15px_rgba(255,200,80,0.45)]">
          <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200">
              <Sparkles className="h-3 w-3" /> The time has come
            </div>

            <h2 className="mt-4 font-[Montserrat] font-black text-2xl sm:text-4xl tracking-tight text-white leading-tight">
              Introducing… the <span className="bg-gradient-to-r from-amber-300 to-cyan-300 bg-clip-text text-transparent">0G VIP Pass to 0G Vault</span> 🎉
            </h2>

            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-cyan-50/90">
              <p>The real 0G's of the group have watched us grow from where we started — and now, we're taking things to the next level. 🚀</p>
              <p>We <span className="font-bold text-amber-200">THANK YOU</span> for being a part of this incredible journey with us. You've helped us get here, and now we're ready to bring you even more amazing perks and features.</p>

              <div className="rounded-2xl border border-cyan-300/30 bg-black/40 p-4 sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 font-bold">Unlock now</p>
                <p className="mt-1 text-lg sm:text-xl font-black text-white">
                  Your exclusive 0G VIP Access Pass to the Vault — one-time <span className="text-amber-300">£20 (20 🪙)</span> 🚀
                </p>
                <p className="mt-2 text-sm text-cyan-100/80">
                  Current users <span className="font-bold text-cyan-200">still keep YouTiVi and others</span> — this is just an extra VIP upgrade. 🙌
                </p>
              </div>

              <p>This VIP Pass unlocks <span className="font-bold">PREMIUM access</span> to the best apps and features, making your entertainment experience even more extraordinary. The small fee helps us keep the service running smoothly, with a top-notch app store and hosting, all while keeping your subscription price affordable.</p>

              <div>
                <p className="font-bold text-cyan-100">Why grab the 0G VIP Pass? Here's what you get:</p>
                <ul className="mt-3 space-y-2.5">
                  <li className="flex gap-3"><span aria-hidden>✨</span><span><span className="font-semibold text-white">YouTube Premium on TV</span> — ad-free viewing</span></li>
                  <li className="flex gap-3"><span aria-hidden>🎬</span><span><span className="font-semibold text-white">A variety of new movie apps</span> like OnSTREAM, HD Cinema, and MORE exciting apps on the way (STREMIO 👀)</span></li>
                  <li className="flex gap-3"><span aria-hidden>📺</span><span><span className="font-semibold text-white">Live TV players</span> such as Sky Streamz, Vu Glass, and more coming soon</span></li>
                  <li className="flex gap-3"><span aria-hidden>💥</span><span><span className="font-semibold text-white">Referral bonus</span> — for every 2 people you refer, you'll get 3 extra months added to your subscription</span></li>
                </ul>
                <p className="mt-3 text-amber-200 font-bold">0G Perkz or what 👆</p>
              </div>

              <p>It's the ultimate pass for unlocking even more of what you love, while supporting the growth of <span className="font-bold">0G-Streamz</span>. 🎉</p>
              <p className="font-semibold text-white">Don't miss out — get your 0G VIP Pass today and unlock a world of new possibilities. 🌟</p>
              <p className="text-xs text-cyan-100/60 italic">P.S. If you don't grab it, no worries — you can still enjoy the already amazing service you know and love. 😎</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                onClick={scrollToPricing}
                className="h-12 px-6 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black uppercase tracking-[0.2em] shadow-[0_0_50px_-5px_rgba(255,200,80,0.7)]"
              >
                <Crown className="h-4 w-4 mr-2" /> Grab the £20 Pass (20 🪙)
              </Button>
              <Link
                to="/store"
                className="inline-flex items-center gap-2 h-12 px-5 rounded-md border border-cyan-300/40 bg-black/40 hover:bg-cyan-400/10 text-cyan-100 font-bold uppercase tracking-[0.2em] text-xs"
              >
                See store <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/80 font-bold">What you get</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black text-white">The full vault. No gimmicks.</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HERO_PERKS.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#0b1424] to-[#02060f] p-5 hover:border-cyan-300/50 hover:shadow-[0_0_50px_-10px_rgba(56,189,248,0.6)] transition"
            >
              <div className="h-10 w-10 rounded-lg border border-cyan-300/40 bg-cyan-400/10 flex items-center justify-center mb-3">
                <Icon className="h-5 w-5 text-cyan-200" />
              </div>
              <h3 className="font-bold text-cyan-50">{title}</h3>
              <p className="mt-1 text-sm text-cyan-100/70">{body}</p>
              <div className="pointer-events-none absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20">
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/80 font-bold">Pick your pass</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black text-white">One sub. Every portal.</h2>
          <p className="mt-2 text-sm text-cyan-100/70">Or grab the £20 (20 🪙) lifetime <Link to="/store" className="underline text-amber-300">Real 0G one-off</Link>.</p>
        </div>

        {isVip ? (
          <div className="rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-amber-600/5 p-8 text-center shadow-[0_0_80px_-10px_rgba(255,200,80,0.5)]">
            <Crown className="h-12 w-12 mx-auto mb-3 text-amber-300" />
            <p className="text-xl font-black uppercase tracking-[0.25em] text-amber-200">You're VIP</p>
            <p className="mt-1 text-sm text-amber-100/80">Every portal is unlocked for your account. Wear the crown.</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link to="/dashboard"><Button className="bg-amber-400 text-black hover:bg-amber-300 font-bold uppercase tracking-[0.2em]">Go to dashboard</Button></Link>
              <Link to="/vault-login"><Button variant="outline" className="border-cyan-300/40 text-cyan-100 hover:bg-cyan-400/10">Open Vault</Button></Link>
            </div>
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
                    className={`relative text-left rounded-2xl border-2 p-6 transition ${active ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_50px_-10px_rgba(56,189,248,0.7)]" : "border-white/10 hover:border-white/30"}`}
                  >
                    {isYear && (
                      <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-cyan-400 text-black text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5">
                        <Trophy className="h-3 w-3" /> Best value · save 35%
                      </span>
                    )}
                    <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/70">{isYear ? "Annual" : "Monthly"}</p>
                    <p className="mt-1 text-4xl font-black">£{isYear ? "149" : "19"} <span className="text-base text-yellow-300">({isYear ? "149" : "19"} 🪙)</span><span className="text-sm font-normal opacity-60">/{isYear ? "yr" : "mo"}</span></p>
                    <p className="mt-1 text-xs text-cyan-100/70">{isYear ? "£12.42 (~12 🪙)/mo billed yearly" : "Billed monthly"}</p>
                    {active && (
                      <span className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] font-bold text-cyan-300">
                        <Check className="h-3 w-3" /> Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              onClick={start}
              disabled={loading}
              className="w-full h-14 text-sm uppercase tracking-[0.3em] font-black bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_60px_-5px_rgba(56,189,248,0.8)]"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</> : <><Crown className="h-4 w-4 mr-2" />Become VIP <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] text-cyan-200/60">
              Cancel anytime · Stripe-secured · Instant access
            </p>
          </>
        ) : (
          <div id="checkout" className="rounded-2xl bg-white overflow-hidden">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </section>

      {/* COMPARE */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/80 font-bold">Free vs VIP</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black text-white">See the difference.</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#0b1424] to-[#02060f]">
          <div className="grid grid-cols-3 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-200/80 border-b border-cyan-300/15">
            <div>Feature</div>
            <div className="text-center">Free</div>
            <div className="text-center inline-flex items-center justify-center gap-1.5"><Crown className="h-3 w-3 text-amber-300" /> VIP</div>
          </div>
          {COMPARE.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-3 px-4 py-3 text-sm ${i % 2 ? "bg-white/[0.02]" : ""}`}>
              <div className="text-cyan-50">{row.feature}</div>
              <div className="text-center text-cyan-100/60">
                {row.free === true ? <Check className="h-4 w-4 mx-auto text-cyan-300" /> : row.free === false ? <span className="opacity-40">—</span> : row.free}
              </div>
              <div className="text-center font-semibold">
                {row.vip === true ? <Check className="h-4 w-4 mx-auto text-amber-300" /> : <span className="text-amber-200">{row.vip}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/80 font-bold">From the syndicate</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black text-white">Real OGs. Real talk.</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#0b1424] to-[#02060f] p-5">
              <Quote className="h-5 w-5 text-cyan-300/60" />
              <p className="mt-3 text-sm text-cyan-50 leading-relaxed">"{t.quote}"</p>
              <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em]">
                <span className="font-bold text-cyan-200">{t.name}</span>
                <span className="text-cyan-200/50">· {t.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIALS */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/80 font-bold">Tap in</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black text-white">Follow the syndicate.</h2>
          <p className="mt-2 text-sm text-cyan-100/70">VIPs get drops first on Telegram. Everyone else finds out late.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SOCIALS.map(({ label, handle, url, Icon, color, border, text }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex flex-col items-center gap-2 rounded-2xl border ${border} bg-gradient-to-br ${color} p-5 hover:scale-[1.03] transition`}
            >
              <Icon className={`h-7 w-7 ${text}`} />
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-white/80">{label}</span>
              <span className={`text-xs font-mono ${text} opacity-90 truncate max-w-full`}>{handle}</span>
            </a>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-sky-400/40 bg-gradient-to-r from-sky-500/15 to-cyan-500/10 p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="h-12 w-12 rounded-full border border-sky-300/50 bg-sky-400/15 flex items-center justify-center shrink-0">
            <Send className="h-6 w-6 text-sky-200" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-bold text-sky-100">VIP-only Telegram broadcast channel</p>
            <p className="text-xs text-sky-100/70">Unreleased drops, vault keys, exclusive deals — direct to your phone.</p>
          </div>
          <a
            href="https://t.me/og_portal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-sky-400 hover:bg-sky-300 text-black font-black uppercase tracking-[0.2em] px-4 py-2.5 text-xs"
          >
            Join Telegram <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/80 font-bold">FAQ</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black text-white">Straight answers.</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-cyan-300/20 bg-[#0b1424]/60 p-4 open:border-cyan-300/50">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-cyan-50">
                {f.q}
                <span className="text-cyan-300 text-xl group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-3 text-sm text-cyan-100/75 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl border-2 border-cyan-300/40 bg-gradient-to-br from-[#02060f] via-[#040a1a] to-[#02060f] p-8 sm:p-12 text-center shadow-[0_0_120px_-20px_rgba(56,189,248,0.7)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-60 w-60 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(56,189,248,0.6),transparent)]" />
            <Flame className="absolute top-4 right-4 h-6 w-6 text-cyan-300/70 animate-pulse" />
            <Flame className="absolute bottom-4 left-4 h-6 w-6 text-cyan-300/70 animate-pulse" />
          </div>
          <Crown className="relative h-12 w-12 mx-auto text-amber-300" />
          <h2 className="relative mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl text-cyan-100 [text-shadow:_0_0_40px_rgba(56,189,248,0.55)]">
            Stop renting. Own the vault.
          </h2>
          <p className="relative mt-3 text-sm sm:text-base text-cyan-100/80 max-w-xl mx-auto">
            VIP Pass holders get every portal, every track, every tool — plus the 0G-VAULT keys nobody else can see.
          </p>
          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={scrollToPricing}
              className="h-14 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black uppercase tracking-[0.25em] shadow-[0_0_60px_-5px_rgba(56,189,248,0.8)]"
            >
              <Crown className="h-4 w-4 mr-2" /> Become VIP
            </Button>
            <Link
              to="/store"
              className="inline-flex items-center gap-2 h-14 px-6 rounded-md border border-amber-300/50 bg-amber-400/10 hover:bg-amber-400/20 text-amber-100 font-bold uppercase tracking-[0.2em] text-sm"
            >
              <Sparkles className="h-4 w-4" /> Or £20 Lifetime (20 🪙)
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
