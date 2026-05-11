import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * 0G-BRAIN Orchestrator — streaming proxy to Gemini.
 *
 * • thinking_mode: HIGH (thinkingBudget = -1, includeThoughts = true)
 * • googleSearch grounding tool enabled
 * • Hub-aware INSERT_INPUT template (TradeHUB / MusicHUB / generic)
 * • Streams Gemini's SSE straight back to the Boss Dashboard
 */

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

const ALLOWED_ORIGINS = new Set([
  "https://ogstreamz.lovable.app",
  "https://www.ogstreamz.co.uk",
  "https://ogstreamz.co.uk",
]);
function corsHeaders(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.has(origin) || origin.endsWith(".lovable.app")) ? origin : "https://ogstreamz.lovable.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

async function verifyUser(request: Request): Promise<{ ok: boolean; userId?: string; vip?: boolean; reason?: string }> {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false };
  try {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${m[1]}` } },
      },
    );
    const { data, error } = await sb.auth.getUser(m[1]);
    if (error || !data?.user) return { ok: false };
    // Gate the expensive Gemini 2.5 HIGH-thinking + Google Search stream behind
    // VIP / paid tier — same check used by zerog-brain.functions.ts.
    const { data: vipData, error: vipErr } = await sb.rpc("has_active_vip", { _user: data.user.id });
    if (vipErr) return { ok: false, reason: "entitlement_check_failed" };
    if (vipData !== true) return { ok: true, userId: data.user.id, vip: false, reason: "vip_required" };
    return { ok: true, userId: data.user.id, vip: true };
  } catch {
    return { ok: false };
  }
}

type Hub = "trade" | "music" | "tools" | "connect" | "general";

function buildPrompt(hub: Hub, params: Record<string, any>): { system: string; user: string } {
  switch (hub) {
    case "trade": {
      const asset = String(params.asset || "GOLD");
      const bias = String(params.bias || "NEUTRAL");
      const news = Array.isArray(params.news) ? params.news.slice(0, 20).join("\n• ") : "";
      return {
        system:
          "You are 0G-BRAIN's Senior Wall Street Analyst. Use HIGH-level thinking. Cross-reference live news with Google Search to find hidden correlations across rates, USD, geopolitics, and flows. Be decisive.",
        user: `Analyze ${asset} with a ${bias} bias. Use your High Thinking level to find hidden correlations in the provided news.

PROVIDED NEWS:
• ${news || "(none — rely on Google Search grounding)"}

Deliver: (1) 3 decisive facts, (2) the market pivot, (3) macro frame, (4) bias + confidence %.`,
      };
    }
    case "music": {
      const genre = String(params.genre || "Urdu/English fusion");
      const vibe = String(params.vibe || "");
      return {
        system:
          "You are 0G-BRAIN's multi-platinum producer. Use HIGH-level creative reasoning. Layer Suno V5.5 instrument-texture tags. Make Urdu/English code-switching poetic and hit-ready.",
        user: `Craft professional lyrics for ${genre} using high-level creative reasoning.
VIBE: ${vibe || "(producer's choice)"}
Return: structured [Verse]/[Chorus] lyrics + Suno V5.5 tag stack + BPM + key.`,
      };
    }
    case "tools": {
      const desc = String(params.description || "");
      const code = String(params.code || "");
      return {
        system:
          "You are 0G-BRAIN's Code Architect. Use HIGH-level reasoning. Audit math, edge cases, security. If broken, return drop-in fixed JS.",
        user: `TOOL: ${desc}\n\nCODE:\n\`\`\`js\n${code}\n\`\`\`\n\nVerdict + issues + fixed code.`,
      };
    }
    case "connect": {
      const company = String(params.company || "");
      const offer = String(params.offer || "");
      return {
        system:
          "You are 0G-BRAIN's outbound strategist. Use HIGH-level reasoning. Use Google Search to verify the prospect company is real and recently active.",
        user: `Build a personalized cold outreach angle for ${company}. Offer: ${offer}. Output ICP, hook, and 3-line email body.`,
      };
    }
    default:
      return {
        system:
          "You are 0G-BRAIN, the executive AI orchestrator. Use HIGH-level thinking. Ground answers with Google Search where useful.",
        user: String(params.prompt || params.input || ""),
      };
  }
}

export const Route = createFileRoute("/api/public/0g-orchestrator")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, {
          status: 204,
          headers: corsHeaders(request.headers.get("origin")),
        }),
      POST: async ({ request }) => {
        const cors = corsHeaders(request.headers.get("origin"));
        const auth = await verifyUser(request);
        if (!auth.ok) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...cors },
          });
        }
        if (!auth.vip) {
          const status = auth.reason === "entitlement_check_failed" ? 500 : 403;
          const msg = auth.reason === "entitlement_check_failed"
            ? "Unable to verify entitlement"
            : "VIP / paid tier required to use 0G-BRAIN orchestrator";
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "Content-Type": "application/json", ...cors },
          });
        }
        const KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
        if (!KEY) {
          return new Response(JSON.stringify({ error: "GOOGLE_AI_STUDIO_API_KEY missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...cors },
          });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400, headers: cors });
        }

        const hub: Hub = (body?.hub as Hub) || "general";
        const rawParams = (body?.params && typeof body.params === "object") ? body.params : {};
        // Cap any string field at 4000 chars to limit prompt-injection blast radius.
        const params: Record<string, any> = {};
        for (const [k, v] of Object.entries(rawParams)) {
          params[k] = typeof v === "string" ? v.slice(0, 4000) : v;
        }
        const { system, user } = buildPrompt(hub, params);

        const upstream = await fetch(`${ENDPOINT}&key=${encodeURIComponent(KEY)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            // Grounding with Google Search
            tools: [{ google_search: {} }],
            generationConfig: {
              temperature: 0.6,
              // thinking_mode: HIGH — dynamic max budget + emit thought summaries
              thinkingConfig: {
                thinkingBudget: -1,
                includeThoughts: true,
              },
            },
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const errTxt = await upstream.text().catch(() => "");
          console.error("0G-BRAIN upstream error", upstream.status, errTxt);
          return new Response(
            JSON.stringify({ error: `Gemini ${upstream.status}`, detail: errTxt.slice(0, 500) }),
            { status: 502, headers: { "Content-Type": "application/json", ...cors } },
          );
        }

        // Stream Gemini's SSE straight through to the client
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            ...cors,
          },
        });
      },
    },
  },
});