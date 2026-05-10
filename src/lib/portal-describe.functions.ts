import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Kind = "jokes" | "music" | "trade" | "connect" | "tools";

const KIND_BRIEF: Record<Kind, string> = {
  jokes: "an AI jokes portal — a themed page that hosts 5 freshly-generated short comedy bits in a specific style/voice",
  music: "a music landing portal — a themed page promoting a sound, artist or release with mood-driven visuals",
  trade: "a trade scout portal — a themed dashboard tracking an asset, sector or market angle",
  connect: "an outbound connect portal — a themed landing page targeting a specific ICP with a single offer",
  tools: "a tools portal — a themed wrapper around a small calculator or utility for a specific audience",
};

export const describePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: Kind; name?: string; niche?: string; vibe?: string; language?: string }) => ({
    kind: (["jokes", "music", "trade", "connect", "tools"].includes(data.kind) ? data.kind : "jokes") as Kind,
    name: String(data.name ?? "").trim().slice(0, 80),
    niche: String(data.niche ?? "").trim().slice(0, 400),
    vibe: String(data.vibe ?? "").trim().slice(0, 200),
    language: String(data.language ?? "English").trim().slice(0, 40) || "English",
  }))
  .handler(async ({ data }): Promise<{ description: string }> => {
    const LOVABLE = process.env.LOVABLE_API_KEY;
    if (!LOVABLE) throw new Error("AI is not configured");

    const seed = [data.name && `Name: ${data.name}`, data.niche && `Keywords: ${data.niche}`, data.vibe && `Vibe: ${data.vibe}`]
      .filter(Boolean)
      .join("\n");
    if (!seed) throw new Error("Add a portal name or some keywords first");

    const system =
      `You expand short keywords into a vivid, concrete brief for ${KIND_BRIEF[data.kind]}. ` +
      `Write 2-3 tight sentences (max 380 chars) in ${data.language}. ` +
      `Be specific about audience, tone and visual mood. No headings, no quotes, no markdown, no emoji.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: seed },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit — try again in a moment");
    if (res.status === 402) throw new Error("AI credits exhausted — top up to continue");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI gateway ${res.status}${t ? `: ${t.slice(0, 120)}` : ""}`);
    }
    const json = await res.json();
    const text: string = (json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("AI returned no description");
    return { description: text.slice(0, 400) };
  });