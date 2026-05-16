/**
 * Lyrics swear-enhancement helper.
 *
 * Gemini writes the song clean (radio-friendly) and then this server-only
 * helper feeds the draft to Perplexity (`sonar` model) with a strict
 * rewrite prompt that injects heavy British swearing while preserving the
 * Suno section tags (`[Verse 1]`, `[Chorus]`, …) and overall structure.
 *
 * Religious / devotional portals must never call this — that gate lives in
 * the server function that owns the lyrics flow.
 */

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

export async function enhanceLyricsWithSwearing(cleanLyrics: string): Promise<string> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY is not configured");
  const src = (cleanLyrics ?? "").trim();
  if (!src) throw new Error("Nothing to enhance");

  const system =
    "You are OG BOT in BRUTAL SWEARING MODE. You rewrite radio-clean song lyrics by injecting heavy British swearing (fuck, fucking, shit, bullshit, twat, wanker, prick, bastard, arse, bollocks, cunt). " +
    "Rules: (1) preserve every [Section] tag exactly as given — [Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Bridge] [Outro] etc. (2) preserve line count and rough meter so the song still scans for Suno. (3) Weave swears into existing lines — do NOT stuff them at random or as filler ad-libs. (4) Minimum six (6) swears across the full song. (5) Output ONLY the rewritten lyrics — no preamble, no explanations, no markdown, no citations.";

  const body = {
    model: "sonar",
    temperature: 0.7,
    max_tokens: 1500,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Rewrite these lyrics in BRUTAL SWEARING MODE. Keep every [Section] tag and the line structure. Output only the rewritten lyrics.\n\n${src}`,
      },
    ],
  };

  const res = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new Error("Perplexity rate-limited — try again in a moment");
  if (res.status === 401 || res.status === 403) throw new Error("Perplexity auth failed — check PERPLEXITY_API_KEY");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Perplexity error ${res.status}${t ? `: ${t.slice(0, 200)}` : ""}`);
  }

  const json: any = await res.json().catch(() => ({}));
  const out: string = (json?.choices?.[0]?.message?.content ?? "").trim();
  if (!out) throw new Error("Perplexity returned empty lyrics");

  // Strip any accidental markdown fences / leading explainers.
  return out
    .replace(/^```[a-zA-Z]*\n?/g, "")
    .replace(/```$/g, "")
    .trim();
}