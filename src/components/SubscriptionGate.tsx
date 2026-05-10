import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Lock, Sparkles, Tv } from "lucide-react";
import { useAccess, TIER_LABEL } from "@/lib/access";
import { ACTION_RULES, upgradeCta, upgradeHref, type GatedActionKey } from "@/lib/action-gates";

type Mode = "disable" | "replace";

type Props = {
  /** Action key from ACTION_RULES (single source of truth). */
  action: GatedActionKey;
  /**
   * "disable" (default): renders the children but blocks the click and
   *   shows a small upsell strip beneath. Use for primary action buttons.
   * "replace": replaces children entirely with a full upsell card. Use
   *   for whole sections / panels that should not appear at all.
   */
  mode?: Mode;
  /** Optional tooltip / inline-message override. */
  message?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Front-end subscription gate for a single action. Pairs with the server
 * asserts in `src/lib/vip-guard.ts` — the server is still the source of
 * truth, this component just keeps the UI honest and offers a clean upsell.
 */
export function SubscriptionGate({ action, mode = "disable", message, className = "", children }: Props) {
  const access = useAccess();
  const rule = ACTION_RULES[action];
  const allowed = access.atLeast(rule.min);

  if (allowed) return <>{children}</>;

  const Icon = rule.min === "vip" || rule.min === "boss" ? Crown : rule.min === "stream" ? Tv : Lock;
  const cta = upgradeCta(rule.min);
  const href = upgradeHref(rule.min);
  const need = TIER_LABEL[rule.min];

  if (mode === "replace") {
    return (
      <div className={`rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 ${className}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-amber-300" />
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">
            {need} required
          </span>
        </div>
        <h3 className="mt-2 text-base font-bold">{rule.label}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {message ?? rule.perk}. You're a {TIER_LABEL[access.tier]}.
        </p>
        <Link
          to={href}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" /> {cta}
        </Link>
      </div>
    );
  }

  // disable mode: children rendered visually muted, click intercepted, with upsell row
  return (
    <div className={`relative ${className}`}>
      <div
        aria-disabled="true"
        title={message ?? `${need} required`}
        onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="pointer-events-none select-none opacity-50 grayscale"
      >
        {children}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-amber-300">
          <Icon className="h-3.5 w-3.5" />
          <span>
            <strong className="font-bold">{need} required</strong>
            <span className="text-muted-foreground"> · {message ?? rule.perk}</span>
          </span>
        </span>
        <Link
          to={href}
          className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 font-bold text-black hover:bg-amber-300"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

export default SubscriptionGate;