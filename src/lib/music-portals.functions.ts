import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "music";
}

function inferTheme(style: string, vibe: string): string {
  const t = `${style} ${vibe}`.toLowerCase();
  if (/(nasheed|spirit|sufi|mosque|qasida|hymn|gospel|sacred)/.test(t)) return "spiritual-blue";
  if (/(grime|drill|street|trap|hood|gritty)/.test(t)) return "street-neon";
  if (/(lofi|chill|study|jazz)/.test(t)) return "lofi-haze";
  if (/(synth|cyber|future|edm|vapor)/.test(t)) return "cyber";
  if (/(folk|country|acoustic|indie)/.test(t)) return "warm-folk";
  return "studio-blue";
}

export const spawnMusicPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string; language: string; style: string; vibe: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 60),
    language: String(data.language || "English").trim().slice(0, 40),
    style: String(data.style || "").trim().slice(0, 120),
    vibe: String(data.vibe || "").trim().slice(0, 200),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.slug || !data.style) throw new Error("Slug and style required");

    const baseSlug = slugify(data.slug);
    let slug = baseSlug;
    const { data: existing } = await supabase.from("portals").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;

    const theme = inferTheme(data.style, data.vibe);
    const name = data.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const { data: portal, error } = await supabase
      .from("portals")
      .insert({
        slug,
        name,
        kind: "music",
        niche: data.style,
        style: data.style,
        language: data.language,
        vibe: data.vibe,
        theme,
        jokes: [],
        created_by: userId,
      })
      .select("id, slug, name, theme")
      .single();
    if (error) throw new Error(error.message);
    return { portal };
  });

export const formatLyrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string; raw: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    raw: String(data.raw || "").trim().slice(0, 4000),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    if (!data.raw) throw new Error("Add some text to format");
    const { data: portal } = await supabase
      .from("portals")
      .select("language, style, vibe, name")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

    const prompt = `Rewrite the user's input as Suno-ready song lyrics in ${portal.language}, in the style of "${portal.style}". Use clear section tags exactly like [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. Keep it singable, rhythmic, true to the style. Output ONLY the lyrics with section tags — no explanations.\n\nUser input:\n${data.raw}`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a professional songwriter. Output lyrics only with [Section] tags." },
          { role: "user", content: prompt },
        ],
        temperature: 0.85,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) throw new Error(`Perplexity ${res.status}`);
    const json = await res.json();
    const lyrics: string = (json?.choices?.[0]?.message?.content ?? "").trim();
    if (!lyrics) throw new Error("No lyrics returned");
    return { lyrics };
  });

export const requestStudioTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string; lyrics: string; notes?: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    lyrics: String(data.lyrics || "").trim().slice(0, 6000),
    notes: String(data.notes || "").trim().slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.lyrics) throw new Error("Format your lyrics first");
    const { data: portal } = await supabase
      .from("portals")
      .select("style, vibe, language")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    const vibe = `[${portal.language}] ${portal.style} — ${portal.vibe ?? ""}`.slice(0, 300);
    const { data: req, error } = await supabase
      .from("custom_track_requests")
      .insert({
        user_id: userId,
        vibe,
        lyrics: data.lyrics,
        notes: data.notes || null,
        portal_slug: data.slug,
        status: "pending",
        credits_spent: 0,
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    return { request: req };
  });

export type SunoStack = {
  timbre: string;        // [Genre/Timbre]
  moodKey: string;       // [Mood/BPM/Key]
  vocal: string;         // [Vocal Texture]
  structure: string;     // [Structure Tags]
  formatted: string;     // ready to paste in Suno Custom Mode
};

export const generateSunoStack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string; vibe: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    vibe: String(data.vibe || "").trim().slice(0, 400),
  }))
  .handler(async ({ data, context }): Promise<SunoStack> => {
    const { supabase } = context as { supabase: any };
    if (!data.vibe) throw new Error("Describe a vibe first");

    const { data: portal } = await supabase
      .from("portals")
      .select("language, style, vibe")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    // Charge 1 credit (VIP bypass via RPC)
    const { error: spendErr } = await supabase.rpc("spend_credits", {
      _amount: 1,
      _reason: "suno-stack",
    });
    if (spendErr) {
      const msg = (spendErr.message || "").toLowerCase();
      if (msg.includes("insufficient")) throw new Error("Insufficient credits");
      throw new Error(spendErr.message);
    }

    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

    const sys =
      "You are a Suno V5.5 prompt engineer. Output STRICT JSON only — no markdown, no preamble. " +
      "Build a 4-layer Style Vector Stack for Suno Custom Mode.";

    const user = `Portal style: ${portal.style}
Language: ${portal.language}
Portal vibe: ${portal.vibe || "n/a"}
User vibe: ${data.vibe}

Return JSON:
{
  "timbre": "Genre + instrument timbre, max 18 words. Reference real synths/instruments + recording quality.",
  "moodKey": "Mood + BPM (integer) + Key (e.g. C Major, F# Minor). Max 14 words.",
  "vocal": "Vocal texture description, gender, range, delivery. Max 14 words.",
  "structure": "2-4 Suno tags like [Intro], [Verse], [Chorus], [ad-lib: ...]. Comma-separated."
}`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    if (!res.ok) throw new Error(`Perplexity ${res.status}`);
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try { parsed = JSON.parse(m ? m[0] : raw); } catch { throw new Error("Suno stack parse failed"); }

    const timbre = String(parsed.timbre || "").trim();
    const moodKey = String(parsed.moodKey || "").trim();
    const vocal = String(parsed.vocal || "").trim();
    const structure = String(parsed.structure || "").trim();

    const formatted = `[Genre/Timbre] ${timbre}
[Mood/BPM/Key] ${moodKey}
[Vocal Texture] ${vocal}
[Structure] ${structure}`;

    return { timbre, moodKey, vocal, structure, formatted };
  });