import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, Plus, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MusicHubBalance } from "@/components/MusicHubBalance";
import { CoinActivity } from "@/components/CoinActivity";
import { CoinTopUpModal } from "@/components/CoinTopUpModal";
import { requireMember, redirectBossAway } from "@/lib/route-guards";
import { useAuth } from "@/hooks/use-auth";
import { isBossProfile } from "@/lib/roles";

export const Route = createFileRoute("/wallet")({
  beforeLoad: async (ctx) => {
    await requireMember(ctx);
    await redirectBossAway(ctx);
  },
  validateSearch: (search: Record<string, unknown>) => ({
    topup: search.topup === 1 || search.topup === "1" ? 1 : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
    need: typeof search.need === "number"
      ? search.need
      : typeof search.need === "string" && /^\d+$/.test(search.need)
        ? Number(search.need)
        : undefined,
    from: typeof search.from === "string" ? search.from.slice(0, 80) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Coin Wallet · 0G-PORTAL" },
      { name: "description", content: "Your 🪙 balance, recent coin activity, and quick top-up." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const { profile } = useAuth();
  const isBoss = isBossProfile(profile);
  const { topup, reason, need, from } = Route.useSearch();
  const insufficient = reason === "insufficient";

  // Auto-open the top-up modal when arriving from an insufficient-balance
  // redirect (e.g. portal HIT button -> /wallet?topup=1&reason=insufficient).
  useEffect(() => {
    if (topup === 1 && !isBoss) setTopUpOpen(true);
  }, [topup, isBoss]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-gold" />
          <h1 className="text-2xl font-[Montserrat] font-black tracking-tight">Coin Wallet</h1>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/profile"><ArrowLeft className="h-4 w-4 mr-1" /> Vault</Link>
        </Button>
      </header>

      {insufficient && !isBoss && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"
        >
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">Not enough 🪙 to continue</p>
            <p className="mt-1 text-sm text-foreground/80">
              {need
                ? <>You needed <span className="font-bold tabular-nums">{need} 🪙</span> for that action{from ? <> in <code className="px-1 rounded bg-black/30">{from}</code></> : null}. Top up below to keep going.</>
                : <>That action needs more coins than you have. Top up below to keep going.</>}
            </p>
          </div>
          <Button size="sm" onClick={() => setTopUpOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Top up
          </Button>
        </div>
      )}

      <MusicHubBalance />

      {!isBoss && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/30 bg-card p-4">
          <div className="flex-1 min-w-[180px]">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Need more 🪙?</p>
            <p className="text-sm text-foreground/80">Grab a coin pack from the store — instant top-up.</p>
          </div>
          <Button size="lg" className="font-semibold" onClick={() => setTopUpOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Top up coins
          </Button>
        </div>
      )}

      <CoinActivity loadMore pageSize={20} showDateFilter defaultRange="30d" />

      <CoinTopUpModal open={topUpOpen} onOpenChange={setTopUpOpen} />
    </main>
  );
}