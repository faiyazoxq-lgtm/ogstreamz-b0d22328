// Server-only Perplexity Sonar Pro wrapper used by the OG-mode chat pipeline.
// Returns the assistant's grounded answer plus the list of source URLs/titles
// so the frontend can render a "Deep Researching…" status bar with snippets.

export type ResearchSource = {
  url: string;
  title?: string;
  snippet?: string;
};

export type ResearchResult = {
  answer: string;          // Perplexity's synthesized answer (we re-synthesize w/ Gemini/GPT)
  sources: ResearchSource[];
  model: string;
};

const ENDPOINT = "https://api.perplexity.ai/chat/completions";

export async function deepResearch(query: string, opts?: {
  recency?: "day" | "week" | "month" | "year";
  model?: string;
}): Promise<ResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not configured");

  const model = opts?.model ?? "sonar-pro";

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant. Answer the user's question with concrete, citable facts from the live web. Be terse — bullet points or 2-3 short paragraphs max. Do not editorialize.",
        },
        { role: "user", content: query },
      ],
      ...(opts?.recency ? { search_recency_filter: opts.recency } : {}),
      return_citations: true,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Perplexity ${res.status}: ${t.slice(0, 300)}`);
  }

  type PpxResp = {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
    search_results?: Array<{ url: string; title?: string; snippet?: string }>;
  };
  const json = (await res.json()) as PpxResp;

  const answer = json.choices?.[0]?.message?.content?.trim() ?? "";

  // Prefer the rich `search_results` shape when present; fall back to the
  // older `citations` array of bare URLs.
  const sources: ResearchSource[] = Array.isArray(json.search_results) && json.search_results.length
    ? json.search_results.slice(0, 6).map((s) => ({
        url: s.url,
        title: s.title,
        snippet: s.snippet?.slice(0, 240),
      }))
    : (json.citations ?? []).slice(0, 6).map((url) => ({ url }));

  return { answer, sources, model };
}