import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { runDeepSearch, runPeerReview, type DeepSearchSource, type PeerReview } from "./orchestrator.functions";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "news";
}

export type NewsBias = "bad" | "good" | "neutral";

export type NewsArticle = {
  url: string;
  title: string;
  source: string;
  snippet: string;
  spinoff: string;
  confidence: number;
};

export type NewsScoutMeta = {
  pair: string;
  bias: NewsBias;
  context: string;
  headline: string;
  tagline: string;
  overall_confidence: number;
  scanned_at: string;
  articles: NewsArticle[];
  // Omniscient template additions
  bull_articles?: NewsArticle[];
  bear_articles?: NewsArticle[];
  synthesis?: {
    support: string;
    resistance: string;
    bull_scenario: string;
    bear_scenario: string;
    impact_matrix: { event: string; movement: string }[];
    trend_summary: string;
  };
  tv_symbol?: string;
  related_symbols?: string[];
  asset_code?: string;
  // 0G-BRAIN deep_search additions
  citations?: string[];
  verified_sources?: DeepSearchSource[];
  deep_search_answer?: string;
  peer_review?: PeerReview;
};

function tvSymbolFor(pair: string): { tv: string; related: string[]; code: string } {
  const p = (pair || "").toLowerCase();
  if (p.includes("gold") || p.includes("xau")) return { tv: "OANDA:XAUUSD", related: ["OANDA:XAGUSD","TVC:DXY","TVC:US10Y"], code: "XAU" };
  if (p.includes("silver") || p.includes("xag")) return { tv: "OANDA:XAGUSD", related: ["OANDA:XAUUSD","TVC:DXY","TVC:US10Y"], code: "XAG" };
  if (p.includes("copper")) return { tv: "COMEX:HG1!", related: ["TVC:DXY","SP:SPX","TVC:USOIL"], code: "HG" };
  if (p.includes("gbp")) return { tv: "FX:GBPUSD", related: ["FX:EURUSD","TVC:DXY","TVC:UKX"], code: "GBP" };
  if (p.includes("eur")) return { tv: "FX:EURUSD", related: ["FX:GBPUSD","TVC:DXY","TVC:DEU30"], code: "EUR" };
  if (p.includes("jpy") || p.includes("yen")) return { tv: "FX:USDJPY", related: ["TVC:DXY","TVC:JP225","TVC:US10Y"], code: "JPY" };
  if (p.includes("brent")) return { tv: "TVC:UKOIL", related: ["TVC:USOIL","NYMEX:NG1!","TVC:DXY"], code: "BRN" };
  if (p.includes("wti") || p.includes("oil")) return { tv: "TVC:USOIL", related: ["TVC:UKOIL","NYMEX:NG1!","TVC:DXY"], code: "WTI" };
  if (p.includes("gas") || p.includes("nat")) return { tv: "NYMEX:NG1!", related: ["TVC:USOIL","TVC:UKOIL","TVC:DXY"], code: "NG" };
  if (p.includes("nasdaq") || p.includes("ndx")) return { tv: "NASDAQ:NDX", related: ["SP:SPX","TVC:DXY","TVC:US10Y"], code: "NDX" };
  if (p.includes("s&p") || p.includes("spx") || p.includes("sp 500") || p.includes("sp500")) return { tv: "SP:SPX", related: ["NASDAQ:NDX","TVC:DXY","TVC:VIX"], code: "SPX" };
  if (p.includes("ftse") || p.includes("uk100")) return { tv: "TVC:UKX", related: ["TVC:DXY","TVC:DEU30","FX:GBPUSD"], code: "UKX" };
  if (p.includes("btc") || p.includes("bitcoin")) return { tv: "BINANCE:BTCUSDT", related: ["BINANCE:ETHUSDT","TVC:DXY","SP:SPX"], code: "BTC" };
  if (p.includes("eth") || p.includes("ether")) return { tv: "BINANCE:ETHUSDT", related: ["BINANCE:BTCUSDT","TVC:DXY","SP:SPX"], code: "ETH" };
  return { tv: "TVC:DXY", related: ["SP:SPX","OANDA:XAUUSD","TVC:USOIL"], code: (pair || "SIG").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "SIG" };
}

function biasTheme(bias: NewsBias) {
  if (bias === "bad") {
    return {
      bgGradient: "linear-gradient(180deg, #14060a 0%, #2a0608 60%, #050203 100%)",
      accent: "#ff2233",
      secondary: "#ff7a55",
      text: "#ffe6e6",
      fontFamily: "'Oswald', Impact, sans-serif",
      ornament: "⚠",
      label: "EMERGENCY ALERT",
      animation: "shake" as const,
      hitButton: "SCAN FOR UPDATES",
      fontPair: { heading: "Oswald", body: "JetBrains Mono" },
      vibeLabel: "Crimson Crisis",
      particleColors: ["#ff2233", "#ff7a55", "#ffd6cc"],
    };
  }
  if (bias === "good") {
    return {
      bgGradient: "linear-gradient(180deg, #02150f 0%, #0a2a3a 60%, #010812 100%)",
      accent: "#00e08a",
      secondary: "#3ea0ff",
      text: "#dffbe9",
      fontFamily: "'Oswald', Impact, sans-serif",
      ornament: "▲",
      label: "BULL MARKET PULSE",
      animation: "pulse" as const,
      hitButton: "SCAN FOR UPDATES",
      fontPair: { heading: "Oswald", body: "JetBrains Mono" },
      vibeLabel: "Emerald Surge",
      particleColors: ["#00e08a", "#3ea0ff", "#c8ffec"],
    };
  }
  return {
    bgGradient: "linear-gradient(180deg, #0a0a0e 0%, #1a1a22 60%, #050507 100%)",
    accent: "#9aa0ff",
    secondary: "#cccccc",
    text: "#ffffff",
    fontFamily: "'Oswald', Impact, sans-serif",
    ornament: "◆",
    label: "INTEL FEED",
    animation: "glow" as const,
    hitButton: "SCAN FOR UPDATES",
    fontPair: { heading: "Oswald", body: "JetBrains Mono" },
    vibeLabel: "Static Recon",
    particleColors: ["#9aa0ff", "#cccccc", "#ffffff"],
  };
}

async function firecrawlSearch(query: string, limit = 5): Promise<{ url: string; title: string; description: string }[]> {
  const FIRECRAWL = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, tbs: "qdr:d" }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const arr: any[] = j?.data?.web ?? j?.data ?? [];
    return arr
      .map((x: any) => ({ url: x.url ?? "", title: x.title ?? "", description: x.description ?? x.snippet ?? "" }))
      .filter((x) => x.url && x.title)
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function perplexityDualAnalyze(input: {
  pair: string;
  bias: NewsBias;
  context: string;
  bullHits: { url: string; title: string; description: string }[];
  bearHits: { url: string; title: string; description: string }[];
}): Promise<{
  headline: string;
  tagline: string;
  overall_confidence: number;
  bull_articles: NewsArticle[];
  bear_articles: NewsArticle[];
  synthesis: NonNullable<NewsScoutMeta["synthesis"]>;
}> {
  const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

  const fmt = (arr: typeof input.bullHits) =>
    arr.length ? arr.map((h, i) => `${i + 1}. ${h.title} — ${h.description} (${h.url})`).join("\n") : "(none — synthesize plausible recent catalysts)";

  const biasEmphasis = input.bias === "bad" ? "lean bearish in tagline" : input.bias === "good" ? "lean bullish in tagline" : "balanced";

  const prompt = `You are 0G-PORTAL's "Omniscient" market intelligence editor for ${input.pair} as of May 2026.
Context: ${input.context || "macro + geopolitics"}
Editor stance: ${biasEmphasis}

BULLISH-leaning sources just scraped:
${fmt(input.bullHits)}

BEARISH-leaning sources just scraped:
${fmt(input.bearHits)}

Return STRICT JSON only, no prose, no markdown, exactly this shape:
{
  "headline": "ALL-CAPS dramatic 6-14 word headline framing ${input.pair} at a crossroads",
  "tagline": "1 sentence (max 160 chars) framing the bull-vs-bear tension",
  "overall_confidence": 0-100 integer,
  "bull_articles": [ /* up to 5, one per BULL source in order */
    { "url": "...", "title": "...", "source": "domain", "snippet": "1 sentence factual (max 200 chars)", "spinoff": "2-3 sentences explaining WHY this is bullish for ${input.pair}", "confidence": 0-100 }
  ],
  "bear_articles": [ /* up to 5, one per BEAR source in order, same shape */ ],
  "synthesis": {
    "support": "$X,XXX (key technical floor with brief reason)",
    "resistance": "$X,XXX (key technical ceiling with brief reason)",
    "bull_scenario": "1-2 sentences: if bulls win, ${input.pair} targets $X (specific level + catalyst)",
    "bear_scenario": "1-2 sentences: if bears win, ${input.pair} retreats to $X (specific level + catalyst)",
    "impact_matrix": [
      { "event": "short event label e.g. 'Iran Ceasefire'", "movement": "directional move e.g. '-3% to $4,576'" }
    ],
    "trend_summary": "2-3 sentences: 100/200 SMA posture + key trendlines + current setup"
  }
}
impact_matrix should have 4-6 rows mixing bullish & bearish events. Use real-looking 2026 prices.`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: "You output strict JSON only. No markdown, no prose." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 2400,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
  const m = raw.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try { parsed = JSON.parse(m ? m[0] : raw); } catch { parsed = {}; }

  const mapArticles = (arr: any, hits: typeof input.bullHits): NewsArticle[] =>
    Array.isArray(arr)
      ? arr.map((a: any, i: number) => ({
          url: String(a.url || hits[i]?.url || ""),
          title: String(a.title || hits[i]?.title || "Intel"),
          source: String(a.source || (() => { try { return new URL(a.url || hits[i]?.url || "").hostname.replace(/^www\./, ""); } catch { return "intel"; } })()),
          snippet: String(a.snippet || hits[i]?.description || "").slice(0, 260),
          spinoff: String(a.spinoff || "").slice(0, 600),
          confidence: Math.max(0, Math.min(100, Number(a.confidence) || 55)),
        })).filter((a: NewsArticle) => a.url && a.title).slice(0, 5)
      : [];

  const s = parsed.synthesis || {};
  return {
    headline: String(parsed.headline || `${input.pair.toUpperCase()} AT THE CROSSROADS`).slice(0, 180),
    tagline: String(parsed.tagline || "Bulls and bears collide on the live tape").slice(0, 220),
    overall_confidence: Math.max(0, Math.min(100, Number(parsed.overall_confidence) || 60)),
    bull_articles: mapArticles(parsed.bull_articles, input.bullHits),
    bear_articles: mapArticles(parsed.bear_articles, input.bearHits),
    synthesis: {
      support: String(s.support || "—").slice(0, 200),
      resistance: String(s.resistance || "—").slice(0, 200),
      bull_scenario: String(s.bull_scenario || "—").slice(0, 400),
      bear_scenario: String(s.bear_scenario || "—").slice(0, 400),
      impact_matrix: Array.isArray(s.impact_matrix)
        ? s.impact_matrix.slice(0, 8).map((r: any) => ({
            event: String(r.event || "").slice(0, 80),
            movement: String(r.movement || "").slice(0, 120),
          })).filter((r: any) => r.event && r.movement)
        : [],
      trend_summary: String(s.trend_summary || "").slice(0, 600),
    },
  };
}

async function buildScoutMeta(input: { pair: string; bias: NewsBias; context: string }): Promise<NewsScoutMeta> {
  const baseCtx = input.context ? ` ${input.context}` : "";
  const bullQ = `${input.pair}${baseCtx} bullish rally surge breakout supply tight central bank buying latest 2026`;
  const bearQ = `${input.pair}${baseCtx} bearish crash drop ceasefire peace deal rate hike strong dollar latest 2026`;
  // 0G-BRAIN deep_search runs in parallel with Firecrawl scrapes — last-hour citations only
  const deepQ = `${input.pair}${baseCtx} latest market-moving headlines, price action and catalysts in the last hour (May 2026). Cite at least 5 high-quality sources.`;
  const [bullHits, bearHits, deep] = await Promise.all([
    firecrawlSearch(bullQ, 5),
    firecrawlSearch(bearQ, 5),
    runDeepSearch({ query: deepQ, recency: "hour", minSources: 5 }).catch((e) => {
      console.error("deep_search failed", e?.message);
      return null;
    }),
  ]);
  const ai = await perplexityDualAnalyze({ ...input, bullHits, bearHits });
  // Peer-review the synthesis against the deep_search evidence (Gemini fact-check)
  let review: PeerReview | undefined;
  if (deep) {
    const analysisStr = `${ai.headline}\n${ai.tagline}\nSupport: ${ai.synthesis.support}\nResistance: ${ai.synthesis.resistance}\nBull: ${ai.synthesis.bull_scenario}\nBear: ${ai.synthesis.bear_scenario}\nTrend: ${ai.synthesis.trend_summary}`;
    review = await runPeerReview({ topic: `${input.pair} · ${input.context}`, analysis: analysisStr, evidence: deep }).catch(() => undefined);
  }
  const sym = tvSymbolFor(input.pair);
  // Maintain backward-compat single-bias `articles` (used by legacy renderers)
  const legacy = input.bias === "good" ? ai.bull_articles : input.bias === "bad" ? ai.bear_articles : [...ai.bull_articles, ...ai.bear_articles].slice(0, 5);
  return {
    pair: input.pair,
    bias: input.bias,
    context: input.context,
    headline: ai.headline,
    tagline: ai.tagline,
    overall_confidence: ai.overall_confidence,
    scanned_at: new Date().toISOString(),
    articles: legacy,
    bull_articles: ai.bull_articles,
    bear_articles: ai.bear_articles,
    synthesis: ai.synthesis,
    tv_symbol: sym.tv,
    related_symbols: sym.related,
    asset_code: sym.code,
    citations: deep?.citations ?? [],
    verified_sources: deep?.verified_sources ?? [],
    deep_search_answer: deep?.answer,
    peer_review: review,
  };
}

// ───── Admin: spawn a News Intelligence portal ─────
export const spawnNewsPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; pair: string; bias: NewsBias; context: string; vip?: boolean }) => ({
    name: String(data.name || "").trim().slice(0, 80),
    pair: String(data.pair || "").trim().slice(0, 40),
    bias: (data.bias === "bad" || data.bias === "good" || data.bias === "neutral" ? data.bias : "neutral") as NewsBias,
    context: String(data.context || "").trim().slice(0, 200),
    vip: !!data.vip,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.name || !data.pair) throw new Error("Name and asset pair required");

    const meta = await buildScoutMeta({ pair: data.pair, bias: data.bias, context: data.context });
    const themeConfig = biasTheme(data.bias);

    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    const { data: existing } = await supabase.from("portals").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;

    const niche = `${data.pair} · ${data.context || "Market intelligence"} · ${data.bias.toUpperCase()} bias`;

    const { data: portal, error } = await supabase
      .from("portals")
      .insert({
        slug,
        name: data.name,
        niche,
        language: "English",
        vibe: data.bias === "bad" ? "Crimson Crisis" : data.bias === "good" ? "Emerald Surge" : "Static Recon",
        theme: data.bias === "bad" ? "norse" : data.bias === "good" ? "jungle" : "cyber",
        kind: "news",
        vip: data.vip,
        theme_config: themeConfig,
        scout_meta: meta,
        jokes: [], // unused for news kind
        created_by: userId,
      })
      .select("id, slug, name, vip")
      .single();
    if (error) throw new Error(error.message);
    return { portal, articleCount: meta.articles.length };
  });

// ───── Public: refresh on every visit ─────
export const refreshNewsScout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) => ({ slug: String(data.slug || "").trim().slice(0, 80) }))
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error("Supabase env missing");
    const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: portal, error } = await sb
      .from("portals")
      .select("kind, scout_meta")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!portal || portal.kind !== "news") throw new Error("Not a news portal");

    const old = (portal.scout_meta || {}) as Partial<NewsScoutMeta>;
    if (!old.pair) throw new Error("Missing news config");

    // Cache guard: skip the Perplexity call if scanned within the last 5 minutes.
    if (old.scanned_at) {
      const ageMs = Date.now() - new Date(old.scanned_at).getTime();
      if (ageMs < 5 * 60_000) {
        return { meta: old as NewsScoutMeta, cached: true };
      }
    }

    const meta = await buildScoutMeta({
      pair: old.pair,
      bias: (old.bias as NewsBias) || "neutral",
      context: old.context || "",
    });

    const { error: rpcErr } = await sb.rpc("refresh_news_scout", { _slug: data.slug, _meta: meta as any });
    if (rpcErr) throw new Error(rpcErr.message);
    return { meta };
  });