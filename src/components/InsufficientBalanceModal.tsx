import { Coins, X, Wallet, AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  cost: number;
  balance?: number | null;
  itemLabel?: string;
  onClose: () => void;
  /** Optional: route the user to a top-up flow. */
  onTopUp?: () => void;
};

export function InsufficientBalanceModal({
  open,
  cost,
  balance,
  itemLabel = "download",
  onClose,
  onTopUp,
}: Props) {
  if (!open) return null;
  const shortBy =
    typeof balance === "number" ? Math.max(0, cost - balance) : null;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> Not enough credits
        </div>
        <h3 className="mt-2 text-lg font-bold">Top up to unlock this {itemLabel}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You need <span className="font-bold text-foreground">{cost} 🪙</span> to unlock the full {itemLabel}.
          {shortBy !== null && shortBy > 0 && (
            <> You're short by <span className="font-bold text-destructive">{shortBy} 🪙</span>.</>
          )}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-secondary/40 border border-border px-2.5 py-2">
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <Coins className="h-3 w-3" /> Cost
            </div>
            <div className="mt-1 font-mono font-bold">{cost} 🪙</div>
          </div>
          <div className="rounded-md bg-secondary/40 border border-border px-2.5 py-2">
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <Wallet className="h-3 w-3" /> Balance
            </div>
            <div className="mt-1 font-mono font-bold">
              {typeof balance === "number" ? `${balance} 🪙` : "—"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/40"
          >
            Cancel
          </button>
          {onTopUp && (
            <button
              onClick={onTopUp}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-bold hover:opacity-90"
            >
              <Coins className="h-4 w-4" /> Top up credits
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default InsufficientBalanceModal;