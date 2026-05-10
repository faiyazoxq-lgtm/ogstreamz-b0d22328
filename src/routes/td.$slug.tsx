import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ArrowLeft, BadgeCheck, Crown, ExternalLink, FileText, Loader2, Lock, Radio, Send, ShieldAlert, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { runTradeScan, getTrc20Fees, getWhaleAlerts, emitTradeSignal } from "@/lib/trade.functions";
import { bundleAndBroadcastSignal, pollVeoBundle } from "@/lib/signal-mesh.functions";
import { LiveDataIcon } from "@/components/LiveDataIcon";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Portal = {
  id: string; slug: string; name: string; niche: string; vip: boolean;
  theme_config: any;
  jokes: string[] | null;
};

// ── Executive Slate & Gold palette
const SLATE = "#121417";
const SLATE_2 = "#1a1d23";
const GOLD = "#D4AF37";
const EMERALD = "#10B981";
const CRIMSON = "#EF4444";

export const Route = createFileRoute("/td/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("portals")
      .select("id, slug, name, niche, vip, theme_config, kind, jokes")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || (data as any).kind !== "trade") throw notFound();
    return { portal: data as unknown as Portal };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.portal
      ? [
          { title: `${loaderData.portal.name} · 0G-TRADE Executive Terminal` },
          { name: "description", content: `${loaderData.portal.niche} — Slate & Gold executive trading intelligence on 0G-PORTAL.` },
        ]
      : [],
  }),
  component: TradeTerminal,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center" style={{ background: SLATE, color: GOLD }}>
      <div><h1 className="text-2xl font-bold mb-2">Terminal offline</h1><p className="text-xs opacity-60">{error.message}</p></div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center" style={{ background: SLATE }}>
      <div className="rounded-2xl p-10 border" style={{ borderColor: `${GOLD}55`, background: "rgba(0,0,0,0.5)" }}>
        <div className="text-[10px] tracking-[0.5em] mb-2" style={{ color: GOLD }}>// 0G-TRADE</div>
        <h1 className="font-mono text-5xl font-black" style={{ color: GOLD }}>404</h1>
        <div className="mt-2 uppercase tracking-[0.3em] text-white/70">Terminal not found</div>
        <Link to="/" className="mt-6 inline-block px-5 py-2 rounded-md text-xs font-bold tracking-widest" style={{ background: GOLD, color: SLATE }}>RETURN</Link>
      </div>
    </main>
  ),
});

function TradeTerminal() {
  const { portal } = Route.useLoaderData();
  const { user } = useAuth();
  const tc = portal.theme_config || {};
  const tickers: string[] = Array.isArray(tc.tickers) && tc.tickers.length ? tc.tickers : ["XAU/USD","BTC","ETH"];
  const assetClass: string = tc.assetClass || "Crypto";
  const risk: string = tc.risk || "Balanced";
  const isGold = /gold|xau/i.test(portal.name) || tickers.some(t => /xau|gold/i.test(t));
  const briefs: string[] = Array.isArray(portal.jokes)
    ? portal.jokes.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    : [];

  const scan = useServerFn(runTradeScan);
  const fetchFees = useServerFn(getTrc20Fees);
  const fetchWhales = useServerFn(getWhaleAlerts);
  const emit = useServerFn(emitTradeSignal);
  const bundleFn = useServerFn(bundleAndBroadcastSignal);
  const pollVeoFn = useServerFn(pollVeoBundle);

  const [scanning, setScanning] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [fees, setFees] = useState<any>(null);
  const [whales, setWhales] = useState<any>(null);
  const [whalesLoading, setWhalesLoading] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [bundling, setBundling] = useState(false);
  const [bundle, setBundle] = useState<{ bundleId: string; veoOperation: string | null } | null>(null);
  const [polling, setPolling] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { fetchFees().then(setFees).catch(() => {}); }, [fetchFees]);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role","admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const onScan = async () => {
    if (!user) { toast.error("Sign in to scan markets"); return; }
    setScanning(true);
    try { setIntel(await scan({ data: { slug: portal.slug } })); }
    catch (e: any) { toast.error(e?.message ?? "Scan failed"); }
    finally { setScanning(false); }
  };

  const onWhales = async () => {
    setWhalesLoading(true);
    try { setWhales(await fetchWhales({ data: undefined as any })); }
    catch (e: any) { toast.error(e?.message ?? "VIP only"); }
    finally { setWhalesLoading(false); }
  };

  const onEmit = async () => {
    if (!isAdmin) { toast.error("Boss-only signal emission"); return; }
    setEmitting(true);
    try {
      const r = await emit({ data: { slug: portal.slug } });
      toast.success(`Syndicate signal broadcast · msg #${r.message_id ?? "—"}`);
      if (r.intel) setIntel(r.intel);
    } catch (e: any) { toast.error(e?.message ?? "Emit failed"); }
    finally { setEmitting(false); }
  };

  const onBundle = async () => {
    if (!isAdmin) { toast.error("Boss-only bundle broadcast"); return; }
    setBundling(true);
    try {
      const r = await bundleFn({ data: { slug: portal.slug } });
      toast.success(`Bundle live in ${r.channel} · anthem & cinematic queued`);
      setBundle({ bundleId: r.bundleId, veoOperation: r.veoOperation });
    } catch (e: any) { toast.error(e?.message ?? "Bundle failed"); }
    finally { setBundling(false); }
  };

  const onPollVeo = async () => {
    if (!bundle) return;
    setPolling(true);
    try {
      const r: any = await pollVeoFn({ data: { bundleId: bundle.bundleId } });
      if (r.ready) toast.success("Cinematic ticker posted to VIP channel");
      else toast.message(`Veo still rendering — try again in ~30s`);
    } catch (e: any) { toast.error(e?.message ?? "Poll failed"); }
    finally { setPolling(false); }
  };

  // bias score: -100 (bearish) → +100 (bullish)
  const biasScore: number = typeof intel?.biasScore === "number" ? intel.biasScore : 0;
  const biasPct = (biasScore + 100) / 2; // 0..100

  const px = intel?.price?.value;
  const change = intel?.price?.change24hPct;
  const upish = typeof change === "number" ? change >= 0 : intel?.signal === "BUY";
  const priceColor = upish ? EMERALD : CRIMSON;

  return (
    <main className="relative min-h-screen text-white" style={{ background: `radial-gradient(ellipse at top, #1a1d23 0%, ${SLATE} 70%)`, fontFamily: "'Inter','JetBrains Mono',monospace" }}>
      {isGold && <GoldDust />}
      {/* Subtle slate grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: `linear-gradient(${GOLD}33 1px,transparent 1px),linear-gradient(90deg,${GOLD}33 1px,transparent 1px)`, backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at center,black 30%,transparent 90%)" }} />

      <header className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-6 pb-3 flex items-center justify-between">
        <Link to="/" className="text-[10px] uppercase tracking-[0.4em] opacity-60 hover:opacity-100 inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Mainframe</Link>
        <div className="flex items-center gap-3">
          <LiveDataIcon active={scanning} accent={GOLD} />
          <div className="text-[10px] tracking-[0.4em] opacity-60">// {assetClass.toUpperCase()} · {risk.toUpperCase()} · WAR ROOM</div>
        </div>
      </header>

      <section className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-2 pb-8">
        {/* Title row */}
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="text-[10px] tracking-[0.5em]" style={{ color: GOLD }}>EXECUTIVE TERMINAL</div>
            <h1 className="font-black text-3xl sm:text-5xl tracking-tight mt-1" style={{ color: "#fff", textShadow: `0 0 24px ${GOLD}33` }}>{portal.name}</h1>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onEmit}
                disabled={emitting || !intel}
                className="group relative inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black tracking-[0.3em] uppercase transition-transform active:scale-95 disabled:opacity-40"
                style={{ background: GOLD, color: SLATE, boxShadow: `0 0 32px ${GOLD}aa, inset 0 0 12px rgba(0,0,0,0.15)` }}
                title={intel ? "Broadcast to Syndicate" : "Run a scan first"}
              >
                {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Emit Signal
              </button>
              <button
                onClick={onBundle}
                disabled={bundling}
                className="group relative inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black tracking-[0.3em] uppercase transition-transform active:scale-95 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg,${EMERALD},${GOLD})`, color: SLATE, boxShadow: `0 0 32px ${EMERALD}aa` }}
                title="Trade + Anthem + Cinematic → @og_portal"
              >
                {bundling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                Bundle & Broadcast
              </button>
              {bundle && (
                <button
                  onClick={onPollVeo}
                  disabled={polling}
                  className="inline-flex items-center gap-2 px-3 py-3 rounded-xl text-[10px] font-black tracking-[0.3em] uppercase border disabled:opacity-40"
                  style={{ borderColor: `${GOLD}66`, color: GOLD, background: "rgba(0,0,0,0.4)" }}
                  title="Check Veo render & post"
                >
                  {polling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                  Finalize Cinematic
                </button>
              )}
            </div>
          )}
        </div>

        {/* GLANCE HEADER — massive glowing price */}
        <div className="rounded-2xl border p-6 sm:p-8 mb-5" style={{ borderColor: `${GOLD}44`, background: "rgba(10,12,15,0.7)", boxShadow: `0 0 48px -20px ${GOLD}` }}>
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div>
              <div className="text-[10px] tracking-[0.5em] opacity-60">{intel?.price?.primaryTicker || tickers[0]}</div>
              <div
                className="font-black tabular-nums leading-none mt-2"
                style={{
                  fontSize: "clamp(48px, 9vw, 112px)",
                  color: "#fff",
                  textShadow: px ? (upish ? `0 0 28px ${EMERALD}, 0 0 60px ${EMERALD}55` : `0 0 28px ${CRIMSON}, 0 0 60px ${CRIMSON}55`) : `0 0 16px ${GOLD}55`,
                  animation: px && !upish ? "crimsonPulse 1.6s ease-in-out infinite" : undefined,
                }}
              >
                {px ? `$${Number(px).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—.—"}
              </div>
              {typeof change === "number" && (
                <div className="mt-2 inline-flex items-center gap-2 text-lg font-bold" style={{ color: priceColor }}>
                  {upish ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}% <span className="text-xs opacity-60 font-normal">24h</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-[0.4em] opacity-60">SCAN STATUS</div>
              <div className="text-sm mt-1">{intel ? new Date(intel.generatedAt).toLocaleTimeString() : "Awaiting first scan"}</div>
              <Button onClick={onScan} disabled={scanning} className="mt-3" style={{ background: GOLD, color: SLATE }}>
                {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scanning…</> : <><Activity className="h-4 w-4 mr-2" />Run Market Scan</>}
              </Button>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] opacity-50">
                {intel?.isVip ? "REAL-TIME · UNLIMITED" : `FREE · ${intel?.usedToday ?? 0}/${intel?.dailyLimit ?? 3} TODAY`}
              </p>
            </div>
          </div>
        </div>

        {/* BIAS METER */}
        <div className="rounded-2xl border p-5 mb-5" style={{ borderColor: `${GOLD}33`, background: "rgba(0,0,0,0.5)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] tracking-[0.5em] opacity-70">// 0G-AGENT BIAS METER</div>
            <div className="text-xs font-bold" style={{ color: biasScore > 15 ? EMERALD : biasScore < -15 ? CRIMSON : GOLD }}>
              {intel?.sentiment || "—"} · {biasScore > 0 ? "+" : ""}{biasScore}
            </div>
          </div>
          <div className="relative h-4 rounded-full overflow-hidden" style={{ background: `linear-gradient(90deg, ${CRIMSON}, ${SLATE_2} 50%, ${EMERALD})` }}>
            <div className="absolute inset-y-0 w-[2px] bg-white/20" style={{ left: "50%" }} />
            <motion.div
              initial={false}
              animate={{ left: `${biasPct}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 15 }}
              className="absolute -top-1 -translate-x-1/2 h-6 w-1 rounded"
              style={{ background: "#fff", boxShadow: `0 0 12px #fff, 0 0 24px ${biasScore >= 0 ? EMERALD : CRIMSON}` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] tracking-[0.3em] uppercase">
            <span style={{ color: CRIMSON }}>◀ Bearish</span>
            <span className="opacity-50">Neutral</span>
            <span style={{ color: EMERALD }}>Bullish ▶</span>
          </div>
        </div>

        {/* DECISIVE FACTS — Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <BentoStat label="Resistance" value={intel?.levels?.resistance} subtitle="Critical Test" color={GOLD} prefix="$" />
          <BentoStat label="Structural Base" value={intel?.levels?.support} subtitle="Trend Floor" color={EMERALD} prefix="$" />
          <BentoStat
            label="Volatility"
            valueText={intel?.volatilityIndex || "—"}
            subtitle={intel?.volatilityCatalyst || "Awaiting scan"}
            color={intel?.volatilityIndex === "HIGH" ? CRIMSON : intel?.volatilityIndex === "LOW" ? EMERALD : GOLD}
          />
          <BentoStat label="Confidence" value={intel?.confidence} subtitle={`Signal: ${intel?.signal || "—"}`} color={GOLD} suffix="%" />
        </div>

        {/* SENTIMENT BRIEFS — generated at spawn time */}
        {briefs.length > 0 && (
          <div className="rounded-2xl border p-5 sm:p-6 mb-5" style={{ borderColor: `${GOLD}44`, background: "rgba(0,0,0,0.55)", boxShadow: `0 0 60px -28px ${GOLD}` }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: GOLD }} />
                <div>
                  <div className="text-[10px] tracking-[0.4em] opacity-70">// SENTIMENT-ONLY TRADE BRIEFS</div>
                  <h2 className="text-lg font-bold" style={{ color: GOLD }}>{portal.name} · Setup Notes</h2>
                </div>
              </div>
              <span className="text-[9px] px-2 py-0.5 border rounded-full uppercase tracking-widest" style={{ borderColor: `${GOLD}66`, color: GOLD }}>
                {briefs.length} brief{briefs.length === 1 ? "" : "s"}
              </span>
            </div>
            <ol className="space-y-3">
              {briefs.map((b, i) => (
                <li
                  key={i}
                  className="rounded-xl border p-4 flex gap-3 items-start"
                  style={{ borderColor: `${GOLD}33`, background: "rgba(0,0,0,0.45)" }}
                >
                  <span
                    className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full font-black text-[11px] tabular-nums"
                    style={{ background: GOLD, color: SLATE, boxShadow: `0 0 18px -4px ${GOLD}` }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm leading-relaxed text-white/90 whitespace-pre-line">{b}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[10px] uppercase tracking-[0.3em] opacity-50 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Sentiment only — not financial advice.
            </p>
          </div>
        )}

        {/* FACT CARDS — Punchy */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {(intel?.factCards?.length ? intel.factCards : [
            { headline: "Run a scan to surface live Perplexity intelligence." },
            { headline: "0G-Agent will distill catalysts into 14-word punch facts." },
            { headline: "Verified peer-review pings will appear after scan." },
          ]).slice(0, 3).map((f: any, i: number) => (
            <div key={i} className="rounded-2xl border p-4" style={{ borderColor: `${GOLD}33`, background: "rgba(0,0,0,0.55)" }}>
              <div className="text-[10px] tracking-[0.4em] mb-2" style={{ color: GOLD }}>FACT · {String(i+1).padStart(2,"0")}</div>
              <div className="text-base font-bold leading-snug">{f.headline}</div>
            </div>
          ))}
        </div>

        {/* INTEL CARD — thesis + sources */}
        <AnimatePresence>
          {intel && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl border p-6 mb-5"
              style={{ borderColor: `${GOLD}44`, background: "rgba(0,0,0,0.6)", boxShadow: `0 0 60px -28px ${GOLD}` }}
            >
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4" style={{ color: GOLD }} />
                  <span className="text-[10px] tracking-[0.4em] opacity-70">0G-TRADE THESIS</span>
                  {intel.delayed && <span className="text-[9px] px-2 py-0.5 border rounded-full uppercase tracking-widest" style={{ borderColor: `${GOLD}66`, color: GOLD }}>15min delayed</span>}
                </div>
                <div className="text-2xl font-black" style={{ color: intel.signal === "BUY" ? EMERALD : intel.signal === "SELL" ? CRIMSON : GOLD }}>
                  {intel.signal}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-white/90">{intel.thesis}</p>
              {intel.topMove && (
                <div className="mt-3 rounded-lg border border-white/10 p-3 bg-white/5 text-sm">
                  <span className="text-[10px] uppercase tracking-[0.3em] opacity-60">Top Move · </span>
                  <span className="font-bold">{intel.topMove.ticker}</span> · <span style={{ color: GOLD }}>{intel.topMove.direction}</span>
                  <div className="text-xs opacity-80 mt-1">{intel.topMove.edge}</div>
                </div>
              )}
              <div className="mt-3 rounded-lg border border-white/10 p-3 bg-white/5">
                <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 flex items-center gap-1"><Zap className="h-3 w-3" />Liquidity Pulse · TRC20 Whale Flow</div>
                <div className="mt-1 text-xs">{intel.whaleActivity}</div>
              </div>
              {(intel.verifiedSources?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {intel.verifiedSources.slice(0, 8).map((s: any, i: number) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.25em]" style={{ borderColor: `${GOLD}55`, background: "rgba(0,0,0,0.5)" }}>
                      <BadgeCheck className="h-3 w-3" style={{ color: GOLD }} />{s.source}<ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* TRC20 FEES (kept) */}
        {fees && (
          <details className="rounded-2xl border p-5 mb-5" style={{ borderColor: `${GOLD}22`, background: "rgba(0,0,0,0.4)" }}>
            <summary className="cursor-pointer text-xs tracking-[0.3em] uppercase" style={{ color: GOLD }}>USDT Network Fee Tracker · Cheapest: {fees.cheapest?.network} · ${fees.cheapest?.totalUsd}</summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs">
                <thead><tr className="text-[10px] uppercase tracking-[0.25em] opacity-60 border-b border-white/10">
                  <th className="text-left py-2 pr-2">Network</th><th className="text-right py-2 px-2">Coinbase</th><th className="text-right py-2 px-2">On-Chain</th><th className="text-right py-2 px-2">Total</th><th className="text-right py-2 pl-2">Speed</th>
                </tr></thead>
                <tbody>{fees.routes.map((r: any, i: number) => (
                  <tr key={r.network} className="border-b border-white/5">
                    <td className="py-2 pr-2 font-bold" style={{ color: i === 0 ? EMERALD : undefined }}>{i === 0 ? "★ " : ""}{r.network}</td>
                    <td className="py-2 px-2 text-right">${r.coinbaseFeeUsd.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">${r.networkFeeUsd.toFixed(4)}</td>
                    <td className="py-2 px-2 text-right font-bold" style={{ color: i === 0 ? EMERALD : "#fff" }}>${r.totalUsd.toFixed(4)}</td>
                    <td className="py-2 pl-2 text-right opacity-70">~{r.speedSec}s</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        )}

        {/* WHALE VIP (kept, restyled) */}
        <div className="rounded-2xl border p-5" style={{ borderColor: `${GOLD}44`, background: "rgba(0,0,0,0.45)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4" style={{ color: GOLD }} />
              <div>
                <div className="text-[10px] tracking-[0.4em] opacity-60">// VIP CHANNEL</div>
                <h2 className="text-lg font-bold" style={{ color: GOLD }}>Whale Alerts (Firecrawl Scout)</h2>
              </div>
            </div>
            <Button onClick={onWhales} disabled={whalesLoading} variant="outline" style={{ borderColor: `${GOLD}66`, color: GOLD }}>
              {whalesLoading ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Scouting…</> : <><Lock className="h-3 w-3 mr-2" />Pull Whale Feed</>}
            </Button>
          </div>
          {whales?.alerts?.length ? (
            <ul className="space-y-2 text-sm">
              {whales.alerts.map((a: any, i: number) => (
                <li key={i} className="rounded border border-white/10 p-3 bg-white/5">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: GOLD }}>{a.title}</a>
                  {a.snippet && <div className="text-xs opacity-70 mt-1">{a.snippet}</div>}
                </li>
              ))}
            </ul>
          ) : whales ? <p className="text-xs opacity-60">No whale activity surfaced.</p> : <p className="text-xs opacity-60">VIP unlocks live large-wallet flow alerts.</p>}
        </div>
      </section>

      {/* PINNED RISK DISCLOSURE BADGE */}
      <div className="sticky bottom-3 z-30 mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-md text-[10px] uppercase tracking-[0.3em]"
             style={{ borderColor: `${GOLD}55`, background: "rgba(10,12,15,0.85)", color: GOLD, boxShadow: `0 0 24px -10px ${GOLD}` }}>
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Risk Disclosure · Not Financial Advice · Markets carry capital loss risk · 0G-PORTAL TradeHUB</span>
        </div>
      </div>

      <div className="h-16" />

      <style>{`
        @keyframes crimsonPulse {
          0%, 100% { text-shadow: 0 0 28px ${CRIMSON}, 0 0 60px ${CRIMSON}55; }
          50% { text-shadow: 0 0 44px ${CRIMSON}, 0 0 90px ${CRIMSON}aa; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="crimsonPulse"] { animation: none !important; }
        }
      `}</style>
    </main>
  );
}

function BentoStat({ label, value, valueText, subtitle, color, prefix = "", suffix = "" }: { label: string; value?: number | null; valueText?: string; subtitle?: string; color: string; prefix?: string; suffix?: string }) {
  const display = valueText ?? (typeof value === "number" ? `${prefix}${value.toLocaleString()}${suffix}` : "—");
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: `${color}44`, background: "rgba(0,0,0,0.55)", boxShadow: `0 0 28px -20px ${color}` }}>
      <div className="text-[10px] tracking-[0.4em] uppercase opacity-60">{label}</div>
      <div className="font-black tabular-nums mt-2" style={{ color, fontSize: "clamp(22px,3.6vw,38px)", textShadow: `0 0 16px ${color}55` }}>{display}</div>
      {subtitle && <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 mt-1">{subtitle}</div>}
    </div>
  );
}

// Animated gold-dust particles for Gold portals
function GoldDust() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const N = window.innerWidth < 600 ? 50 : 110;
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: (Math.random() * 1.6 + 0.4) * dpr,
      vy: -(Math.random() * 0.25 + 0.05) * dpr,
      vx: (Math.random() - 0.5) * 0.15 * dpr,
      a: Math.random() * 0.6 + 0.2,
    }));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        if (!reduce) { p.x += p.vx; p.y += p.vy; }
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10 || p.x > canvas.width + 10) p.x = Math.random() * canvas.width;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,175,55,${p.a})`;
        ctx.shadowColor = "rgba(212,175,55,0.8)";
        ctx.shadowBlur = 8 * dpr;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}
