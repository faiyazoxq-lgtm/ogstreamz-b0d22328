import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

type ScoutOutput = {
  keyword: string;
  context: { headline: string; summary: string; sources: string[]; themes: string[] };
  jokes: { id: string; content: string; source: string | null }[];
  calculator: { id: string; slug: string; name: string; description: string; vip: boolean };
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "calc";
}

export const runAutomatedScout = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { keyword: string }) => ({
    keyword: String(data.keyword || "").trim().slice(0, 80),
  }))
  .handler(async ({ data, context }): Promise<ScoutOutput> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.keyword) throw new Error("Keyword required");

    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    const FIRECRAWL = process.env.FIRECRAWL_API_KEY;
    const LOVABLE = process.env.LOVABLE_API_KEY;
    if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");
    if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");

    // 1. Perplexity — trending news on keyword
    const pplxRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You return concise trending-news intel. Be specific, name names, cite numbers." },
          { role: "user", content: `Find the most viral / trending stories from the last 48 hours about: "${data.keyword}". Give a short summary (3-4 sentences) covering the freshest angles.` },
        ],
        search_recency_filter: "week",
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
    if (!pplxRes.ok) throw new Error(`Perplexity ${pplxRes.status}`);
    const pplx = await pplxRes.json();
    const summary: string = pplx?.choices?.[0]?.message?.content ?? "";
    const citations: string[] = (pplx?.citations ?? []).slice(0, 3);

    // 2. Firecrawl — scrape top citation for richer themes
    const themes: string[] = [];
    let headline = data.keyword;
    if (FIRECRAWL && citations[0]) {
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: citations[0], formats: ["markdown"], onlyMainContent: true }),
        });
        if (fcRes.ok) {
          const fc = await fcRes.json();
          const root = fc.data ?? fc;
          headline = root?.metadata?.title ?? headline;
          const md: string = root?.markdown ?? "";
          for (const m of md.matchAll(/^#{1,3}\s+(.+)$/gm)) {
            themes.push(m[1].trim());
            if (themes.length >= 8) break;
          }
        }
      } catch { /* non-fatal */ }
    }

    // 3. Lovable AI — generate jokes + calculator config
    const aiPrompt = `Trending topic: "${data.keyword}"
Headline: ${headline}
Summary: ${summary}
Themes: ${themes.join(" · ") || "n/a"}

Generate:
1. Five short SAVAGE "Live Wire" jokes about this topic. Sarcastic, gritty, street-smart, 1-2 sentences each. NO numbering, NO quotes around them.
2. ONE useful calculator related to this topic. Provide name (max 40 chars), description (max 120 chars), and slug-friendly id.

Return STRICT JSON ONLY:
{
  "jokes": ["...", "...", "...", "...", "..."],
  "calculator": { "name": "...", "description": "..." }
}`;

    const PPLX = process.env.PERPLEXITY_API_KEY;
    if (!PPLX) throw new Error("PERPLEXITY_API_KEY missing");
    const aiRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You output strict JSON only. No markdown, no preamble." },
          { role: "user", content: aiPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1200,
      }),
    });
    if (!aiRes.ok) throw new Error(`Perplexity ${aiRes.status}`);
    const ai = await aiRes.json();
    const raw: string = ai?.choices?.[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: { jokes?: string[]; calculator?: { name?: string; description?: string } } = {};
    try { parsed = JSON.parse(match ? match[0] : raw); } catch { /* */ }
    const jokes = (parsed.jokes ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 5);
    if (jokes.length === 0) throw new Error("AI returned no jokes");
    const calcName = (parsed.calculator?.name ?? `${data.keyword} Index`).slice(0, 40);
    const calcDesc = (parsed.calculator?.description ?? `Quick reckoner for ${data.keyword}.`).slice(0, 120);

    // 4. Persist
    const { data: insertedJokes, error: jokesErr } = await supabase
      .from("jokes")
      .insert(jokes.map((content: string) => ({
        content,
        keyword: data.keyword,
        source: citations[0] ?? null,
        created_by: userId,
        published: true,
      })))
      .select("id, content, source");
    if (jokesErr) throw new Error(`Jokes insert: ${jokesErr.message}`);

    const slug = `${slugify(data.keyword)}-${Date.now().toString(36)}`;
    const { data: insertedCalc, error: calcErr } = await supabase
      .from("calculators")
      .insert({
        slug,
        name: calcName,
        description: calcDesc,
        config: { keyword: data.keyword, themes, type: "score" },
        vip: true,
        published: true,
      })
      .select("id, slug, name, description, vip")
      .single();
    if (calcErr) throw new Error(`Calculator insert: ${calcErr.message}`);

    return {
      keyword: data.keyword,
      context: { headline, summary, sources: citations, themes },
      jokes: insertedJokes ?? [],
      calculator: insertedCalc as ScoutOutput["calculator"],
    };
  });