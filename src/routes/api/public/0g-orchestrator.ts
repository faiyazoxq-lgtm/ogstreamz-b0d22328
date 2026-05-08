import { createFileRoute } from "@tanstack/react-router";

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
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type, authorization",
          },
        }),
      POST: async ({ request }) => {
        const KEY = process.env.GEMINI_API_KEY;
        if (!KEY) {
          return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const hub: Hub = (body?.hub as Hub) || "general";
        const { system, user } = buildPrompt(hub, body?.params || {});

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
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        // Stream Gemini's SSE straight through to the client
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});