import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Crown, KeyRound, Send, Download, Sparkles, ArrowRight,
  ShieldCheck, Music, Wrench, TrendingUp, Radio, Lock,
  Calendar, Trophy, Headphones, Zap, Settings, CreditCard,
  RefreshCw, AlertTriangle, ExternalLink, Loader2, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { PlanChip, StatusBadge } from "@/components/SubscriptionBadges";
import { VipReferralCard } from "@/components/VipReferralCard";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

/**
 * Logged-in VIP member dashboard.
 * Renders ONLY when the current user already holds VIP — gives them a
 * concise "members area" instead of forcing them through marketing copy.
 */
export function VipMembersDashboard() {
  const { user, profile, isAdmin } = useAuth();
  const isBoss = isAdmin;
  const isVip = isBoss || profile?.status === "vip";
  const { sub, planLabel, renewalExact, timezone } = useSubscription({
    userId: user?.id ?? null,
  });

  if (!user || !isVip) return null;

  const billingLine = renewalExact
    ? sub?.cancel_at_period_end
      ? `Access until ${renewalExact}${timezone ? ` (${timezone})` : ""}`
      : `Renews ${renewalExact}${timezone ? ` (${timezone})` : ""}`
    : isBoss
      ? "Boss-tier · permanent"
      : "Lifetime / one-off";

  return (
    <section
      aria-label="VIP members dashboard"
      className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2"
    >
      {/* Hero status card */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-400/50 bg-gradient-to-br from-amber-500/15 via-amber-400/5 to-cyan-500/10 p-5 sm:p-7 shadow-[0_0_80px_-15px_rgba(255,200,80,0.55)]">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400/40 to-amber-500/10 ring-1 ring-amber-300/50 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(255,200,80,0.7)]">
              <Crown className="h-7 w-7 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.32em] font-bold text-amber-200/80">
                Welcome back, Real OG
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-black text-white truncate">
                {profile?.email ?? user.email}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <PlanChip planLabel={planLabel ?? (isBoss ? "Boss" : "VIP")} tone="amber" />
                <StatusBadge sub={sub} />
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
                  <Calendar className="h-3 w-3" /> {billingLine}
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1 lg:flex-none lg:ml-auto flex flex-wrap gap-2">
            <Link
              to="/vault-login"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black uppercase tracking-[0.2em] px-4 py-2.5 text-[11px] shadow-[0_0_30px_-5px_rgba(56,189,248,0.7)]"
            >
              <Lock className="h-3.5 w-3.5" /> Open Vault
            </Link>
            <Link
              to="/account/passes"
              className="inline-flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-400/10 hover:bg-amber-400/20 text-amber-100 font-bold uppercase tracking-[0.2em] px-4 py-2.5 text-[11px]"
            >
              <Crown className="h-3.5 w-3.5" /> My Passes
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-cyan-300/40 bg-black/30 hover:bg-cyan-400/10 text-cyan-100 font-bold uppercase tracking-[0.2em] px-4 py-2.5 text-[11px]"
            >
              Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick-claim grid */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ClaimCard
          to="/vault-login"
          tone="cyan"
          Icon={KeyRound}
          title="Vault Keys"
          desc="Rotating credentials refresh every 15 min."
          cta="Reveal"
        />
        <ClaimCard
          href="https://t.me/og_portal"
          external
          tone="sky"
          Icon={Send}
          title="VIP Telegram"
          desc="Drops, leaks and exclusives — direct to phone."
          cta="Join"
        />
        <ClaimCard
          to="/music"
          tone="amber"
          Icon={Headphones}
          title="HQ Downloads"
          desc="Full-quality tracks, no per-song checkout."
          cta="Browse"
        />
        <ClaimCard
          to="/tools"
          tone="violet"
          Icon={Zap}
          title="Power Tools"
          desc="Unlimited Trade scans, calculators and bots."
          cta="Use"
        />
      </div>

      {/* Portal shortcut strip + referral */}
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#0b1424]/80 to-[#02060f]/80 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 font-bold">Your unlocked portals</p>
              <p className="mt-0.5 text-sm font-bold text-white">Every portal, opened.</p>
            </div>
            <Link to="/portals" className="text-[11px] uppercase tracking-[0.2em] font-bold text-cyan-300 hover:text-cyan-200">
              Browse all <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <PortalChip to="/music" Icon={Music} label="MusicHUB" />
            <PortalChip to="/trade" Icon={TrendingUp} label="TradeHUB" />
            <PortalChip to="/syndicate" Icon={Radio} label="Syndicate" />
            <PortalChip to="/tools" Icon={Wrench} label="ToolHUB" />
            <PortalChip to="/noticeboard" Icon={Sparkles} label="VIP Noticeboard" />
            <PortalChip to="/profile" Icon={ShieldCheck} label="Vault & Profile" />
          </div>
        </div>
        <VipReferralCard />
      </div>

      <p className="mt-5 px-1 text-[11px] text-cyan-100/55">
        <Trophy className="inline h-3 w-3 text-amber-300 mr-1" />
        Tip: scroll down to manage / change your plan, or invite friends with the referral card above.
      </p>
    </section>
  );
}

/* -------------------- helpers -------------------- */

const tones: Record<string, { ring: string; bg: string; text: string; btn: string; ic: string }> = {
  cyan:   { ring: "border-cyan-300/40",   bg: "from-cyan-500/15 to-cyan-700/5",   text: "text-cyan-100",   btn: "bg-cyan-400 text-black hover:bg-cyan-300",     ic: "text-cyan-200" },
  sky:    { ring: "border-sky-300/40",    bg: "from-sky-500/15 to-sky-700/5",     text: "text-sky-100",    btn: "bg-sky-400 text-black hover:bg-sky-300",       ic: "text-sky-200" },
  amber:  { ring: "border-amber-300/40",  bg: "from-amber-500/15 to-amber-700/5", text: "text-amber-100",  btn: "bg-amber-400 text-black hover:bg-amber-300",   ic: "text-amber-200" },
  violet: { ring: "border-violet-300/40", bg: "from-violet-500/15 to-violet-700/5", text: "text-violet-100", btn: "bg-violet-400 text-black hover:bg-violet-300", ic: "text-violet-200" },
};

function ClaimCard({
  to, href, external, tone, Icon, title, desc, cta,
}: {
  to?: string;
  href?: string;
  external?: boolean;
  tone: keyof typeof tones;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  cta: string;
}) {
  const t = tones[tone];
  const inner = (
    <div className={`group relative h-full rounded-2xl border ${t.ring} bg-gradient-to-br ${t.bg} p-4 transition hover:border-amber-300/50 hover:shadow-[0_0_40px_-8px_rgba(56,189,248,0.5)]`}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg border ${t.ring} bg-black/30 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${t.ic}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white text-sm truncate">{title}</p>
          <p className={`text-[11px] ${t.text}/70 leading-tight mt-0.5 line-clamp-2`}>{desc}</p>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] font-black transition-transform group-hover:translate-x-0.5">
        <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${t.btn}`}>
          {cta} <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="block h-full">
        {inner}
      </a>
    );
  }
  return <Link to={to as string} className="block h-full">{inner}</Link>;
}

function PortalChip({ to, Icon, label }: { to: string; Icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] hover:border-amber-300/40 hover:bg-amber-400/5 px-3 py-2 text-[12px] font-bold text-white transition"
    >
      <Icon className="h-3.5 w-3.5 text-amber-300/80 group-hover:text-amber-200" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default VipMembersDashboard;