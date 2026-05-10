import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, Crown, ShieldAlert, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BossChatPanel } from "@/components/BossChatPanel";
import { SpawnPortalCard } from "@/components/SpawnPortalCard";
import { CreditWallet } from "@/components/CreditWallet";

type TradePortal = {
  id: string; slug: string; name: string; niche: string; vip: boolean;
  theme_config: any;
};

export const Route = createFileRoute("/trade")({
  head: () => ({
    meta: [
      { title: "TradeHUB — 0G-PORTAL Executive Terminals" },
      { name: "description", content: "Slate & Gold trading war rooms. Pick a market, run a scan, emit signals to your syndicate." },
      { property: "og:title", content: "TradeHUB — 0G-PORTAL" },
      { property: "og:description", content: "Executive trading intelligence: bias meters, bento decisives, Telegram syndicate broadcasts." },
    ],
  }),
  component: TradeHubPage,
});

function TradeHubPage() {
  const [portals, setPortals] = useState<TradePortal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("portals")
      .select("id, slug, name, niche, vip, theme_config")
      .eq("kind", "trade")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setPortals((data || []) as TradePortal[]);
      });
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <header className="mb-10">
        <p className="text-xs tracking-[0.4em] text-gold uppercase font-semibold">TradeHUB · Executive Tier</p>
        <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-6xl tracking-tight">
          The <span className="text-gradient-gold">War Room.</span>
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          Slate & Gold trading terminals. Each portal is a dedicated 0G-Agent — bias meters, bento decisives,
          Liquidity Pulse, and one-tap Syndicate signal broadcasts.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive mb-8">
          {error}
        </div>
      )}

      <div className="mb-10">
        <BossChatPanel />
      </div>

      {!portals ? (
        <div className="text-sm text-muted-foreground">Loading terminals…</div>
      ) : portals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Activity className="h-8 w-8 text-gold mx-auto mb-3" />
          <h2 className="text-xl font-bold">No terminals spawned yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Admins can spawn a Gold, Forex, or Crypto terminal from the admin console.
          </p>
          <Link to="/admin" className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gold text-primary-foreground text-xs font-bold uppercase tracking-[0.25em]">
            Open Admin <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {portals.map((p) => {
            const tc = p.theme_config || {};
            const accent: string = tc.accent || "#D4AF37";
            const tickers: string[] = Array.isArray(tc.tickers) ? tc.tickers.slice(0, 4) : [];
            return (
              <Link
                key={p.id}
                to="/td/$slug"
                params={{ slug: p.slug }}
                className="group relative rounded-2xl border border-border bg-card p-5 transition-all hover:border-gold hover:-translate-y-0.5"
                style={{ boxShadow: `0 0 32px -24px ${accent}` }}
              >
                {p.vip && (
                  <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold bg-gold/15 border border-gold/50 text-gold">
                    <Crown className="h-3 w-3" /> VIP
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>
                  <TrendingUp className="h-3.5 w-3.5" /> 0G-TRADE
                </div>
                <h3 className="font-[Montserrat] font-black text-2xl tracking-tight">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.niche}</p>
                {tickers.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tickers.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full border border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-gold opacity-80 group-hover:opacity-100">
                  Enter terminal <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-10 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5 text-gold" />
        Risk Disclosure · Not Financial Advice · Markets carry capital loss risk
      </div>
      <CreditWallet className="mt-10" />
      <SpawnPortalCard kind="trade" />
    </main>
  );
}
