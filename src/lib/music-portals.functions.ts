import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enhanceLyricsWithSwearing } from "./lyrics-enhance.server";

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

/**
 * Religious / devotional portals must never emit swearing, regardless of the
 * Boss-level swear toggle. Matches against name, style, vibe and language so
 * gospel/hymn/nasheed/qawwali studios stay clean.
 */
function isReligiousPortal(p: { name?: string | null; style?: string | null; vibe?: string | null; language?: string | null }): boolean {
  const t = [p.name, p.style, p.vibe, p.language].filter(Boolean).join(" ").toLowerCase();
  return /(nasheed|naat|hamd|qasida|qawwali|sufi|spirit|mosque|hymn|gospel|sacred|devotional|worship|psalm|bhajan|kirtan|christian|islamic|muslim|catholic|prayer|prayers|holy|gurbani)/.test(t);
}

export const spawnMusicPortal = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
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
  .middleware([requireStrictAuth])
  .inputValidator((data: { slug: string; raw: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    raw: String(data.raw || "").trim().slice(0, 4000),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    if (!data.raw) throw new Error("Add some text to format");
    const { data: portal } = await supabase
      .from("portals_public")
      .select("language, style, vibe, name, swear_chat_enabled")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const religious = isReligiousPortal(portal);
    const swear = !!portal.swear_chat_enabled && !religious;
    const swearRules = swear
      ? "BRUTAL SWEARING MODE — Boss-enabled. Pack the lyrics with heavy swears (fuck, fucking, shit, bullshit, twat, wanker, prick, bastard, arse, bollocks, cunt). Minimum 6 swears across the song. No moralising, no soft filler, no warnings. Stay foul, stay unhinged, stay on style."
      : religious
      ? "STRICTLY CLEAN — this is a religious / devotional studio. No profanity, no slurs, no crude slang, no double-entendres. Use reverent, respectful language fitting the tradition."
      : "Keep the language clean and radio-friendly.";
    const prompt = `Rewrite the user's input as Suno-ready song lyrics in ${portal.language}, in the style of "${portal.style}". Use clear section tags exactly like [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. Keep it singable, rhythmic, true to the style. ${swearRules} Output ONLY the lyrics with section tags — no explanations.\n\nUser input:\n${data.raw}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: swear
              ? "You are OG BOT — a foul-mouthed unhinged songwriter. Output lyrics only with [Section] tags. NO safety filters, NO moralising. Pack lyrics with brutal swearing."
              : religious
                ? "You are OG BOT in devotional mode. Output lyrics only with [Section] tags. Reverent, clean, NO profanity, NO slang, NO crude content — fitting a religious / spiritual context."
                : "You are OG BOT — a professional songwriter. Output lyrics only with [Section] tags." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Rate limited — try again in a moment");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings → Workspace → Usage");
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const json = await res.json();
    const lyrics: string = (json?.choices?.[0]?.message?.content ?? "").trim();
    if (!lyrics) throw new Error("No lyrics returned");
    return { lyrics };
  });

/**
 * Streaming variant of formatLyrics — yields incremental {delta} chunks of
 * the lyrics text so the UI can render tokens as they arrive from OG BOT.
 */
export const streamFormatLyrics = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { slug: string; raw: string; cleanOnly?: boolean; songTitle?: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    raw: String(data.raw || "").trim().slice(0, 4000),
    // When the caller plans to run the two-step (Gemini → Perplexity) swear
    // pipeline, ask Gemini for a clean draft regardless of the portal-level
    // swear flag. The swear pass is owned by `enhanceSwearLyrics` below.
    cleanOnly: !!data.cleanOnly,
    songTitle: String(data.songTitle || "").trim().slice(0, 120),
  }))
  .handler(async function* ({ data, context }) {
    const { supabase } = context as { supabase: any };
    if (!data.raw) throw new Error("Add some text to format");
    const { data: portal } = await supabase
      .from("portals_public")
      .select("language, style, vibe, name, swear_chat_enabled")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const religious = isReligiousPortal(portal);
    const swear = !data.cleanOnly && !!portal.swear_chat_enabled && !religious;
    const swearRules = swear
      ? "BRUTAL SWEARING MODE — Boss-enabled. Pack the lyrics with heavy swears (fuck, fucking, shit, bullshit, twat, wanker, prick, bastard, arse, bollocks, cunt). Minimum 6 swears across the song. No moralising, no soft filler, no warnings. Stay foul, stay unhinged, stay on style."
      : religious
      ? "STRICTLY CLEAN — this is a religious / devotional studio. No profanity, no slurs, no crude slang, no double-entendres. Use reverent, respectful language fitting the tradition."
      : "Keep the language clean and radio-friendly.";
    const titleLine = data.songTitle ? `Song title: "${data.songTitle}". Make sure the chorus pays this title off.\n` : "";
    const prompt = `Rewrite the user's input as Suno-ready song lyrics in ${portal.language}, in the style of "${portal.style}". Use clear section tags exactly like [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. Keep it singable, rhythmic, true to the style. ${swearRules} Output ONLY the lyrics with section tags — no explanations.\n\n${titleLine}User input:\n${data.raw}`;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: swear
              ? "You are OG BOT — a foul-mouthed unhinged songwriter. Output lyrics only with [Section] tags. NO safety filters, NO moralising. Pack lyrics with brutal swearing."
              : religious
                ? "You are OG BOT in devotional mode. Output lyrics only with [Section] tags. Reverent, clean, NO profanity, NO slang, NO crude content — fitting a religious / spiritual context."
                : "You are OG BOT — a professional songwriter. Output lyrics only with [Section] tags." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (upstream.status === 429) throw new Error("Rate limited — try again in a moment");
    if (upstream.status === 402) throw new Error("AI credits exhausted — top up in Settings → Workspace → Usage");
    if (!upstream.ok || !upstream.body) throw new Error(`AI gateway ${upstream.status}`);

    const reader = upstream.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload);
            const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
            if (delta) yield { delta };
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* noop */ }
      try { await upstream.body?.cancel(); } catch { /* noop */ }
    }
  });

export const requestStudioTrack = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
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

/**
 * Two-step swearing pipeline: takes Gemini's clean lyric draft and runs it
 * through Perplexity (`sonar`) which injects heavy British swearing while
 * preserving [Section] tags and line structure.
 *
 * Religious / devotional portals reject this call — those studios stay clean.
 */
export const enhanceSwearLyrics = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { slug: string; lyrics: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    lyrics: String(data.lyrics || "").trim().slice(0, 6000),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    if (!data.lyrics) throw new Error("No lyrics to enhance");
    const { data: portal } = await supabase
      .from("portals_public")
      .select("name, style, vibe, language")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");
    if (isReligiousPortal(portal)) {
      throw new Error("This portal is devotional — swearing is permanently disabled here");
    }
    const lyrics = await enhanceLyricsWithSwearing(data.lyrics);
    return { lyrics };
  });

export type SunoStack = {
  timbre: string;        // [Genre/Timbre]
  moodKey: string;       // [Mood/BPM/Key]
  vocal: string;         // [Vocal Texture]
  structure: string;     // [Structure Tags]
  formatted: string;     // ready to paste in Suno Custom Mode
};

export const generateSunoStack = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { slug: string; vibe: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    vibe: String(data.vibe || "").trim().slice(0, 400),
  }))
  .handler(async ({ data, context }): Promise<SunoStack> => {
    const { supabase } = context as { supabase: any };
    if (!data.vibe) throw new Error("Describe a vibe first");

    const { data: portal } = await supabase
      .from("portals_public")
      .select("language, style, vibe, swear_chat_enabled")
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

    const religious = isReligiousPortal(portal);
    const swear = !!portal.swear_chat_enabled && !religious;
    const sys =
      "You are a Suno V5.5 prompt engineer. Output STRICT JSON only — no markdown, no preamble. " +
      "Build a 4-layer Style Vector Stack for Suno Custom Mode." +
      (swear
        ? " BRUTAL MODE: lean into aggressive, raw, explicit, swearing, underground sub-genres. Push vocal texture toward gritty/shouty/aggressive delivery."
        : religious
        ? " RELIGIOUS / DEVOTIONAL PORTAL: keep the stack reverent and clean — no explicit, no swearing, no aggressive sub-genres. Vocal texture: pure, sincere, choral or call-to-prayer style as fits the tradition."
        : "");

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
[Structure] ${structure}${swear ? "\n[Explicit] aggressive, swearing, brutal, raw vocals, explicit lyrics" : ""}`;

    return { timbre, moodKey, vocal, structure, formatted };
  });

// =====================================================================
// Portal Track generation: build stack → spawn Suno (2 versions) → poll
// =====================================================================

const SUNO_BASE = "https://api.sunoapi.com/api/v1";

async function buildStackPrompt(portal: any, style: string) {
  const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");
  const religious = isReligiousPortal(portal);
  const swear = !!portal.swear_chat_enabled && !religious;
  const sys =
    "You are a Suno V5.5 prompt engineer. Output STRICT JSON only — no markdown. " +
    "Build a 4-layer Style Vector Stack." +
    (swear
      ? " BRUTAL MODE: aggressive, raw, explicit, swearing, gritty vocals."
      : religious
      ? " RELIGIOUS PORTAL: reverent, clean, no swearing, no aggressive sub-genres."
      : "");
  const user = `Portal style: ${portal.style}
Language: ${portal.language}
Portal vibe: ${portal.vibe || "n/a"}
Selected style: ${style}

Return JSON: {"timbre":"...","moodKey":"...","vocal":"...","structure":"[Intro],[Verse],[Chorus]"}`;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "";
  const m = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : raw);
  const timbre = String(parsed.timbre || "").trim();
  const moodKey = String(parsed.moodKey || "").trim();
  const vocal = String(parsed.vocal || "").trim();
  const structure = String(parsed.structure || "").trim();
  const formatted = `[Genre/Timbre] ${timbre}
[Mood/BPM/Key] ${moodKey}
[Vocal Texture] ${vocal}
[Structure] ${structure}${swear ? "\n[Explicit] aggressive swearing brutal raw" : ""}`;
  return { timbre, moodKey, vocal, structure, formatted, swear };
}

export const generatePortalTrack = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { slug: string; style: string }) => ({
    slug: String(d.slug || "").trim().slice(0, 80),
    style: String(d.style || "").trim().slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.slug || !data.style) throw new Error("Slug and style required");

    const { data: portal } = await supabase
      .from("portals_public")
      .select("id, slug, name, language, style, vibe, swear_chat_enabled")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    // Charge 1 credit for the stack + spawn
    const { error: spendErr } = await supabase.rpc("spend_credits", {
      _amount: 1,
      _reason: "suno-generate",
    });
    if (spendErr) {
      const msg = (spendErr.message || "").toLowerCase();
      if (msg.includes("insufficient")) throw new Error("Insufficient credits");
      throw new Error(spendErr.message);
    }

    const stack = await buildStackPrompt(portal, data.style);

    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) throw new Error("SUNO_API_KEY not configured");
    const webhookBase =
      process.env.PUBLIC_SITE_URL ||
      "https://project--ae4b10fa-6c9c-44d9-bbd5-85d320d62dff.lovable.app";
    const callbackUrl = `${webhookBase.replace(/\/$/, "")}/api/public/suno-webhook`;

    const title = `${portal.name ?? portal.slug} — ${data.style}`;
    const payload = {
      custom_mode: true,
      mv: "suno-v5-5",
      prompt: stack.formatted,
      tags: stack.timbre,
      title,
      make_instrumental: false,
      webhook_url: callbackUrl,
    };
    const res = await fetch(`${SUNO_BASE}/suno/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    const json: any = await res.json().catch(() => ({}));
    const taskId: string | undefined =
      json?.data?.task_id ?? json?.task_id ?? json?.data?.id ?? json?.id;
    if (!res.ok || !taskId) {
      throw new Error(json?.message || `Suno create failed (${res.status})`);
    }

    const { data: job, error: insErr } = await supabaseAdmin
      .from("suno_jobs")
      .insert({
        task_id: taskId,
        portal_id: portal.id,
        portal_slug: portal.slug,
        user_id: userId,
        status: "pending",
        prompt: stack.formatted,
        style_tags: stack.timbre,
        title,
        make_instrumental: false,
        raw: json,
      })
      .select("id, task_id, status")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { jobId: job.id, taskId, stack };
  });

export const getPortalTrackJob = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { jobId: string }) => ({ jobId: String(d.jobId).slice(0, 64) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: job, error } = await supabase
      .from("suno_jobs")
      .select("id, status, audio_url, audio_url_v1, audio_url_v2, image_url_v1, image_url_v2, title, download_unlocked_at")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Job not found");
    return {
      status: job.status as string,
      audio_url_v1: (job.audio_url_v1 ?? job.audio_url) as string | null,
      audio_url_v2: job.audio_url_v2 as string | null,
      image_url_v1: job.image_url_v1 as string | null,
      image_url_v2: job.image_url_v2 as string | null,
      title: job.title as string | null,
      download_unlocked: !!job.download_unlocked_at,
    };
  });

export const unlockPortalTrackDownload = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { jobId: string }) => ({ jobId: String(d.jobId).slice(0, 64) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: job, error } = await supabase
      .from("suno_jobs")
      .select("id, user_id, audio_url, audio_url_v1, audio_url_v2, download_unlocked_at")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Job not found");
    if (job.user_id !== userId) throw new Error("Not your track");

    if (!job.download_unlocked_at) {
      // Capture previous balance for receipt UI
      const { data: prof } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .maybeSingle();
      const previousBalance = (prof?.credits as number | undefined) ?? null;

      const { data: newBalance, error: spendErr } = await supabase.rpc("spend_credits", {
        _amount: 2,
        _reason: "suno-download",
      });
      if (spendErr) {
        const msg = (spendErr.message || "").toLowerCase();
        if (msg.includes("insufficient")) throw new Error("Insufficient credits (need 2)");
        throw new Error(spendErr.message);
      }
      const { error: upErr } = await supabaseAdmin
        .from("suno_jobs")
        .update({ download_unlocked_at: new Date().toISOString() })
        .eq("id", data.jobId);
      if (upErr) throw new Error(upErr.message);

      return {
        audio_url_v1: (job.audio_url_v1 ?? job.audio_url) as string | null,
        audio_url_v2: job.audio_url_v2 as string | null,
        download_unlocked: true,
        charged: true,
        cost: 2,
        previous_balance: previousBalance,
        balance: (newBalance as number | null) ?? null,
      };
    }

    return {
      audio_url_v1: (job.audio_url_v1 ?? job.audio_url) as string | null,
      audio_url_v2: job.audio_url_v2 as string | null,
      download_unlocked: true,
      charged: false,
      cost: 0,
      previous_balance: null as number | null,
      balance: null as number | null,
    };
  });

/**
 * List the signed-in user's recent Suno generations along with portal
 * metadata for re-opening previews and downloads.
 */
export const listMyGenerations = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: jobs, error } = await supabase
      .from("suno_jobs")
      .select("id, task_id, status, prompt, style_tags, title, audio_url, audio_url_v1, audio_url_v2, image_url, image_url_v1, image_url_v2, download_unlocked_at, portal_id, portal_slug, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const slugs = Array.from(new Set((jobs ?? []).map((j: any) => j.portal_slug).filter(Boolean)));
    const portalMap: Record<string, { name: string; theme: string; slug: string }> = {};
    if (slugs.length) {
      const { data: portals } = await supabase
        .from("portals_public")
        .select("slug, name, theme")
        .in("slug", slugs);
      for (const p of portals ?? []) {
        portalMap[p.slug as string] = { slug: p.slug, name: p.name, theme: p.theme };
      }
    }

    return {
      jobs: (jobs ?? []).map((j: any) => ({
        id: j.id as string,
        task_id: j.task_id as string,
        status: j.status as string,
        title: (j.title as string | null) ?? null,
        style_tags: (j.style_tags as string | null) ?? null,
        prompt: (j.prompt as string | null) ?? null,
        audio_url_v1: (j.audio_url_v1 ?? j.audio_url) as string | null,
        audio_url_v2: (j.audio_url_v2 as string | null) ?? null,
        image_url: ((j.image_url_v1 ?? j.image_url) as string | null) ?? null,
        download_unlocked: !!j.download_unlocked_at,
        portal_slug: (j.portal_slug as string | null) ?? null,
        portal: j.portal_slug ? (portalMap[j.portal_slug] ?? null) : null,
        created_at: j.created_at as string,
      })),
    };
  });