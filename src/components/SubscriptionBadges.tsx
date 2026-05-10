import type { SubscriptionRow } from "@/hooks/use-subscription";

type Tone = "emerald" | "amber" | "cyan";

/**
 * Plan chip ("Monthly plan" / "Yearly plan"). Tone matches the surrounding
 * status banner so it visually aligns with VIP/post-checkout/dashboard cards.
 */
export function PlanChip({
  planLabel,
  tone = "amber",
  size = "md",
}: {
  planLabel: string | null;
  tone?: Tone;
  size?: "sm" | "md";
}) {
  if (!planLabel) return null;
  const toneCls: Record<Tone, string> = {
    emerald: "border-emerald-300/60 bg-emerald-400/15 text-emerald-100",
    amber:   "border-amber-300/60 bg-amber-400/15 text-amber-100",
    cyan:    "border-cyan-300/60 bg-cyan-400/15 text-cyan-100",
  };
  const sizeCls = size === "sm" ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center rounded-full border tracking-[0.25em] uppercase ${sizeCls} ${toneCls[tone]}`}>
      {planLabel} plan
    </span>
  );
}

/**
 * Color-coded subscription status badge derived from a Stripe row.
 * `cancel_at_period_end` flips an active sub to an amber "Cancelling" chip.
 */
export function StatusBadge({
  sub,
  size = "md",
}: {
  sub: SubscriptionRow | null;
  size?: "sm" | "md";
}) {
  const s = sub?.status;
  if (!s) return null;
  const cancelling = sub?.cancel_at_period_end;
  const map: Record<string, { label: string; cls: string }> = {
    active:             { label: cancelling ? "Cancelling" : "Active",
                          cls: cancelling
                            ? "border-amber-300/60 bg-amber-400/15 text-amber-100"
                            : "border-emerald-300/60 bg-emerald-400/15 text-emerald-100" },
    trialing:           { label: "Trialing",   cls: "border-cyan-300/60 bg-cyan-400/15 text-cyan-100" },
    past_due:           { label: "Past due",   cls: "border-amber-300/70 bg-amber-400/20 text-amber-100" },
    unpaid:             { label: "Unpaid",     cls: "border-rose-300/60 bg-rose-500/15 text-rose-100" },
    canceled:           { label: "Canceled",   cls: "border-rose-300/60 bg-rose-500/15 text-rose-100" },
    incomplete:         { label: "Incomplete", cls: "border-white/30 bg-white/10 text-white/80" },
    incomplete_expired: { label: "Expired",    cls: "border-white/30 bg-white/10 text-white/70" },
    paused:             { label: "Paused",     cls: "border-white/30 bg-white/10 text-white/80" },
  };
  const v = map[s] ?? { label: s.replace(/_/g, " "), cls: "border-white/30 bg-white/10 text-white/80" };
  const sizeCls = size === "sm" ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-[0.25em] uppercase ${sizeCls} ${v.cls}`}
      title={`Subscription status: ${s}`}
    >
      {v.label}
    </span>
  );
}