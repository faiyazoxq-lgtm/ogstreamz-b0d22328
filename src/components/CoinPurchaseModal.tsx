import * as React from "react";
import { Loader2, ShoppingBag, Coins, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type CoinPurchaseStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string }
  | { kind: "err"; message: string };

/**
 * Reusable confirm-before-charge modal for any "Buy for X 🪙" flow on a HUB
 * portal tile (or anywhere else). Shows cost, current balance (optional),
 * total, and a confirm button. The parent owns the actual charge call so the
 * modal stays presentation-only.
 */
export function CoinPurchaseModal({
  open,
  onOpenChange,
  itemName,
  cost,
  quantity = 1,
  balance,
  accent = "oklch(0.85 0.18 88)",
  status,
  onConfirm,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  itemName: string;
  cost: number;
  quantity?: number;
  balance?: number | null;
  accent?: string;
  status: CoinPurchaseStatus;
  onConfirm: () => void;
  description?: string;
  children?: React.ReactNode;
}) {
  const total = Math.max(0, Math.round(cost * quantity));
  const insufficient =
    typeof balance === "number" && balance < total ? balance : null;
  const pending = status.kind === "pending";
  const done = status.kind === "ok";

  return (
    <Dialog open={open} onOpenChange={(v) => (!pending ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-sm border-2" style={{ borderColor: `${accent}66` }}>
        <DialogHeader>
          <div
            className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: `${accent}22`, color: accent }}
          >
            <Coins className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-[Montserrat] font-black tracking-tight">
            Confirm purchase
          </DialogTitle>
          <DialogDescription className="text-center">
            {description ?? `Unlock “${itemName}” using your coins.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-black/30 px-4 py-3 text-sm" style={{ borderColor: `${accent}33` }}>
          <Row label="Item" value={itemName} mono={false} />
          {quantity > 1 && <Row label="Quantity" value={`× ${quantity}`} />}
          <Row label="Unit cost" value={`${cost.toLocaleString()} 🪙`} />
          <div className="my-2 h-px bg-white/10" />
          <Row label="Total" value={`${total.toLocaleString()} 🪙`} bold />
          {typeof balance === "number" && (
            <Row
              label="Your balance"
              value={`${balance.toLocaleString()} 🪙`}
              tone={insufficient !== null ? "warn" : "muted"}
            />
          )}
        </div>

        {status.kind === "err" && (
          <p className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-200">
            <AlertTriangle className="h-3.5 w-3.5" /> {status.message}
          </p>
        )}
        {status.kind === "ok" && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> {status.message}
          </p>
        )}
        {insufficient !== null && status.kind !== "err" && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            You need {(total - insufficient).toLocaleString()} more 🪙 to complete this purchase.
          </p>
        )}
        {children}

        <DialogFooter className="gap-2 sm:gap-2">
          {done ? (
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="portal-button-motion portal-button-motion--lg w-full font-black uppercase tracking-[0.2em] text-xs text-black border-2"
              style={{ background: accent, borderColor: accent }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
                className="flex-1 min-h-12"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={pending || insufficient !== null}
                aria-busy={pending}
                className="portal-button-motion portal-button-motion--lg flex-1 inline-flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] text-xs text-black border-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: accent, borderColor: accent, boxShadow: `0 0 32px -8px ${accent}` }}
              >
                {pending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Charging…</>
                ) : (
                  <><ShoppingBag className="h-4 w-4" /> Pay {total} 🪙</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label, value, bold, mono = true, tone = "default",
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  tone?: "default" | "muted" | "warn";
}) {
  const toneCls =
    tone === "muted" ? "text-muted-foreground" :
    tone === "warn"  ? "text-amber-300" : "text-foreground";
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <span className={`${mono ? "tabular-nums" : ""} ${bold ? "font-black" : "font-semibold"} ${toneCls}`}>
        {value}
      </span>
    </div>
  );
}