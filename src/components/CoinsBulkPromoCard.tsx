import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Flame, ArrowUpRight, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Pack = {
  price_id: string;
  name: string;
  amount_cents: number;
  credits: number | null;
};

/**
 * Welcome-page promo: highlights the BEST bulk Coins pack first
 * and clearly shows the bonus Coins saved vs the smallest pack.
 */
export function CoinsBulkPromoCard() {
  const [packs, setPacks] = useState<Pack[]>([]);

  useEffect(() => {
    supabase
      .from("store_packs")
      .select("price_id,name,amount_cents,credits")
      .eq("active", true)
      .eq("recurring", false)
      .order("amount_cents", { ascending: true })
      .then(({ data }) => setPacks((data ?? []) as Pack[]));
  }, []);

  const valid = packs.filter((p) => p.credits && p.amount_cents > 0);
  if (valid.length < 2) return null;

  const baseline = valid[0]; // smallest = baseline £/coin
  const baseRate = baseline.credits! / baseline.amount_cents; // coins per cent

  const enriched = valid.map((p) => {
    const expected = Math.round(p.amount_cents * baseRate); // what you'd get at smallest pack rate
    const bonus = (p.credits ?? 0) - expected;
    const pct = expected > 0 ? Math.round((bonus / expected) * 100) : 0;
    return { ...p, bonus, pct };
  });

  // Best = highest absolute coin savings vs smallest pack
  const best = [...enriched].sort((a, b) => b.bonus - a.bonus)[0];
  const others = enriched.filter((p) => p.price_id !== best.price_id);

  return (
    <section className="relative max-w-5xl mx-auto px-5 sm:px-8 -mt-2 pb-10">
      <div className="relative overflow-hidden rounded-3xl border-2 border-yellow-300/60 bg-gradient-to-br from-[#1a1200] via-[#0a0700] to-[#000000] p-6 sm:p-8 shadow-[0_0_50px_-10px_rgba(255,200,0,0.55)]">
        <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,200,40,0.5),transparent)]" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,120,0,0.35),transparent)]" />

        <div className="relative grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
          {/* Best deal hero */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/70 bg-yellow-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.4em] font-black text-yellow-200">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              Best bulk deal
            </div>

            <h2 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-4xl md:text-5xl tracking-tight text-white [text-shadow:_0_0_24px_rgba(255,200,0,0.6)]">
              {best.name}
            </h2>

            <p className="mt-3 text-sm sm:text-base text-yellow-100/85 max-w-xl">
              Pay <span className="font-black text-white">£{(best.amount_cents / 100).toFixed(0)} ({Math.round(best.amount_cents / 100)} 🪙)</span>, walk away with{" "}
              <span className="font-black text-yellow-300">
                <Coins className="inline h-4 w-4 mb-0.5 mr-0.5 text-yellow-400" />
                {best.credits!.toLocaleString()} Coins 🪙
              </span>
              .
            </p>

            <div className="mt-5 inline-flex items-center gap-3 rounded-xl border-2 border-yellow-300/60 bg-black/60 px-4 py-3 shadow-[inset_0_0_18px_rgba(255,200,0,0.18)]">
              <Star className="h-5 w-5 text-yellow-300 fill-yellow-300" />
              <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-200/80 font-bold">You save</p>
                <p className="text-2xl font-black text-yellow-300">
                  +{best.bonus.toLocaleString()} Coins 🪙
                </p>
                <p className="text-[11px] text-yellow-100/70">
                  vs buying {Math.ceil(best.amount_cents / baseline.amount_cents)}× the {baseline.name} pack ({best.pct}% bonus)
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/store"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 px-6 py-3 text-[12px] uppercase tracking-[0.25em] font-black text-black shadow-[0_10px_40px_-10px_rgba(255,200,0,0.85)] hover:brightness-110 active:scale-[0.98]"
              >
                <Coins className="h-4 w-4" />
                Grab {best.name}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link to="/store" className="text-[11px] uppercase tracking-[0.3em] text-yellow-200/70 hover:text-yellow-100">
                See all packs →
              </Link>
            </div>
          </div>

          {/* Comparison ladder */}
          <div className="rounded-2xl border border-yellow-300/30 bg-black/50 p-4">
            <p className="text-[10px] uppercase tracking-[0.35em] font-bold text-yellow-200/80 mb-3">
              Bulk savings ladder
            </p>
            <ul className="space-y-2">
              {enriched.map((p) => {
                const isBest = p.price_id === best.price_id;
                const isBase = p.price_id === baseline.price_id;
                return (
                  <li
                    key={p.price_id}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-[12px] ${
                      isBest
                        ? "border-2 border-yellow-300 bg-yellow-400/10 text-white"
                        : "border border-yellow-300/20 bg-black/40 text-yellow-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">£{(p.amount_cents / 100).toFixed(0)}</span>
                      <span className="opacity-70">→</span>
                      <span className="font-black text-yellow-200">
                        {p.credits!.toLocaleString()} 🪙
                      </span>
                    </div>
                    <div className="text-[10px] font-bold">
                      {isBase ? (
                        <span className="text-yellow-200/60 uppercase tracking-widest">baseline</span>
                      ) : p.bonus > 0 ? (
                        <span className={isBest ? "text-yellow-300" : "text-emerald-300"}>
                          +{p.bonus} bonus
                        </span>
                      ) : (
                        <span className="text-yellow-200/60">—</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}