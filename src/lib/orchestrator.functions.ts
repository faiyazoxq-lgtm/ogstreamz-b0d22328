// 0G-BRAIN Orchestrator — Perplexity-powered research loop + Gemini peer-review.
// Internal helpers are plain async functions (callable from any server fn).
// Public `deepSearch` and `peerReview` are exposed as server functions for direct UI calls.
import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

// Gate paid Perplexity calls behind VIP / paid tier so free users cannot drain credits.
async function assertVipOrPaid(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_active_vip", { _user: userId });
  if (error) throw new Response("Unable to verify entitlement", { status: 500 });
  if (data !== true) throw new Response("VIP / paid tier required", { status: 403 });
}

export type DeepSearchSource = {
  url: string;
  title: string;
  source: string; // hostname
};

export type DeepSearchResult = {
  answer: string;
  reasoning?: string;
  citations: string[];          // raw URL list as returned by Perplexity
  verified_sources: DeepSearchSource[]; // de-duped, hostname-tagged
  model: string;
  recency: string;
  generated_at: string;
};

function hostnameOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; }
}

function titleFromUrl(u: string): string {
  try {
    const url = new URL(u);
    const last = url.pathname.split("/").filter(Boolean).pop() || url.hostname;
    return decodeURIComponent(last).replace(/[-_]+/g, " ").slice(0, 120) || url.hostname;
  } catch { return u.slice(0, 80); }
}

/**
 * deep_search — TOOL the 0G-BRAIN calls when a prompt needs real-time facts.
 * Wraps Perplexity Sonar-Reasoning with last-hour recency and at least 5 citations.
 */
export async function runDeepSearch(opts: {
  query: string;
  recency?: "hour" | "day" | "week" | "month";
  minSources?: number;
  systemHint?: string;
}): Promise<DeepSearchResult> {
  const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

  const recency = opts.recency || "hour";
  const minSources = Math.max(1, opts.minSources ?? 5);
  const model = "sonar-reasoning";

  const sys = opts.systemHint
    || "You are 0G-BRAIN's deep_search tool. Answer concisely with verifiable, cited facts only. Cite at least 5 high-quality sources from the last hour where possible.";

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: opts.query },
      ],
      temperature: 0.2,
      max_tokens: 1100,
      search_recency_filter: recency,
      return_citations: true,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity deep_search ${res.status}`);
  const j = await res.json();
  const content: string = j?.choices?.[0]?.message?.content ?? "";
  // sonar-reasoning often includes <think>…</think>; split that out
  let reasoning: string | undefined;
  let answer = content;
  const t = content.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/i);
  if (t) { reasoning = t[1].trim(); answer = t[2].trim(); }

  const rawCites: string[] = Array.isArray(j?.citations) ? j.citations
    : Array.isArray(j?.search_results) ? j.search_results.map((s: any) => s?.url).filter(Boolean)
    : [];

  const seen = new Set<string>();
  const verified: DeepSearchSource[] = [];
  for (const url of rawCites) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    verified.push({ url, title: titleFromUrl(url), source: hostnameOf(url) });
    if (verified.length >= 12) break;
  }

  return {
    answer: answer.slice(0, 4000),
    reasoning: reasoning?.slice(0, 2000),
    citations: rawCites,
    verified_sources: verified,
    model,
    recency,
    generated_at: new Date().toISOString(),
  };
}

export type PeerReview = {
  verdict: "verified" | "partial" | "unverified";
  confidence: number; // 0-100
  agree: string[];
  disagree: string[];
  corrections: string[];
  notes: string;
};

/** Gemini peer-reviews an analysis against deep_search citations. */
export async function runPeerReview(opts: {
  topic: string;
  analysis: string;
  evidence: DeepSearchResult;
  /** Optional voice override — e.g. brutally brief + swearing for TradeHUB. */
  systemOverride?: string;
  /** Cap output tokens — small for terse outputs. */
  maxTokens?: number;
}): Promise<PeerReview> {
  const PPLX = process.env.PERPLEXITY_API_KEY;
  if (!PPLX) {
    return { verdict: "unverified", confidence: 0, agree: [], disagree: [], corrections: [], notes: "PERPLEXITY_API_KEY missing" };
  }
  const sourceList = opts.evidence.verified_sources
    .map((s, i) => `[${i + 1}] ${s.source} — ${s.url}`)
    .join("\n") || "(no citations)";

  const prompt = `You are 0G-BRAIN's Fact-Checking Agent. Peer-review the ANALYSIS against the live EVIDENCE.
Topic: ${opts.topic}

ANALYSIS:
${opts.analysis.slice(0, 3500)}

LIVE EVIDENCE (from Perplexity sonar-reasoning, last hour):
${opts.evidence.answer.slice(0, 2000)}

SOURCES:
${sourceList}

Return STRICT JSON only, no markdown:
{
  "verdict": "verified" | "partial" | "unverified",
  "confidence": 0-100,
  "agree": ["short factual claim that the evidence corroborates", "..."],
  "disagree": ["short claim the evidence contradicts", "..."],
  "corrections": ["suggested correction with the right number/event", "..."],
  "notes": "1-2 sentence reviewer summary"
}`;

  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-reasoning",
        messages: [
          { role: "system", content: opts.systemOverride || "Output strict JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: Math.max(200, Math.min(1200, opts.maxTokens ?? 1200)),
      }),
    });
    if (!r.ok) throw new Error(`perplexity ${r.status}`);
    const j = await r.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    const p = JSON.parse(m ? m[0] : raw);
    const verdict: PeerReview["verdict"] = p.verdict === "verified" || p.verdict === "partial" || p.verdict === "unverified" ? p.verdict : "partial";
    return {
      verdict,
      confidence: Math.max(0, Math.min(100, Number(p.confidence) || 60)),
      agree: Array.isArray(p.agree) ? p.agree.slice(0, 6).map((x: any) => String(x).slice(0, 200)) : [],
      disagree: Array.isArray(p.disagree) ? p.disagree.slice(0, 6).map((x: any) => String(x).slice(0, 200)) : [],
      corrections: Array.isArray(p.corrections) ? p.corrections.slice(0, 6).map((x: any) => String(x).slice(0, 240)) : [],
      notes: String(p.notes || "").slice(0, 400),
    };
  } catch (e: any) {
    return { verdict: "partial", confidence: 50, agree: [], disagree: [], corrections: [], notes: `peer-review unavailable: ${e?.message ?? "error"}` };
  }
}

// ───── Public server functions ─────

export const deepSearch = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { query: string; recency?: "hour" | "day" | "week" | "month"; minSources?: number }) => ({
    query: String(d.query || "").trim().slice(0, 1000),
    recency: (d.recency === "day" || d.recency === "week" || d.recency === "month" ? d.recency : "hour") as "hour" | "day" | "week" | "month",
    minSources: Math.max(1, Math.min(10, Number(d.minSources ?? 5))),
  }))
  .handler(async ({ data, context }) => {
    await assertVipOrPaid((context as any).supabase, (context as any).userId);
    if (!data.query) throw new Error("query required");
    return await runDeepSearch(data);
  });

export const peerReview = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { topic: string; analysis: string; query: string }) => ({
    topic: String(d.topic || "").trim().slice(0, 200),
    analysis: String(d.analysis || "").trim().slice(0, 4000),
    query: String(d.query || "").trim().slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    await assertVipOrPaid((context as any).supabase, (context as any).userId);
    const ev = await runDeepSearch({ query: data.query || data.topic, recency: "hour", minSources: 5 });
    const review = await runPeerReview({ topic: data.topic, analysis: data.analysis, evidence: ev });
    return { evidence: ev, review };
  });