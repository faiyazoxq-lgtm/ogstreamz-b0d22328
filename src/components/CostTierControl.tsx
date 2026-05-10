import { useState } from "react";
import { ChevronDown, DollarSign } from "lucide-react";
import {
  SERVICES,
  TIER_LABEL,
  TIER_BADGE_CLASS,
  summarizeCosts,
  type ChargeType,
} from "@/lib/cost-registry";

type Props = {
  flags: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  compact?: boolean;
};

export function CostTierBadge({ flags }: { flags: Record<string, boolean> }) {
  const sum = summarizeCosts(flags);
  const cls = TIER_BADGE_CLASS[sum.tier];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {TIER_LABEL[sum.tier]}
      {sum.liveCostUsd > 0 && (
        <span className="inline-flex items-center gap-0.5 opacity-80">
          <DollarSign className="h-2.5 w-2.5" />{sum.liveCostUsd.toFixed(3)}
        </span>
      )}
      {sum.hasUnsubscribedPaid && <span title="Uses paid service without active subscription">⚠</span>}
    </span>
  );
}

export function CostTierControl({ flags, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const sum = summarizeCosts(flags);

  function toggle(key: string) {
    const next = { ...flags, [key]: !flags[key] };
    if (!next[key]) delete next[key];
    onChange(next);
  }

  const grouped = SERVICES.reduce<Record<ChargeType, typeof SERVICES>>((acc, s) => {
    (acc[s.chargeType] ||= []).push(s);
    return acc;
  }, {} as any);
  const order: ChargeType[] = ["subscription", "allowance", "coin", "payg", "free"];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 group"
        title="Edit paid services this uses"
      >
        <CostTierBadge flags={flags} />
        {!compact && <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-72 rounded-xl border bg-popover p-3 shadow-lg">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Paid services used · live ${sum.liveCostUsd.toFixed(4)}/use
            </p>
            <div className="max-h-72 overflow-y-auto space-y-3">
              {order.map((ct) =>
                grouped[ct]?.length ? (
                  <div key={ct}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{TIER_LABEL[ct]}</p>
                    <div className="space-y-1">
                      {grouped[ct].map((s) => (
                        <label key={s.key} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1">
                          <input
                            type="checkbox"
                            checked={!!flags[s.key]}
                            onChange={() => toggle(s.key)}
                            className="mt-0.5"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium block truncate">{s.label}</span>
                            <span className="text-muted-foreground text-[10px]">
                              {s.bossSubscribed ? "✓ subscribed" : "no sub"}
                              {s.unitCostUsd > 0 && ` · $${s.unitCostUsd}/${s.unit}`}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}