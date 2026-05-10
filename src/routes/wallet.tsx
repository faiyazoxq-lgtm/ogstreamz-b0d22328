import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Coins, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MusicHubBalance } from "@/components/MusicHubBalance";
import { CoinActivity } from "@/components/CoinActivity";
import { CoinTopUpModal } from "@/components/CoinTopUpModal";
import { requireMember } from "@/lib/route-guards";

export const Route = createFileRoute("/wallet")({
  beforeLoad: requireMember,
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

      <MusicHubBalance />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/30 bg-card p-4">
        <div className="flex-1 min-w-[180px]">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Need more 🪙?</p>
          <p className="text-sm text-foreground/80">Grab a coin pack from the store — instant top-up.</p>
        </div>
        <Button size="lg" className="font-semibold" onClick={() => setTopUpOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Top up coins
        </Button>
      </div>

      <CoinActivity loadMore pageSize={20} showDateFilter defaultRange="30d" />

      <CoinTopUpModal open={topUpOpen} onOpenChange={setTopUpOpen} />
    </main>
  );
}