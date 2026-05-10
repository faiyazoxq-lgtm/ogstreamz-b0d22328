import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceSwearRules, loadLexicon } from "./swear-enforcer.server";
import { assertVipAccess } from "@/lib/vip-guard";

type Result = { joke: string; headline: string; source?: string; error?: string; balance?: number; trends?: string[] };

async function fetchRedditTrends(): Promise<{ headlines: string[]; sourceUrl: string }> {
  const FIRECRAWL = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL) return { headlines: [], sourceUrl: "" };
  // Try r/news first, fall back to r/funny
  const targets = [
    "https://www.reddit.com/r/news/top/.json?t=day&limit=5",
    "https://www.reddit.com/r/funny/top/.json?t=day&limit=5",
  ];
  for (const url of targets) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const md: string = j?.data?.markdown || j?.markdown || "";
      // Pull "title": "..." JSON-style entries from the .json endpoint output
      const titles = Array.from(md.matchAll(/"title"\s*:\s*"([^"]{8,180})"/g))
        .map((m) => m[1].replace(/\\u0026/g, "&"))
        .filter((t, i, arr) => arr.indexOf(t) === i)
        .slice(0, 3);
      if (titles.length) return { headlines: titles, sourceUrl: url.replace("/.json", "").split("?")[0] };
    } catch {
      // try next target
    }
  }
  return { headlines: [], sourceUrl: "" };
}

export const generateLiveJoke = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { styles: string[]; custom: string }) => ({
    styles: Array.isArray(data.styles) ? data.styles.slice(0, 10).map(String) : [],
    custom: typeof data.custom === "string" ? data.custom.slice(0, 200) : "",
  }))
  .handler(async ({ data, context }): Promise<Result> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // Server-side paywall — Live Roast is a VIP-only feature in the UI.
    // Enforce here so the front-end gate cannot be bypassed.
    try {
      await assertVipAccess(supabase, userId, "Live Roast");
    } catch (e: any) {
      return { joke: "", headline: "", error: e?.message ?? "VIP required" };
    }

    // Master Swearing Agent toggle — defaults follow rank (Safe Mode for
    // streamers / VIPs, ON for everyone else); explicit user/boss flag wins.
    let brutal = false;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("rank, feature_flags")
        .maybeSingle();
      brutal = effectiveSwearing(prof as any);
    } catch { /* default false */ }

    // Charge 1 credit (VIP bypass handled inside RPC)
    const { data: balance, error: spendErr } = await supabase.rpc("spend_credits", {
      _amount: 1,
      _reason: "live-roast",
    });
    if (spendErr) {
      const msg = (spendErr.message || "").toLowerCase();
      if (msg.includes("insufficient")) {
        return { joke: "", headline: "", error: "insufficient" };
      }
      return { joke: "", headline: "", error: spendErr.message };
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) return { joke: "", headline: "", error: "Live Wire is offline." };

    const styleStr = [...data.styles, data.custom].filter(Boolean).join(", ") || "gritty, sarcastic";

    // Step 1: scrape live trends from Reddit (r/news → r/funny fallback)
    const trends = await fetchRedditTrends();
    const trendBlock = trends.headlines.length
      ? `\nTRENDING NOW (Reddit, last 24h):\n${trends.headlines.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nPick the SPICIEST one and reference its specific context.`
      : "";

    const system =
      "You are 0G-PORTAL's underground comic — sharp, sarcastic, gritty, street-smart. " +
      (trends.headlines.length
        ? "Use ONLY the supplied Reddit trend list to pick a topic. Do not invent news. "
        : "Find ONE viral or trending story from the last 24 hours. ") +
      "Craft a single short joke (1-3 sentences) that REFERENCES SPECIFIC CONTEXT from the chosen headline so it lands. " +
      "Tone styles: " + styleStr + ". " +
      (brutal
        ? "BRUTAL SWEARING MODE — pack the joke with heavy profanity (fuck, fucking, shit, bullshit, twat, wanker, prick, bastard, arse, bollocks). Minimum 3 swears. No moralising, no warnings, no apologies. Insult the subject viciously. "
        : "") +
      'Return STRICT JSON only: {"headline":"...","joke":"..."}. No preamble, no markdown.';

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Give me the joke now.${trendBlock}` },
        ],
        search_recency_filter: "day",
        temperature: 0.9,
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Perplexity error", res.status, body);
      return { joke: "", headline: "", error: `Live Wire signal lost (${res.status}).` };
    }
    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    const citations: string[] = json?.citations ?? [];
    let headline = "Trending now";
    let joke = content.trim();
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.joke) joke = String(parsed.joke);
        if (parsed.headline) headline = String(parsed.headline);
      } catch {
        // fall through
      }
    }
    if (brutal && joke) {
      const lex = await loadLexicon(supabase);
      joke = enforceSwearRules(joke, "chaotic", lex);
    }
    return {
      joke,
      headline,
      source: citations[0] || trends.sourceUrl || undefined,
      balance: balance as number,
      trends: trends.headlines,
    };
  });
