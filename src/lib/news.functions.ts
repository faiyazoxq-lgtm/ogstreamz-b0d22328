import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

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
};

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
      body: JSON.stringify({ query, limit }),
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

async function perplexityAnalyze(input: {
  pair: string;
  bias: NewsBias;
  context: string;
  hits: { url: string; title: string; description: string }[];
}): Promise<{ headline: string; tagline: string; overall_confidence: number; articles: NewsArticle[] }> {
  const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

  const biasWord = input.bias === "bad" ? "BEARISH / WAR / CRISIS" : input.bias === "good" ? "BULLISH / PEACE / GROWTH" : "NEUTRAL";
  const list = input.hits.map((h, i) => `${i + 1}. ${h.title} — ${h.description} (${h.url})`).join("\n");

  const prompt = `You are 0G-PORTAL's market intelligence editor.
Asset: ${input.pair}
Market bias to emphasize: ${biasWord}
Context: ${input.context || "general macro"}

Sources just scraped:
${list || "(no sources — invent reasonable ${input.pair} alpha briefing)"}

Return STRICT JSON only, exactly this shape:
{
  "headline": "ALL-CAPS dramatic 6-12 word alert headline tying ${input.pair} to the context",
  "tagline": "1 sentence sub-headline (max 140 chars)",
  "overall_confidence": 0-100 integer,
  "articles": [
    {
      "url": "exact source url",
      "title": "original article title",
      "source": "domain like reuters.com",
      "snippet": "1 sentence factual summary (max 180 chars)",
      "spinoff": "2-3 sentence AI 'Bias Analysis' explaining why this drives ${input.pair} per the bias",
      "confidence": 0-100 integer trade-confidence for this catalyst
    }
  ]
}
Return one article per source, in the same order. No prose, no markdown.`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "You output strict JSON only. No markdown, no prose." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1400,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
  const m = raw.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try { parsed = JSON.parse(m ? m[0] : raw); } catch { parsed = {}; }

  const articles: NewsArticle[] = Array.isArray(parsed.articles)
    ? parsed.articles
        .map((a: any, i: number) => ({
          url: String(a.url || input.hits[i]?.url || ""),
          title: String(a.title || input.hits[i]?.title || "Intel"),
          source: String(a.source || (() => { try { return new URL(a.url || input.hits[i]?.url || "").hostname.replace(/^www\./, ""); } catch { return "intel"; } })()),
          snippet: String(a.snippet || input.hits[i]?.description || "").slice(0, 240),
          spinoff: String(a.spinoff || "").slice(0, 600),
          confidence: Math.max(0, Math.min(100, Number(a.confidence) || 50)),
        }))
        .filter((a: NewsArticle) => a.url && a.title)
        .slice(0, 5)
    : [];

  return {
    headline: String(parsed.headline || `${input.pair.toUpperCase()} INTEL DROP`).slice(0, 160),
    tagline: String(parsed.tagline || "Live market intelligence stream").slice(0, 200),
    overall_confidence: Math.max(0, Math.min(100, Number(parsed.overall_confidence) || 60)),
    articles,
  };
}

async function buildScoutMeta(input: { pair: string; bias: NewsBias; context: string }): Promise<NewsScoutMeta> {
  const query = `${input.pair} ${input.context} ${input.bias === "bad" ? "war crisis crash" : input.bias === "good" ? "rally surge breakout" : "news"} latest 2026`;
  const hits = await firecrawlSearch(query, 5);
  const ai = await perplexityAnalyze({ ...input, hits });
  return {
    pair: input.pair,
    bias: input.bias,
    context: input.context,
    headline: ai.headline,
    tagline: ai.tagline,
    overall_confidence: ai.overall_confidence,
    scanned_at: new Date().toISOString(),
    articles: ai.articles,
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

    const meta = await buildScoutMeta({
      pair: old.pair,
      bias: (old.bias as NewsBias) || "neutral",
      context: old.context || "",
    });

    const { error: rpcErr } = await sb.rpc("refresh_news_scout", { _slug: data.slug, _meta: meta as any });
    if (rpcErr) throw new Error(rpcErr.message);
    return { meta };
  });