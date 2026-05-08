import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type Result = { joke: string; headline: string; source?: string; error?: string };

async function isVipOrAdmin(token: string): Promise<{ ok: boolean; reason?: string }> {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const supa = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes } = await supa.auth.getUser();
  if (!userRes?.user) return { ok: false, reason: "unauthenticated" };
  const uid = userRes.user.id;
  const [{ data: prof }, { data: roles }] = await Promise.all([
    supa.from("profiles").select("status").eq("id", uid).maybeSingle(),
    supa.from("user_roles").select("role").eq("user_id", uid),
  ]);
  const isAdmin = !!roles?.some((r: { role: string }) => r.role === "admin");
  const isVip = (prof as { status?: string } | null)?.status === "vip";
  if (!isVip && !isAdmin) return { ok: false, reason: "not_vip" };
  return { ok: true };
}

export const generateLiveJoke = createServerFn({ method: "POST" })
  .inputValidator((data: { styles: string[]; custom: string; token: string }) => ({
    styles: Array.isArray(data.styles) ? data.styles.slice(0, 10).map(String) : [],
    custom: typeof data.custom === "string" ? data.custom.slice(0, 200) : "",
    token: typeof data.token === "string" ? data.token : "",
  }))
  .handler(async ({ data }): Promise<Result> => {
    const token = data.token;
    if (!token) return { joke: "", headline: "", error: "Sign in to access Live Wire." };
    const gate = await isVipOrAdmin(token);
    if (!gate.ok) {
      return {
        joke: "",
        headline: "",
        error: gate.reason === "not_vip" ? "Live Wire is a VIP-only frequency." : "Access denied.",
      };
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
    return { joke, headline, source: citations[0] };
  });
