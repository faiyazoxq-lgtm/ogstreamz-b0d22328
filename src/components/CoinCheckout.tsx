import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Loader2, Check, AlertTriangle, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { purchaseWithCoins, type CoinPurchaseKind } from "@/lib/coin-checkout.functions";
import { toast } from "sonner";

interface Props {
  kind: CoinPurchaseKind;
  ref?: string;
  cost: number;
  itemTitle: string;
  /** Shown after purchase succeeds (e.g. "Track unlocked", "Pass requested"). */
  successLabel?: string;
  onSuccess?: (result: { balance: number; pending_approval?: boolean; already?: boolean }) => void;
}

export function CoinCheckout({ kind, ref, cost, itemTitle, successLabel, onSuccess }: Props) {
  const { profile, refresh } = useAuth() as any;
  const purchase = useServerFn(purchaseWithCoins);
  const balance = profile?.credits ?? 0;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { pending: boolean }>(null);

  const insufficient = balance < cost;

  const handleBuy = async () => {
    setBusy(true);
    try {
      const res: any = await purchase({ data: { kind, ref } });
      if (!res?.ok) {
        if (res?.error === "insufficient") {
          toast.error(`Not enough 🪙 — need ${res.cost}, have ${res.balance}.`);
        } else {
          toast.error(res?.error || "Purchase failed");
        }
        return;
      }
      setDone({ pending: !!res.pending_approval });
      onSuccess?.(res);
      if (typeof refresh === "function") refresh();
      toast.success(
        res.pending_approval
          ? `Pass requested — boss will approve. ${res.cost} 🪙 reserved.`
          : `${itemTitle} unlocked! −${res.cost} 🪙`
      );
    } catch (e: any) {
      toast.error(e?.message || "Purchase failed");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6 text-center">
        <Check className="h-8 w-8 mx-auto text-emerald-400" />
        <p className="mt-3 font-bold text-white">
          {done.pending ? "Pass requested" : `${itemTitle} unlocked`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {done.pending ? "Boss will issue the pass shortly." : "Enjoy."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 via-card to-card p-6 space-y-4">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Pay with coins</p>
        <p className="mt-2 font-[Montserrat] font-black text-4xl text-metallic">
          {cost} <span className="text-2xl">🪙</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {itemTitle}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-gold" /> Your wallet
        </span>
        <span className={insufficient ? "font-bold text-destructive" : "font-bold text-foreground"}>
          {balance} 🪙
        </span>
      </div>

      {insufficient ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Not enough 🪙. You need <strong>{cost - balance}</strong> more coin
              {cost - balance === 1 ? "" : "s"} to checkout.
            </span>
          </div>
          <Button asChild className="w-full" size="lg">
            <Link to="/store" search={{ reason: "topup" }}>
              <Plus className="h-4 w-4 mr-2" /> Buy {cost - balance}+ 🪙 to continue
            </Link>
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleBuy}
          disabled={busy}
          className="w-full text-xs uppercase tracking-[0.25em] font-bold py-6"
          size="lg"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Spending coins…
            </>
          ) : (
            <>Confirm — Spend {cost} 🪙</>
          )}
        </Button>
      )}

      <p className="text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        1 🪙 = £1 · No card needed
      </p>
    </div>
  );
}