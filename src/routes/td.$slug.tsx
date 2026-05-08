import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ArrowLeft, BadgeCheck, Crown, ExternalLink, Loader2, Lock, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { runTradeScan, getTrc20Fees, getWhaleAlerts } from "@/lib/trade.functions";
import { LiveDataIcon } from "@/components/LiveDataIcon";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Portal = {
  id: string; slug: string; name: string; niche: string; vip: boolean;
  theme_config: any;
};

export const Route = createFileRoute("/td/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("portals")
      .select("id, slug, name, niche, vip, theme_config, kind")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || (data as any).kind !== "trade") throw notFound();
    return { portal: data as unknown as Portal };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.portal
      ? [
          { title: `${loaderData.portal.name} · 0G-TRADE Terminal` },
          { name: "description", content: `${loaderData.portal.niche} — live HFT signals on 0G-PORTAL.` },
        ]
      : [],
  }),
  component: TradeTerminal,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center bg-black text-cyan-200">
      <div><h1 className="text-2xl font-bold mb-2">Terminal offline</h1><p className="text-xs opacity-60">{error.message}</p></div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center" style={{ background: "radial-gradient(ellipse at center,#0a1530,#000)" }}>
      <div className="electric-border rounded-2xl p-10 bg-black/60">
        <div className="text-[10px] tracking-[0.5em] text-cyan-300/70 mb-2">// 0G-TRADE</div>
        <h1 className="font-mono text-5xl font-black text-cyan-200 animate-glitch">404</h1>
        <div className="mt-2 uppercase tracking-[0.3em]">Terminal not found</div>
        <Link to="/" className="mt-6 inline-block px-5 py-2 rounded-md bg-cyan-400 text-black text-xs font-bold tracking-widest">RETURN</Link>
      </div>
    </main>
  ),
});

function TradeTerminal() {
  const { portal } = Route.useLoaderData();
  const { user } = useAuth();
  const tc = portal.theme_config || {};
  const accent: string = tc.accent || "#39ff14";
  const secondary: string = tc.secondary || "#7df9ff";
  const tickers: string[] = Array.isArray(tc.tickers) && tc.tickers.length ? tc.tickers : ["BTC","ETH","TRX","USDT","SOL"];
  const assetClass: string = tc.assetClass || "Crypto";
  const risk: string = tc.risk || "Balanced";

  const scan = useServerFn(runTradeScan);
  const fetchFees = useServerFn(getTrc20Fees);
  const fetchWhales = useServerFn(getWhaleAlerts);
  const [scanning, setScanning] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [fees, setFees] = useState<any>(null);
  const [whales, setWhales] = useState<any>(null);
  const [whalesLoading, setWhalesLoading] = useState(false);

  useEffect(() => { fetchFees().then(setFees).catch(() => {}); }, [fetchFees]);

  const onScan = async () => {
    if (!user) { toast.error("Sign in to scan markets"); return; }
    setScanning(true);
    try {
      const r = await scan({ data: { slug: portal.slug } });
      setIntel(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Scan failed");
    } finally { setScanning(false); }
  };

  const onWhales = async () => {
    setWhalesLoading(true);
    try { setWhales(await fetchWhales({ data: undefined as any })); }
    catch (e: any) { toast.error(e?.message ?? "VIP only"); }
    finally { setWhalesLoading(false); }
  };

  const sigColor = intel?.signal === "BUY" ? "#00ff88" : intel?.signal === "SELL" ? "#ff3355" : "#ffcc00";

  return (
    <main
      className="relative min-h-screen text-cyan-100"
      style={{ background: tc.bgGradient || "linear-gradient(180deg,#05060a 0%,#0d1117 100%)", fontFamily: tc.fontFamily || "'JetBrains Mono', monospace" }}
    >
      {/* HFT grid backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 90%)",
        }}
      />
      <div className="scan-overlay" />

      {/* Top ticker tape */}
      <div className="relative border-y border-white/10 bg-black/70 overflow-hidden">
        <div className="ticker-tape py-2 text-xs uppercase tracking-[0.3em]" style={{ color: accent, textShadow: `0 0 8px ${accent}` }}>
          {Array.from({ length: 3 }).flatMap((_, k) =>
            tickers.map((t, i) => (
              <span key={`${k}-${i}`} className="px-6 inline-flex items-center gap-2">
                <span>{t}</span>
                <span style={{ color: i % 2 ? "#ff4d6d" : "#00ff88" }}>
                  {i % 2 ? "▼" : "▲"} {((Math.sin((Date.now()/1000) + i + k) + 1) * 1.4).toFixed(2)}%
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      <header className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-8 pb-4 flex items-center justify-between">
        <Link to="/" className="text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100 inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Mainframe</Link>
        <div className="flex items-center gap-3">
          <LiveDataIcon active={scanning} accent={accent} />
          <div className="text-[10px] tracking-[0.4em] opacity-60">{tc.label || `// ${assetClass.toUpperCase()} DESK`}</div>
        </div>
      </header>

      <section className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-2 pb-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-black text-4xl sm:text-6xl tracking-tight" style={{ color: "#fff", textShadow: `0 0 18px ${accent}66` }}>
              {portal.name}
            </h1>
            <p className="mt-2 text-xs uppercase tracking-[0.35em]" style={{ color: secondary }}>
              {assetClass} · {risk} · {tc.vibeLabel || tc.vibe || "Whale Watching"}
            </p>
          </div>
          <TerminalLogo accent={accent} tickers={tickers} />
        </div>

        {/* SCAN BUTTON */}
        <div className="rounded-2xl border bg-black/60 p-8 sm:p-12 text-center"
             style={{ borderColor: `${accent}55`, boxShadow: `0 0 60px -20px ${accent}` }}>
          <button
            onClick={onScan}
            disabled={scanning}
            className="relative inline-flex items-center justify-center px-12 py-6 rounded-xl text-xl sm:text-2xl font-black tracking-[0.3em] transition-transform active:scale-95 disabled:opacity-50"
            style={{ background: accent, color: "#000", boxShadow: `0 0 40px ${accent}, inset 0 0 20px rgba(0,0,0,0.2)` }}
          >
            {scanning ? <><Loader2 className="h-6 w-6 mr-3 animate-spin" /> SCANNING…</> : <><Activity className="h-6 w-6 mr-3" /> {tc.hitButton || "SCAN MARKETS"}</>}
          </button>
          <p className="mt-3 text-[10px] uppercase tracking-[0.4em] opacity-60">
            {intel?.isVip ? "REAL-TIME · UNLIMITED" : `FREE TIER · ${intel?.usedToday ?? 0}/${intel?.dailyLimit ?? 3} TODAY · 15-MIN DELAY`}
          </p>
        </div>

        {/* INTEL CARD */}
        <AnimatePresence>
          {intel && (
            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
              exit={{ opacity: 0 }}
              className="mt-6 rounded-2xl border bg-black/70 p-6 sm:p-8"
              style={{ borderColor: `${sigColor}66`, boxShadow: `0 0 50px -20px ${sigColor}` }}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] tracking-[0.4em] opacity-60">0G-TRADE SIGNAL</span>
                  {intel.delayed && <span className="text-[9px] px-2 py-0.5 border border-yellow-400/40 text-yellow-300 rounded-full uppercase tracking-widest">15min delayed</span>}
                </div>
                <span className="text-[10px] tracking-[0.3em] opacity-50">{new Date(intel.generatedAt).toLocaleTimeString()}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <div className="md:col-span-1 text-center md:text-left">
                  <div className="text-6xl font-black flex items-center gap-3" style={{ color: sigColor, textShadow: `0 0 24px ${sigColor}` }}>
                    {intel.signal === "BUY" ? <TrendingUp className="h-12 w-12" /> : intel.signal === "SELL" ? <TrendingDown className="h-12 w-12" /> : <Activity className="h-12 w-12" />}
                    {intel.signal}
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.3em] opacity-70">Confidence</div>
                  <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full" style={{ width: `${intel.confidence}%`, background: sigColor, boxShadow: `0 0 12px ${sigColor}` }} />
                  </div>
                  <div className="mt-1 text-2xl font-bold" style={{ color: sigColor }}>{intel.confidence}%</div>
                </div>
                <div className="md:col-span-2 space-y-3 text-sm">
                  <p className="leading-relaxed text-cyan-50">{intel.thesis}</p>
                  {intel.topMove && (
                    <div className="rounded-lg border border-white/10 p-3 bg-white/5">
                      <div className="text-[10px] uppercase tracking-[0.3em] opacity-60">Top Move</div>
                      <div className="mt-1 font-bold">{intel.topMove.ticker} <span className="opacity-70">·</span> <span style={{ color: sigColor }}>{intel.topMove.direction}</span></div>
                      <div className="text-xs opacity-80">{intel.topMove.edge}</div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Tag>Sentiment: {intel.sentiment}</Tag>
                    {(intel.riskFlags || []).map((f: string, i: number) => <Tag key={i} warn>⚠ {f}</Tag>)}
                  </div>
                  <div className="rounded-lg border border-white/10 p-3 bg-white/5">
                    <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 flex items-center gap-1"><Zap className="h-3 w-3" />Whale Activity</div>
                    <div className="mt-1 text-xs">{intel.whaleActivity}</div>
                  </div>
                  {intel.headlines?.length > 0 && (
                    <details className="text-xs opacity-80">
                      <summary className="cursor-pointer uppercase tracking-[0.3em] text-[10px] opacity-60">Source Feed ({intel.headlines.length})</summary>
                      <ul className="mt-2 space-y-1 list-disc pl-4">
                        {intel.headlines.map((h: string, i: number) => (
                          <li key={i}>{intel.sources?.[i] ? <a href={intel.sources[i]} target="_blank" rel="noreferrer" className="hover:underline">{h}</a> : h}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {(intel.verifiedSources?.length ?? 0) > 0 && (
                    <div className="rounded-lg border p-3" style={{ borderColor: `${accent}55`, background: `${accent}0d` }}>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="h-3.5 w-3.5" style={{ color: accent }} />
                          <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>
                            Verified Sources · Last Hour · {intel.verifiedSources.length}
                          </span>
                        </div>
                        {intel.peerReview && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] uppercase tracking-[0.25em]"
                            style={{
                              color: intel.peerReview.verdict === "verified" ? "#00ff88" : intel.peerReview.verdict === "partial" ? "#ffb020" : "#ff4d6d",
                              borderColor: (intel.peerReview.verdict === "verified" ? "#00ff88" : intel.peerReview.verdict === "partial" ? "#ffb020" : "#ff4d6d") + "66",
                            }}
                            title={intel.peerReview.notes}
                          >
                            Peer-Review · {intel.peerReview.verdict} · {intel.peerReview.confidence}%
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {intel.verifiedSources.slice(0, 12).map((s: any, i: number) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.25em] hover:opacity-100 opacity-90"
                            style={{ color: "#fff", borderColor: `${accent}55`, background: "rgba(0,0,0,0.4)" }}>
                            <BadgeCheck className="h-3 w-3" style={{ color: accent }} />
                            {s.source}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TRC20 FEE TRACKER */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/60 p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className="text-[10px] tracking-[0.4em] opacity-60">// USDT NETWORK FEE TRACKER</div>
              <h2 className="text-xl font-bold" style={{ color: accent }}>Cheapest USDT Route from Coinbase</h2>
            </div>
            {fees?.cheapest && (
              <div className="text-right">
                <div className="text-[10px] tracking-[0.3em] opacity-60">CHEAPEST</div>
                <div className="text-lg font-bold" style={{ color: "#00ff88" }}>{fees.cheapest.network} · ${fees.cheapest.totalUsd}</div>
              </div>
            )}
          </div>
          {!fees ? (
            <div className="text-xs opacity-60 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Fetching live network params…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.25em] opacity-60 border-b border-white/10">
                    <th className="text-left py-2 pr-2">Network</th>
                    <th className="text-right py-2 px-2">Coinbase Fee</th>
                    <th className="text-right py-2 px-2">On-Chain</th>
                    <th className="text-right py-2 px-2">Total</th>
                    <th className="text-right py-2 pl-2">Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.routes.map((r: any, i: number) => (
                    <tr key={r.network} className="border-b border-white/5">
                      <td className="py-2 pr-2 font-bold" style={{ color: i === 0 ? "#00ff88" : undefined }}>{i === 0 ? "★ " : ""}{r.network}</td>
                      <td className="py-2 px-2 text-right">${r.coinbaseFeeUsd.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">${r.networkFeeUsd.toFixed(4)}</td>
                      <td className="py-2 px-2 text-right font-bold" style={{ color: i === 0 ? "#00ff88" : "#fff" }}>${r.totalUsd.toFixed(4)}</td>
                      <td className="py-2 pl-2 text-right opacity-70">~{r.speedSec}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[10px] opacity-50">
                TRC20 burn calc · {fees.tron.energyPerUsdt.toLocaleString()} energy × {fees.tron.energyUnitPriceSun} sun = {fees.tron.tronBurnTrx} TRX (TRX/USD ${fees.tron.trxUsd}). Coinbase fees refreshed quarterly.
              </p>
            </div>
          )}
        </div>

        {/* WHALE ALERTS — VIP */}
        <div className="mt-6 rounded-2xl border bg-black/60 p-6"
             style={{ borderColor: "rgba(255,215,0,0.4)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-400" />
              <div>
                <div className="text-[10px] tracking-[0.4em] opacity-60">// VIP CHANNEL</div>
                <h2 className="text-xl font-bold text-yellow-300">Whale Alerts (Firecrawl Scout)</h2>
              </div>
            </div>
            <Button onClick={onWhales} disabled={whalesLoading} variant="outline" className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10">
              {whalesLoading ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Scouting…</> : <><Lock className="h-3 w-3 mr-2" />Pull Whale Feed</>}
            </Button>
          </div>
          {whales?.alerts?.length ? (
            <ul className="space-y-2 text-sm">
              {whales.alerts.map((a: any, i: number) => (
                <li key={i} className="rounded border border-white/10 p-3 bg-white/5">
                  <a href={a.url} target="_blank" rel="noreferrer" className="font-bold hover:underline text-yellow-100">{a.title}</a>
                  {a.snippet && <div className="text-xs opacity-70 mt-1">{a.snippet}</div>}
                </li>
              ))}
            </ul>
          ) : whales ? (
            <p className="text-xs opacity-60">No whale activity surfaced.</p>
          ) : (
            <p className="text-xs opacity-60">VIP unlocks live large-wallet flow alerts.</p>
          )}
        </div>
      </section>

      <footer className="relative max-w-6xl mx-auto px-5 sm:px-8 pb-12 text-[10px] tracking-[0.4em] uppercase opacity-50 text-center">
        0G-PORTAL · TradeHUB Terminal · Not financial advice
      </footer>

      <style>{`
        .ticker-tape { display: flex; white-space: nowrap; animation: ticker 38s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
        @media (max-width: 768px) { .ticker-tape { animation-duration: 60s; } }
        @media (prefers-reduced-motion: reduce) { .ticker-tape { animation: none; } }
      `}</style>
    </main>
  );
}

function Tag({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={`inline-block text-[10px] uppercase tracking-[0.25em] px-2 py-0.5 rounded-full border ${warn ? "border-red-400/50 text-red-300" : "border-white/15 text-white/70"}`}>
      {children}
    </span>
  );
}

function TerminalLogo({ accent, tickers }: { accent: string; tickers: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % tickers.length), 1200);
    return () => clearInterval(t);
  }, [tickers.length]);
  return (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border bg-black overflow-hidden flex flex-col items-center justify-center"
         style={{ borderColor: `${accent}66`, boxShadow: `0 0 24px -8px ${accent}` }}>
      <div className="absolute inset-0 opacity-30"
           style={{ backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px)`, backgroundSize: "100% 6px" }} />
      <div className="text-[9px] tracking-[0.3em] opacity-60">0G-TRADE</div>
      <div className="font-mono font-black text-2xl mt-1" style={{ color: accent, textShadow: `0 0 12px ${accent}` }}>
        {tickers[i]}
      </div>
      <div className="text-[10px] mt-1" style={{ color: "#00ff88" }}>▲ {(((i + 1) * 1.7) % 9).toFixed(2)}%</div>
    </div>
  );
}