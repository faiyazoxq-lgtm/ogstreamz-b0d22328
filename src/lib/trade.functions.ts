import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runDeepSearch, runPeerReview } from "./orchestrator.functions";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "trade";
}

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role","admin").maybeSingle();
  return !!data;
}

function pplxKey(): string {
  const k = process.env.PERPLEXITY_API_KEY;
  if (!k) throw new Error("PERPLEXITY_API_KEY missing");
  return k;
}

// ────────── SPAWN TRADE PORTAL ──────────
export const spawnTradePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; assetClass: "Crypto"|"Forex"|"Stocks"; risk: "Degen"|"Balanced"|"Safe"; vibe: string; vip?: boolean }) => ({
    name: String(d.name||"").trim().slice(0,80),
    assetClass: (["Crypto","Forex","Stocks"] as const).includes(d.assetClass) ? d.assetClass : "Crypto",
    risk: (["Degen","Balanced","Safe"] as const).includes(d.risk) ? d.risk : "Balanced",
    vibe: String(d.vibe||"").trim().slice(0,160),
    vip: !!d.vip,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Boss only — admins can spawn trade portals");
    if (!data.name) throw new Error("Name required");

    const PERPLEXITY = pplxKey();

    // Creative Director — HFT terminal aesthetic seeded by risk level
    const riskAccent = data.risk === "Degen" ? "#ff0066" : data.risk === "Safe" ? "#00ff88" : "#39ff14";
    const directorPrompt = `0G-PORTAL Creative Director: produce a HFT-trading-terminal visual identity.
Brief: name="${data.name}", assetClass="${data.assetClass}", risk="${data.risk}", vibe="${data.vibe||"Whale Watching"}".
Aesthetic: dark charcoal background, neon ticker text, scrolling grid lines.
Return STRICT JSON only:
{
  "vibeLabel": "2-3 word visual vibe",
  "bgGradient": "linear-gradient(180deg,#0a0a0c 0%,#11151c 100%)",
  "accent": "#hex (neon green/red based on risk)",
  "secondary": "#hex",
  "text": "#e6ffe6",
  "fontPair": { "heading": "JetBrains Mono", "body": "IBM Plex Mono" },
  "fontFamily": "'JetBrains Mono', monospace",
  "ornament": "▲|▼|◆",
  "label": "ALL-CAPS terminal callsign",
  "animation": "pulse",
  "hitButton": "SCAN MARKETS",
  "particleColors": ["#hex","#hex","#hex"],
  "tickers": ["BTC","ETH","TRX","USDT","SOL"]
}`;
    let themeConfig: any = {
      bgGradient: "linear-gradient(180deg,#05060a 0%,#0d1117 100%)",
      accent: riskAccent, secondary: "#7df9ff", text: "#e6ffe6",
      fontFamily: "'JetBrains Mono', monospace",
      fontPair: { heading: "JetBrains Mono", body: "IBM Plex Mono" },
      ornament: data.risk === "Degen" ? "▲" : "◆",
      label: `// ${data.assetClass.toUpperCase()} DESK`,
      animation: "pulse",
      hitButton: "SCAN MARKETS",
      particleColors: [riskAccent, "#7df9ff", "#ffffff"],
      vibeLabel: data.vibe || "HFT Terminal",
      tickers: data.assetClass === "Crypto" ? ["BTC","ETH","TRX","USDT","SOL","XRP"]
              : data.assetClass === "Forex" ? ["EUR/USD","GBP/USD","USD/JPY","USD/TRY","XAU/USD"]
              : ["AAPL","TSLA","NVDA","MSFT","SPY"],
    };
    try {
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: "Return strict JSON only." },
            { role: "user", content: directorPrompt },
          ],
          temperature: 0.5, max_tokens: 600,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const raw: string = j?.choices?.[0]?.message?.content ?? "{}";
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          themeConfig = { ...themeConfig, ...parsed };
        }
      }
    } catch { /* keep fallback */ }

    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    const { data: existing } = await supabase.from("portals").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;

    const { data: portal, error } = await supabase.from("portals").insert({
      slug, name: data.name,
      niche: `${data.assetClass} · ${data.risk} · ${data.vibe || "Whale Watching"}`,
      language: "English", vibe: data.vibe || "Whale Watching",
      theme: "cyber", vip: data.vip,
      kind: "trade",
      theme_config: { ...themeConfig, assetClass: data.assetClass, risk: data.risk },
      jokes: [],
      created_by: userId,
    }).select("id, slug, name, theme, vip").single();
    if (error) throw new Error(error.message);
    return { portal };
  });

// ────────── RUN MARKET SCAN ──────────
export const runTradeScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug||"").trim().slice(0,80) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any; userId: string };
    const { data: portal } = await supabase
      .from("portals")
      .select("id, slug, name, niche, theme_config, kind")
      .eq("slug", data.slug).maybeSingle();
    if (!portal || portal.kind !== "trade") throw new Error("Trade portal not found");

    const tc = portal.theme_config || {};
    const assetClass: string = tc.assetClass || "Crypto";
    const risk: string = tc.risk || "Balanced";
    const tickers: string[] = Array.isArray(tc.tickers) ? tc.tickers.slice(0, 6) : ["BTC","ETH","TRX"];

    const PERPLEXITY = pplxKey();
    const FIRECRAWL = process.env.FIRECRAWL_API_KEY;

    // 1. Firecrawl: scrape live news/social sentiment
    let headlines: string[] = [];
    let sources: string[] = [];
    if (FIRECRAWL) {
      try {
        const fc = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `${assetClass} ${tickers.join(" ")} news sentiment last hour`,
            limit: 6,
          }),
        });
        if (fc.ok) {
          const j = await fc.json();
          const arr: any[] = j?.data?.web ?? j?.data ?? [];
          headlines = arr.map((x: any) => x.title).filter(Boolean).slice(0, 6);
          sources = arr.map((x: any) => x.url).filter(Boolean).slice(0, 6);
        }
      } catch { /* non-fatal */ }
    }

    // 2. Perplexity: synthesize 0G-Trade Signal
    const sigPrompt = `You are 0G-PORTAL's Trade Signal Agent. Analyze the live ${assetClass} market for: ${tickers.join(", ")}.
Risk profile: ${risk}.
${headlines.length ? `Latest headlines:\n- ${headlines.join("\n- ")}` : "Use your real-time search."}

Return STRICT JSON only:
{
  "signal": "BUY|SELL|HOLD",
  "confidence": 0-100,
  "thesis": "2 sentence sharp punchy rationale",
  "topMove": { "ticker": "string", "direction": "LONG|SHORT|FLAT", "edge": "1 sentence" },
  "sentiment": "BULLISH|BEARISH|MIXED",
  "whaleActivity": "1 sentence on large wallet flows",
  "riskFlags": ["short flag", "short flag"]
}`;
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "Output strict JSON only." },
          { role: "user", content: sigPrompt },
        ],
        temperature: 0.4, max_tokens: 600,
        search_recency_filter: "day",
      }),
    });
    if (!r.ok) throw new Error(`Perplexity ${r.status}`);
    const j = await r.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    let signal: any = {};
    try { signal = JSON.parse(m ? m[0] : raw); } catch { /* */ }
    const sig = String(signal.signal || "HOLD").toUpperCase();
    const conf = Math.max(0, Math.min(100, Number(signal.confidence ?? 50)));

    // 2b. 0G-BRAIN deep_search — last-hour citations + peer-review
    const deepQ = `${assetClass} ${tickers.join(", ")} market-moving news, whale flows, and price catalysts in the last hour. Cite at least 5 sources.`;
    const deep = await runDeepSearch({ query: deepQ, recency: "hour", minSources: 5 }).catch((e) => {
      console.error("trade deep_search failed", e?.message);
      return null;
    });
    const review = deep
      ? await runPeerReview({
          topic: `${assetClass} signal ${sig}`,
          analysis: `Signal=${sig} Conf=${conf}\nThesis: ${signal.thesis ?? ""}\nTopMove: ${JSON.stringify(signal.topMove ?? {})}\nSentiment: ${signal.sentiment ?? ""}`,
          evidence: deep,
        }).catch(() => undefined)
      : undefined;

    // 3. Apply rate-limit + record (RPC enforces 3/day for free)
    const { data: rl, error: rlErr } = await supabase.rpc("apply_trade_scan", {
      _portal_slug: portal.slug,
      _asset_class: assetClass,
      _signal: sig,
      _confidence: conf,
      _payload: { signal, headlines, sources, tickers, citations: deep?.citations ?? [], verified_sources: deep?.verified_sources ?? [], peer_review: review ?? null },
      _delayed: false, // set after we know vip status from RPC
    });
    if (rlErr) throw new Error(rlErr.message);
    const isVip = !!(rl?.is_vip);
    const delayed = !isVip;

    // 4. For free users, mask the freshest data
    if (delayed && Array.isArray(headlines)) {
      headlines = headlines.slice(2); // drop top 2 freshest
    }

    return {
      signal: sig, confidence: conf,
      thesis: signal.thesis || "Signal generated.",
      topMove: signal.topMove || null,
      sentiment: signal.sentiment || "MIXED",
      whaleActivity: isVip ? (signal.whaleActivity || null) : "🔒 Whale flows are VIP-only.",
      riskFlags: Array.isArray(signal.riskFlags) ? signal.riskFlags.slice(0,4) : [],
      headlines, sources,
      citations: deep?.citations ?? [],
      verifiedSources: deep?.verified_sources ?? [],
      peerReview: review ?? null,
      delayed, isVip,
      usedToday: rl?.used_today ?? null, dailyLimit: rl?.daily_limit ?? null,
      generatedAt: new Date().toISOString(),
    };
  });

// ────────── TRC20 NETWORK FEE TRACKER ──────────
export const getTrc20Fees = createServerFn({ method: "POST" })
  .handler(async () => {
    // Public TronGrid endpoint — no key needed for chain params
    let energyPerUsdt = 65000; // typical USDT TRC20 transfer to non-activated wallet
    let energyUnitPriceSun = 420; // sun (1 TRX = 1e6 sun); fallback
    let bandwidthBytes = 345;
    let trxUsd = 0.13; // fallback
    try {
      const cp = await fetch("https://api.trongrid.io/wallet/getchainparameters");
      if (cp.ok) {
        const j = await cp.json();
        const params: any[] = j?.chainParameter ?? [];
        const ep = params.find((p: any) => p.key === "getEnergyFee");
        if (ep?.value) energyUnitPriceSun = Number(ep.value);
      }
    } catch { /* */ }
    try {
      const px = await fetch("https://api.coinbase.com/v2/prices/TRX-USD/spot");
      if (px.ok) { const j = await px.json(); const v = Number(j?.data?.amount); if (Number.isFinite(v) && v > 0) trxUsd = v; }
    } catch { /* */ }

    const tronBurnTrx = (energyPerUsdt * energyUnitPriceSun) / 1_000_000;
    const tronUsd = +(tronBurnTrx * trxUsd).toFixed(4);

    // Coinbase advanced exchange withdrawal fees (estimates, refresh quarterly)
    const COINBASE_USDT_WITHDRAW = { TRC20: 1.0, ERC20: 8.5, SOL: 1.0, BSC: 1.0, POLY: 1.0 };
    const ROUTES = [
      { network: "TRC20 (Tron)",         coinbaseFeeUsd: COINBASE_USDT_WITHDRAW.TRC20, networkFeeUsd: tronUsd, speedSec: 60 },
      { network: "Solana",               coinbaseFeeUsd: COINBASE_USDT_WITHDRAW.SOL,   networkFeeUsd: 0.0005,  speedSec: 15 },
      { network: "BSC (BEP20)",          coinbaseFeeUsd: COINBASE_USDT_WITHDRAW.BSC,   networkFeeUsd: 0.20,    speedSec: 30 },
      { network: "Polygon",              coinbaseFeeUsd: COINBASE_USDT_WITHDRAW.POLY,  networkFeeUsd: 0.01,    speedSec: 30 },
      { network: "Ethereum (ERC20)",     coinbaseFeeUsd: COINBASE_USDT_WITHDRAW.ERC20, networkFeeUsd: 4.50,    speedSec: 90 },
    ].map(r => ({ ...r, totalUsd: +(r.coinbaseFeeUsd + r.networkFeeUsd).toFixed(4) }))
      .sort((a,b) => a.totalUsd - b.totalUsd);

    return {
      cheapest: ROUTES[0],
      routes: ROUTES,
      tron: { energyPerUsdt, energyUnitPriceSun, tronBurnTrx: +tronBurnTrx.toFixed(4), trxUsd, networkFeeUsd: tronUsd },
      generatedAt: new Date().toISOString(),
    };
  });

// ────────── WHALE ALERTS (VIP) ──────────
export const getWhaleAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: prof } = await supabase.from("profiles").select("status").eq("id", userId).maybeSingle();
    if (prof?.status !== "vip") throw new Error("VIP only");

    const FIRECRAWL = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL) throw new Error("FIRECRAWL_API_KEY missing");

    let alerts: { title: string; url: string; snippet?: string }[] = [];
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "site:whale-alert.io OR \"whale transfer\" OR \"large USDT transaction\" today",
          limit: 8,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const arr: any[] = j?.data?.web ?? j?.data ?? [];
        alerts = arr.map((x: any) => ({ title: x.title, url: x.url, snippet: x.description })).filter(a => a.title && a.url);
      }
    } catch { /* */ }
    return { alerts, generatedAt: new Date().toISOString() };
  });