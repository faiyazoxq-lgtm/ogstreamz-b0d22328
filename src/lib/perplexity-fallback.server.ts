/**
 * Perplexity-backed temporary fallbacks for when an upstream provider (e.g. Suno)
 * is unreachable. These functions never throw — they return null on failure so
 * the caller can decide how to surface the degraded state.
 */

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

export interface MusicBrief {
  title: string;
  style_tags: string;
  lyrics: string;
  notes: string;
}

export async function generateMusicBriefFallback(input: {
  prompt: string;
  style_tags: string;
  title?: string | null;
  make_instrumental?: boolean;
}): Promise<MusicBrief | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    console.error("[perplexity-fallback] PERPLEXITY_API_KEY missing");
    return null;
  }

  const sys =
    "You are a songwriting assistant. The Suno music API is temporarily down. " +
    "Produce a complete, ready-to-record track BRIEF in strict JSON. No prose, no markdown. " +
    "Schema: { title: string, style_tags: string, lyrics: string, notes: string }. " +
    "lyrics must include section labels like [Verse 1], [Chorus] etc. " +
    "If make_instrumental is true, lyrics should be an empty string and notes should " +
    "describe the arrangement, instrumentation, tempo and mood instead.";

  const user = JSON.stringify({
    prompt: input.prompt,
    style_tags: input.style_tags,
    title: input.title ?? null,
    make_instrumental: !!input.make_instrumental,
  });

  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "music_brief",
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                style_tags: { type: "string" },
                lyrics: { type: "string" },
                notes: { type: "string" },
              },
              required: ["title", "style_tags", "lyrics", "notes"],
            },
          },
        },
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      console.error("[perplexity-fallback] http", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json: any = await res.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.title || typeof parsed.lyrics !== "string") return null;
    return parsed as MusicBrief;
  } catch (e) {
    console.error("[perplexity-fallback] threw:", e);
    return null;
  }
}