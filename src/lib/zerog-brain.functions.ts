// 0G-BRAIN — central Gemini-powered orchestrator.
// Uses the user's personal GOOGLE_AI_STUDIO_API_KEY (Supabase secret) against the
// Google Generative Language API directly. Three task surfaces:
//   • quantAnalyze  — TradeHUB "Senior Wall Street Analyst"
//   • produceSong   — MusicHUB "Multi-Platinum Producer"
//   • vetToolCode   — ToolHUB "Architect" JS sanity-check
import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

// Reused by all three endpoints below. Throws a 402-ish error string when the
// caller is not a VIP / paid-tier user. Free / prospect users should not be
// able to drain GOOGLE_AI_STUDIO_API_KEY.
async function assertVipOrPaid(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_active_vip", { _user: userId });
  if (error) throw new Response("Unable to verify entitlement", { status: 500 });
  if (data !== true) {
    throw new Response("VIP / paid tier required", { status: 403 });
  }
}

const MODEL = "gemini-2.5-pro";
const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

async function geminiJSON<T = any>(systemHint: string, user: string, fallback: T): Promise<T> {
  const KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY missing");

  const r = await fetch(`${ENDPOINT(MODEL)}?key=${encodeURIComponent(KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemHint }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) {
    console.error("0G-BRAIN gemini error", r.status, await r.text().catch(() => ""));
    return fallback;
  }
  const j = await r.json();
  const txt: string = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try {
    const m = txt.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : txt) as T;
  } catch {
    return fallback;
  }
}

// ─── TradeHUB · Quant ─────────────────────────────────────────────
export type QuantBriefing = {
  decisiveFacts: string[];   // exactly 3
  marketPivot: { headline: string; rationale: string; horizon: string } | null;
  macroFrame: string;
  bias: "BULL" | "BEAR" | "NEUTRAL";
  confidence: number;        // 0-100
  generatedAt: string;
};

export const quantAnalyze = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { ticker: string; news?: string[]; tradingView?: any }) => ({
    ticker: String(d.ticker || "GOLD").trim().slice(0, 40),
    news: Array.isArray(d.news) ? d.news.slice(0, 25).map((s) => String(s).slice(0, 400)) : [],
    tradingView: d.tradingView ?? null,
  }))
  .handler(async ({ data, context }): Promise<QuantBriefing> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertVipOrPaid(supabase, userId);
    const sys =
      "You are a Senior Wall Street Analyst writing for an executive trading dashboard. Cross-reference live news with current global macro trends (rates, USD, geopolitics, flows). Output STRICT JSON only.";
    const user = `TICKER: ${data.ticker}

TRADINGVIEW SNAPSHOT:
${JSON.stringify(data.tradingView ?? {}, null, 2).slice(0, 1200)}

SCRAPED NEWS (Firecrawl):
${data.news.map((n, i) => `[${i + 1}] ${n}`).join("\n").slice(0, 4000) || "(none)"}

Return JSON:
{
  "decisiveFacts": ["fact 1", "fact 2", "fact 3"],
  "marketPivot": { "headline": "...", "rationale": "...", "horizon": "24h|1w|1m" },
  "macroFrame": "1-2 sentences linking to macro regime",
  "bias": "BULL" | "BEAR" | "NEUTRAL",
  "confidence": 0-100
}`;
    const j = await geminiJSON<any>(sys, user, {});
    return {
      decisiveFacts: Array.isArray(j.decisiveFacts) ? j.decisiveFacts.slice(0, 3).map(String) : [],
      marketPivot: j.marketPivot && typeof j.marketPivot === "object"
        ? {
            headline: String(j.marketPivot.headline || "").slice(0, 200),
            rationale: String(j.marketPivot.rationale || "").slice(0, 400),
            horizon: String(j.marketPivot.horizon || "24h").slice(0, 12),
          }
        : null,
      macroFrame: String(j.macroFrame || "").slice(0, 400),
      bias: j.bias === "BULL" || j.bias === "BEAR" ? j.bias : "NEUTRAL",
      confidence: Math.max(0, Math.min(100, Number(j.confidence) || 55)),
      generatedAt: new Date().toISOString(),
    };
  });

// ─── MusicHUB · Producer ─────────────────────────────────────────
export type ProducerOutput = {
  sunoTags: string[];          // V5.5 tags incl. instrument textures
  refinedLyrics: string;       // poetic Urdu/English blend, hit structure
  vibeNotes: string;           // 1-2 lines on production direction
  bpm: number;
  key: string;
};

export const produceSong = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { lyrics: string; vibe?: string; language?: string }) => ({
    lyrics: String(d.lyrics || "").trim().slice(0, 4000),
    vibe: String(d.vibe || "").trim().slice(0, 400),
    language: String(d.language || "Urdu/English").slice(0, 40),
  }))
  .handler(async ({ data, context }): Promise<ProducerOutput> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertVipOrPaid(supabase, userId);
    const sys =
      "You are a multi-platinum producer prepping a track for Suno V5.5. Layer in technical Suno V5.5 tags for specific instrument textures (e.g. '1970s analog synth warmth', 'Roland TR-808 sub kicks', 'tape saturation'). Ensure Urdu/English cultural blending is poetic and hit-ready. Output STRICT JSON only.";
    const user = `VIBE: ${data.vibe || "(producer's choice — make it a hit)"}
LANGUAGE BLEND: ${data.language}

LYRICS:
${data.lyrics || "(generate from vibe)"}

Return JSON:
{
  "sunoTags": ["[1970s analog synth warmth]", "[live tape saturation]", "..."],
  "refinedLyrics": "full lyrics with [Verse]/[Chorus] structure tags, Urdu/English code-switched naturally",
  "vibeNotes": "1-2 sentences on production direction",
  "bpm": 90,
  "key": "A minor"
}`;
    const j = await geminiJSON<any>(sys, user, {});
    return {
      sunoTags: Array.isArray(j.sunoTags) ? j.sunoTags.slice(0, 16).map((s: any) => String(s).slice(0, 80)) : [],
      refinedLyrics: String(j.refinedLyrics || data.lyrics).slice(0, 6000),
      vibeNotes: String(j.vibeNotes || "").slice(0, 400),
      bpm: Math.max(40, Math.min(220, Number(j.bpm) || 90)),
      key: String(j.key || "A minor").slice(0, 24),
    };
  });

// ─── ToolHUB · Architect ─────────────────────────────────────────
export type ArchitectReview = {
  verdict: "pass" | "warn" | "fail";
  mathSound: boolean;
  issues: string[];
  fixedCode: string | null;    // null when verdict === "pass"
  notes: string;
};

export const vetToolCode = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { description: string; code: string }) => ({
    description: String(d.description || "").slice(0, 600),
    code: String(d.code || "").slice(0, 12000),
  }))
  .handler(async ({ data, context }): Promise<ArchitectReview> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertVipOrPaid(supabase, userId);
    const sys =
      "You are 0G-BRAIN's Code Architect. Audit JavaScript for a customer-facing calculator/tool. Verify the math is flawless, edge cases handled (zero, negatives, NaN, division), no XSS, no unbounded loops. If anything is wrong, return a corrected drop-in version. Output STRICT JSON only.";
    const user = `TOOL DESCRIPTION:
${data.description}

CODE:
\`\`\`js
${data.code}
\`\`\`

Return JSON:
{
  "verdict": "pass" | "warn" | "fail",
  "mathSound": true|false,
  "issues": ["short issue", "..."],
  "fixedCode": "full corrected JS or null if pass",
  "notes": "1-2 sentence summary"
}`;
    const j = await geminiJSON<any>(sys, user, {});
    const verdict: ArchitectReview["verdict"] =
      j.verdict === "pass" || j.verdict === "warn" || j.verdict === "fail" ? j.verdict : "warn";
    return {
      verdict,
      mathSound: !!j.mathSound,
      issues: Array.isArray(j.issues) ? j.issues.slice(0, 8).map((s: any) => String(s).slice(0, 240)) : [],
      fixedCode: j.fixedCode && verdict !== "pass" ? String(j.fixedCode).slice(0, 14000) : null,
      notes: String(j.notes || "").slice(0, 400),
    };
  });