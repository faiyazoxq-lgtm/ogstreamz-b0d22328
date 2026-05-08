import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Result = { joke: string; headline: string; source?: string; error?: string; balance?: number };

export const generateLiveJoke = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { styles: string[]; custom: string }) => ({
    styles: Array.isArray(data.styles) ? data.styles.slice(0, 10).map(String) : [],
    custom: typeof data.custom === "string" ? data.custom.slice(0, 200) : "",
  }))
  .handler(async ({ data, context }): Promise<Result> => {
    const { supabase } = context as { supabase: any };

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
    const system =
      "You are 0G-PORTAL's underground comic — sharp, sarcastic, gritty, street-smart. " +
      "Find ONE viral or trending news story from the last 24 hours, then craft a single short joke (1-3 sentences) about it. " +
      "Tone styles to apply: " + styleStr + ". " +
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
          { role: "user", content: "Pull today's most viral story and give me the joke." },
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
    return { joke, headline, source: citations[0], balance: balance as number };
  });
