import { Link } from "@tanstack/react-router";
import { Coins, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

/**
 * Compact credit wallet for signed-in users.
 * Shows current balance and refreshes from useAuth (which is bumped after
 * each portal generation), so the number drops the moment a credit is spent.
 */
export function CreditWallet({ className }: { className?: string }) {
  const { user, profile, loading, hasStoredSession } = useAuth();
  const isBoss = isBossProfile(profile);

  // Don't flash the unauthed state while a stored session is being restored
  if (!user && (loading || hasStoredSession)) {
    return (
      <div
        className={[
          "rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/5 to-transparent p-4 flex items-center gap-3",
          className ?? "",
        ].join(" ")}
      >
        <Loader2 className="h-4 w-4 animate-spin text-gold" />
        <span className="text-sm text-muted-foreground">Loading wallet…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={[
          "rounded-2xl border border-transparent bg-transparent p-4 flex flex-wrap items-center gap-3",
          className ?? "",
        ].join(" ")}
      >
        <Coins className="h-5 w-5 text-gold" />
        <span className="text-sm text-muted-foreground">
          Sign in to track your 🪙.
        </span>
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  const credits = profile?.credits ?? 0;
  const low = credits <= 1;

  return (
    <div
      className={[
        "rounded-2xl border p-4 flex flex-wrap items-center gap-3",
        low
          ? "border-destructive/40 bg-destructive/5"
          : "border-gold/40 bg-gradient-to-r from-gold/10 via-transparent to-transparent",
        className ?? "",
      ].join(" ")}
      aria-live="polite"
      aria-label={`Coin wallet: ${credits} 🪙`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-gold/15 border border-gold/40 p-2">
          <Coins className="h-5 w-5 text-gold" />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Coin wallet
          </div>
          <div className="font-[Montserrat] font-black text-2xl text-foreground">
            {credits}
            <span className="text-xs font-semibold text-muted-foreground ml-1">🪙</span>
          </div>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {low && (
          <span className="text-[10px] uppercase tracking-[0.25em] text-destructive">
            Low balance
          </span>
        )}
        {!isBoss && (
          <Button asChild size="sm" variant={low ? "default" : "outline"}>
            <Link to="/store">
              <Plus className="h-3.5 w-3.5 mr-1" /> Top up
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
