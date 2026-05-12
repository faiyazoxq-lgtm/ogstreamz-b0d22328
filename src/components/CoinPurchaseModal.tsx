import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  Loader2, ShoppingBag, Coins, CheckCircle2, AlertTriangle, ArrowUpRight,
} from "lucide-react";
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
  | { kind: "ok"; message: string; balance?: number; receiptId?: string }
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
  unlockedHref,
  unlockedLabel = "View unlocked portal",
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
  /** Where the "View unlocked portal" button links after a successful charge. */
  unlockedHref?: string;
  unlockedLabel?: string;
}) {
  const total = Math.max(0, Math.round(cost * quantity));
  const insufficient =
    typeof balance === "number" && balance < total ? balance : null;
  const pending = status.kind === "pending";
  const done = status.kind === "ok";
  const projected =
    typeof balance === "number" && !done ? Math.max(0, balance - total) : null;
  // Confirm button is the focus target on open. Radix Dialog already traps
  // focus inside DialogContent and restores it on close — we just steer
  // initial focus toward the primary action so keyboard users land on it.
  const confirmRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (open && !done && !pending) {
      // Defer until after Radix mounts content so autoFocus inside
      // DialogContent has settled.
      const t = setTimeout(() => confirmRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, done, pending]);

  return (
    <Dialog open={open} onOpenChange={(v) => (!pending ? onOpenChange(v) : null)}>
      <DialogContent
        className="max-w-sm border-2 sm:max-w-sm w-[min(100vw-1.5rem,24rem)]"
        style={{ borderColor: `${accent}66` }}
        onOpenAutoFocus={(e) => {
          // Hand initial focus to the confirm button (or the close button
          // when the receipt is already showing).
          e.preventDefault();
          confirmRef.current?.focus();
        }}
      >
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

        <section
          aria-label="Cost breakdown"
          className="rounded-xl border bg-black/30 px-3 py-2.5 text-[13px] leading-tight"
          style={{ borderColor: `${accent}33` }}
        >
          <Row label="Item" value={itemName} mono={false} truncate />
          {quantity > 1 && (
            <Row label="Qty" value={`× ${quantity}`} />
          )}
          <Row label="Unit" value={`${cost.toLocaleString()} 🪙`} />

          <div className="my-1.5 h-px bg-white/10" />

          {/* Total row — visually emphasised, large hit target row */}
          <div className="flex items-baseline justify-between gap-2 py-0.5">
            <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
              Total
            </span>
            <span
              className="tabular-nums font-black text-base"
              style={{ color: accent }}
            >
              {total.toLocaleString()} 🪙
            </span>
          </div>

          {typeof balance === "number" && (
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pt-1.5 border-t border-white/5">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Balance
              </span>
              <span className="flex items-baseline gap-1.5 tabular-nums">
                <span className={insufficient !== null ? "text-amber-300 font-bold" : "text-foreground/80"}>
                  {balance.toLocaleString()} 🪙
                </span>
                {projected !== null && insufficient === null && (
                  <span className="text-[10px] text-muted-foreground">
                    → <span className="tabular-nums font-bold text-foreground/90">{projected.toLocaleString()} 🪙</span> after
                  </span>
                )}
              </span>
            </div>
          )}
        </section>

        {/* Live region for screen readers — announces status changes */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {pending ? "Charging your coins, please wait."
            : done ? `Purchase confirmed. ${status.message}`
            : status.kind === "err" ? `Purchase failed: ${status.message}`
            : insufficient !== null
              ? `Insufficient balance. You need ${(total - insufficient).toLocaleString()} more coins.`
              : `Total ${total.toLocaleString()} coins.`}
        </p>

        {status.kind === "err" && (
          <p className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-200">
            <AlertTriangle className="h-3.5 w-3.5" /> {status.message}
          </p>
        )}
        {status.kind === "ok" && (
          <SuccessReceipt
            itemName={itemName}
            paid={total}
            balance={status.balance ?? balance ?? null}
            message={status.message}
            accent={accent}
            receiptId={status.receiptId}
          />
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
            <div className="flex w-full flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 min-h-12"
              >
                Close
              </Button>
              {unlockedHref && (
                <Button
                  asChild
                  type="button"
                  className="portal-button-motion portal-button-motion--lg flex-1 inline-flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] text-xs text-black border-2"
                  style={{ background: accent, borderColor: accent, boxShadow: `0 0 32px -8px ${accent}` }}
                >
                  <Link to={unlockedHref as any} onClick={() => onOpenChange(false)}>
                    <ArrowUpRight className="h-4 w-4" /> {unlockedLabel}
                  </Link>
                </Button>
              )}
            </div>
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
                ref={confirmRef}
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
  label, value, bold, mono = true, tone = "default", truncate = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  tone?: "default" | "muted" | "warn";
  truncate?: boolean;
}) {
  const toneCls =
    tone === "muted" ? "text-muted-foreground" :
    tone === "warn"  ? "text-amber-300" : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground shrink-0">{label}</span>
      <span className={`${mono ? "tabular-nums" : ""} ${bold ? "font-black" : "font-semibold"} ${toneCls} ${truncate ? "truncate min-w-0 text-right" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function SuccessReceipt({
  itemName, paid, balance, message, accent, receiptId,
}: {
  itemName: string;
  paid: number;
  balance: number | null;
  message: string;
  accent: string;
  receiptId?: string;
}) {
  const stamp = React.useMemo(() => {
    const d = new Date();
    return d.toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }, []);
  const id = receiptId ?? `0G-${Date.now().toString(36).toUpperCase()}`;

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-gradient-to-b from-emerald-500/10 to-black/40 px-4 py-3"
      style={{ borderColor: `${accent}55` }}
    >
      {/* Perforated edge accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-[1px] -translate-y-1/2 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, currentColor 0 4px, transparent 4px 8px)",
        }}
      />
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: `${accent}25`, color: accent }}
        >
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-emerald-300">
            Payment confirmed
          </p>
          <p className="text-[11px] text-emerald-100/80 leading-snug">{message}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 text-[11px]">
        <span className="text-muted-foreground uppercase tracking-[0.2em]">Item</span>
        <span className="text-right text-foreground truncate">{itemName}</span>
        <span className="text-muted-foreground uppercase tracking-[0.2em]">Paid</span>
        <span className="text-right tabular-nums font-bold">{paid.toLocaleString()} 🪙</span>
        {typeof balance === "number" && (
          <>
            <span className="text-muted-foreground uppercase tracking-[0.2em]">Balance</span>
            <span className="text-right tabular-nums font-bold" style={{ color: accent }}>
              {balance.toLocaleString()} 🪙
            </span>
          </>
        )}
        <span className="text-muted-foreground uppercase tracking-[0.2em]">When</span>
        <span className="text-right text-foreground/80">{stamp}</span>
      </div>

      <div className="mt-2 pt-2 border-t border-dashed border-white/10 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Receipt</span>
        <span className="text-[10px] tabular-nums text-foreground/70 font-mono">{id}</span>
      </div>
    </div>
  );
}