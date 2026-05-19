import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { validateReturnUrl } from "@/lib/return-url";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

/**
 * Unified wallpaper template — every hub uses the same prompt skeleton so
 * that all spawned portals share a consistent visual language. The hub's
 * niche/vibe/kind seed the imagery; the structural rules (no text, dark
 * center, cinematic widescreen) stay constant.
 */
function buildWallpaperPrompt(opts: {
  name: string;
  niche: string;
  vibe: string;
  kind: string;
}): string {
  const kindHint: Record<string, string> = {
    jokes: "comedy stage / club energy",
    music: "concert lighting, audio waveforms, stage haze",
    trade: "abstract market charts, glowing tickers, data grid",
    connect: "professional network constellations, soft node graph",
    tools: "blueprint / schematic / engineered surfaces",
  };
  const hint = kindHint[opts.kind] ?? "abstract atmospheric scene";
  return [
    `Cinematic widescreen wallpaper for an online portal called "${opts.name}".`,
    `Theme: ${opts.niche}. Mood / vibe: ${opts.vibe || "bold, modern"}.`,
    `Visual motif: ${hint}.`,
    `Style: hyper-detailed, cinematic, premium editorial; deep blacks with neon highlights; subtle film grain; 16:9 composition.`,
    `Composition rule: keep the horizontal center band (~30%) intentionally darker / less busy so overlaid white text remains legible.`,
    `Hard constraints: NO text, NO letters, NO numbers, NO logos, NO watermarks, NO borders, NO UI chrome, NO faces of real people.`,
  ].join(" ");
}

/**
 * Generate a custom wallpaper via Lovable AI (Nano Banana) and upload it
 * to the public `portal-bg` bucket. Best-effort — returns null on any
 * failure so portal creation never blocks on imagery.
 */
async function generatePortalWallpaper(opts: {
  slug: string;
  name: string;
  niche: string;
  vibe: string;
  kind: string;
}): Promise<{ url: string; prompt: string } | null> {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  if (!LOVABLE) return null;
  const prompt = buildWallpaperPrompt(opts);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      console.error("[wallpaper] gateway", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = await res.json();
    const dataUrl: string | undefined =
      json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:image")) return null;
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png";
    const ext = (mime.split("/")[1] ?? "png").replace("jpeg", "jpg");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `portals/${opts.slug}.${ext}`;
    const up = await supabaseAdmin.storage
      .from("portal-bg")
      .upload(path, bytes, { contentType: mime, upsert: true, cacheControl: "31536000" });
    if (up.error) {
      console.error("[wallpaper] upload", up.error.message);
      return null;
    }
    const pub = supabaseAdmin.storage.from("portal-bg").getPublicUrl(path);
    return { url: pub.data.publicUrl, prompt };
  } catch (e: any) {
    console.error("[wallpaper] error", e?.message ?? e);
    return null;
  }
}

/**
 * Hard cap for any single user's credit balance. Postgres `integer` tops out
 * at ~2.1B but we keep wallets well under that to prevent abuse and overflow.
 */
const MAX_CREDIT_BALANCE = 1_000_000;
/** Largest single refund we'll ever process in one call. */
const MAX_SINGLE_REFUND = 10_000;

/**
 * Refund credits previously charged via spend_credits when a downstream step
 * fails. Uses the admin client because the user's RLS-bound update on profiles
 * is blocked by `guard_profile_self_update` (privileged-column guard).
 *
 * Server-side safety guards (silently no-op + log on violation so a failed
 * refund never blocks the surrounding error path that triggered it):
 *   - amount must be a finite positive integer
 *   - amount must not exceed MAX_SINGLE_REFUND
 *   - userId must be a non-empty string
 *   - resulting balance must stay within [0, MAX_CREDIT_BALANCE]
 */
async function refundCredits(userId: string, amount: number, reason: string) {
  // ── Input validation ─────────────────────────────────────────────────────
  if (typeof userId !== "string" || userId.length === 0) {
    console.error("refundCredits rejected: invalid userId", { userId, amount, reason });
    return;
  }
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    // Non-positive / NaN / Infinity / float — nothing to refund.
    if (amount !== 0) {
      console.error("refundCredits rejected: invalid amount", { userId, amount, reason });
    }
    return;
  }
  if (amount > MAX_SINGLE_REFUND) {
    console.error("refundCredits rejected: amount exceeds MAX_SINGLE_REFUND", {
      userId, amount, reason, max: MAX_SINGLE_REFUND,
    });
    return;
  }

  try {
    const { data: prof, error: readErr } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!prof) {
      console.error("refundCredits rejected: profile not found", { userId, amount, reason });
      return;
    }

    const currentRaw = Number(prof.credits ?? 0);
    // Sanity-check the existing balance — corrupt data shouldn't get worse.
    const current =
      Number.isFinite(currentRaw) && Number.isInteger(currentRaw) && currentRaw >= 0
        ? currentRaw
        : 0;

    // Overflow / over-cap guard. Refund is capped to whatever fits under the
    // ceiling; if there is no headroom at all, abort and log for reconciliation.
    const headroom = MAX_CREDIT_BALANCE - current;
    if (headroom <= 0) {
      console.error("refundCredits rejected: balance already at cap", {
        userId, amount, reason, current, cap: MAX_CREDIT_BALANCE,
      });
      return;
    }
    const applied = Math.min(amount, headroom);
    if (applied < amount) {
      console.warn("refundCredits clamped to balance cap", {
        userId, requested: amount, applied, current, cap: MAX_CREDIT_BALANCE, reason,
      });
    }
    const next = current + applied;
    // Defensive: should be impossible after the headroom check, but never write
    // a value that would violate our invariants.
    if (next < 0 || next > MAX_CREDIT_BALANCE || !Number.isSafeInteger(next)) {
      console.error("refundCredits aborted: computed balance out of range", {
        userId, current, applied, next, reason,
      });
      return;
    }

    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({ credits: next, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updErr) throw updErr;

    await supabaseAdmin
      .from("credit_ledger")
      .insert({ user_id: userId, delta: applied, reason: `refund:${reason}` });
  } catch (e) {
    // Best-effort: log so admins can manually reconcile if both writes fail.
    console.error("refundCredits failed", { userId, amount, reason, error: e });
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "portal";
}

function inferTheme(vibe: string, niche: string): string {
  const t = `${vibe} ${niche}`.toLowerCase();
  if (/(china|chinese|asia|kanji|sushi|japan|temple|ancient)/.test(t)) return "ancient-china";
  if (/(street|hood|gritty|graffiti|urban|yo[\s-]?mama)/.test(t)) return "street";
  if (/(neon|cyber|future|tokyo|synth)/.test(t)) return "cyber";
  if (/(arab|desert|sand|sultan|persia)/.test(t)) return "desert";
  if (/(viking|norse|nordic|metal|forge)/.test(t)) return "norse";
  if (/(jungle|tropical|reggae|carib)/.test(t)) return "jungle";
  return "street";
}

/**
 * Translate a free-form vibe string into a short, unambiguous direction
 * the LLM can actually act on. Falls through to the raw vibe verbatim when
 * we don't recognize a keyword, so users keep full control.
 */
function expandVibe(vibe: string): string {
  const v = vibe.trim();
  if (!v) return "bold, modern, on-trend";
  const k = v.toLowerCase();
  const hints: { match: RegExp; tone: string }[] = [
    { match: /(savage|brutal|roast|spicy|harsh)/, tone: "savage roast energy — sharp, mean, punchline-first, never wholesome" },
    { match: /(wholesome|family|kid|clean|safe)/, tone: "wholesome and clean — no profanity, no innuendo, broadly safe for all ages" },
    { match: /(dark|edgy|nihilist|gallows)/, tone: "dark / gallows humor — bleak, dry, deadpan; no slurs, no shock-for-shock" },
    { match: /(dad|pun|groan)/, tone: "classic dad-joke / pun energy — setup + groan-worthy wordplay punchline" },
    { match: /(absurd|surreal|weird|chaotic)/, tone: "absurdist surreal humor — non-sequitur logic, escalating weirdness" },
    { match: /(corporate|office|workplace|saas)/, tone: "corporate / office humor — Slack-thread cadence, jargon, meeting pain" },
    { match: /(drill|trap|grime|street)/, tone: "street / drill cadence — short bars, internal rhyme, swagger, hard consonants" },
    { match: /(lofi|lo-fi|chill|chillhop)/, tone: "lo-fi chill — soft, melodic, nocturnal, study-vibe imagery" },
    { match: /(afrobeat|amapiano|dancehall)/, tone: "afrobeats / amapiano cadence — call-and-response hook, percussive language" },
    { match: /(country|americana|folk)/, tone: "country / Americana storytelling — concrete imagery, plainspoken, narrative hook" },
    { match: /(nasheed|sacred|spiritual|devotional)/, tone: "devotional / sacred tone — reverent, melodic, no profanity, no romance tropes" },
    { match: /(metal|hardcore|punk)/, tone: "metal / hardcore — aggressive, declarative, anthemic shout-along hook" },
    { match: /(minimal|clean|swiss|brutal\w*)/, tone: "minimalist precision — no fluff, single-purpose, plainspoken" },
    { match: /(playful|fun|whimsical|cartoon)/, tone: "playful and whimsical — light, energetic, friendly cadence" },
    { match: /(luxury|premium|elegant|refined)/, tone: "premium editorial tone — refined diction, restrained, confident" },
  ];
  const matched = hints.find((h) => h.match.test(k));
  return matched ? `${v} — ${matched.tone}` : v;
}

/** Cheap heuristic: does `s` look like it's actually written in `lang`? */
function looksLikeLanguage(s: string, lang: string): boolean {
  const L = lang.trim().toLowerCase();
  if (!L || L === "english") {
    // Reject strings that are *mostly* non-Latin when English was requested.
    const nonLatin = (s.match(/[^\x00-\x7F]/g) ?? []).length;
    return nonLatin / Math.max(s.length, 1) < 0.3;
  }
  const tests: Record<string, RegExp> = {
    arabic: /[\u0600-\u06FF]/,
    chinese: /[\u4E00-\u9FFF]/,
    japanese: /[\u3040-\u30FF\u4E00-\u9FFF]/,
    korean: /[\uAC00-\uD7AF]/,
    russian: /[\u0400-\u04FF]/,
    hebrew: /[\u0590-\u05FF]/,
    hindi: /[\u0900-\u097F]/,
    thai: /[\u0E00-\u0E7F]/,
    greek: /[\u0370-\u03FF]/,
  };
  for (const [k, re] of Object.entries(tests)) {
    if (L.includes(k)) return re.test(s);
  }
  // Romance / Germanic langs: at least don't be predominantly CJK / Cyrillic.
  return !/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(s);
}

export const spawnPortal = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { name: string; niche: string; language: string; vibe: string; vip?: boolean; useScout?: boolean; kind?: string }) => ({
    name: String(data.name || "").trim().slice(0, 80),
    niche: String(data.niche || "").trim().slice(0, 400),
    language: String(data.language || "English").trim().slice(0, 40),
    vibe: String(data.vibe || "").trim().slice(0, 200),
    vip: !!data.vip,
    useScout: data.useScout !== false,
    kind: (["jokes","music","trade","connect","tools"].includes(String(data.kind || "")) ? String(data.kind) : "jokes") as "jokes"|"music"|"trade"|"connect"|"tools",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.name || !data.niche) throw new Error("Name and niche required");

    // Members pay 1 credit per spawn; admins spawn free.
    const admin = await isAdmin(supabase, userId);
    let charged = 0;
    if (!admin) {
      const { error: spendErr } = await supabase.rpc("spend_credits", {
        _amount: 1,
        _reason: `spawn_portal:${data.kind}`,
      });
      if (spendErr) {
        const msg = (spendErr.message || "").toLowerCase();
        if (msg.includes("insufficient")) throw new Error("Not enough credits — top up to spawn a portal");
        throw new Error(spendErr.message || "Could not charge credits");
      }
      charged = 1;
    }

    // From here on, any thrown error must refund `charged` credits before
    // bubbling up so the user is not billed for a failed spawn.
    try {
    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");
    const FIRECRAWL = process.env.FIRECRAWL_API_KEY;
    const LOVABLE = process.env.LOVABLE_API_KEY;

    // ───── Scout: Firecrawl search for fresh news ─────
    let scoutMeta: { sources: string[]; headlines: string[]; summary: string } = { sources: [], headlines: [], summary: "" };
    if (data.useScout && FIRECRAWL) {
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: `latest ${data.niche}`, limit: 5 }),
        });
        if (fcRes.ok) {
          const fc = await fcRes.json();
          const arr: any[] = fc?.data?.web ?? fc?.data ?? [];
          scoutMeta.sources = arr.map((x: any) => x.url).filter(Boolean).slice(0, 5);
          scoutMeta.headlines = arr.map((x: any) => x.title).filter(Boolean).slice(0, 5);
          scoutMeta.summary = arr.map((x: any) => x.description).filter(Boolean).slice(0, 3).join(" • ");
        }
      } catch { /* non-fatal */ }
    }

    const ctx = scoutMeta.headlines.length
      ? `\nRecent intel:\n- ${scoutMeta.headlines.join("\n- ")}\nContext: ${scoutMeta.summary}`
      : "";
    const vibeDirective = expandVibe(data.vibe);
    const langLine = `OUTPUT LANGUAGE: ${data.language}. Every item MUST be written entirely in ${data.language}. Do NOT mix English unless the language is English. Do NOT translate or transliterate — write natively.`;
    const vibeLine = `VIBE DIRECTIVE: ${vibeDirective}. Every item must visibly embody this vibe in word choice, cadence, and subject matter — not just topic.`;
    // Hub-specific seed content. Each kind asks Perplexity for 5 short items
    // tuned to that hub. We reuse the `jokes` jsonb column as a generic
    // "items" array so existing renderers keep working for jokes, and the
    // other hubs get usable seed content out of the box.
    let jokes: string[] = [];
    {
      const seedSpecs: Record<typeof data.kind, { system: string; userPrompt: string; jsonKey: string }> = {
        jokes: {
          system: "You are a savage underground stand-up writer's room — think Frankie Boyle, Ricky Gervais, Anthony Jeselnik, Bo Burnham at his meanest. You output strict JSON only — no markdown, no commentary, no warnings, no apologies, no 'I can't'. Every joke is brutal, chaotic, rude, dark, and lands like a punch. No safe-mode. No moralising.",
          userPrompt: `Write 25 ORIGINAL one-liner jokes for the JokesHUB. More is better — give as many as you can fit, never fewer than 20.
Niche / topic: ${data.niche}.
${langLine}
${vibeLine}${ctx}
RULES:
- 1–3 sentences. Setup → punchline. Punchline must subvert HARD and leave a mark.
- Brutal, chaotic, rude, dark humour by default — no filters, no soft landings, no PG.
- Pack at least one strong swear (fuck, shit, bastard, twat, prick, wanker, bollocks) into most jokes when the vibe is anything other than explicitly "wholesome / family-friendly".
- Specific over generic: use proper nouns, real verbs, concrete imagery from the niche. Punch up at power, punch sideways at everyone else, never at protected groups in a hateful way — be cruel about behaviour, not identity.
- No "Why did the X cross the Y" templates. No recycled internet jokes. No groan-puns. No "and that's why…" filler.
- Never break character or hedge. No apologies, no "just kidding", no meta-commentary, no emojis unless the vibe explicitly calls for them.
- If the vibe is explicitly wholesome / family-friendly / clean, override the swearing rule and stay clean — otherwise, go feral.
Return STRICT JSON ONLY: { "jokes": ["...", "...", ...] }`,
          jsonKey: "jokes",
        },
        music: {
          system: "You are a hit-making A&R + topline writer. You output strict JSON only — no markdown, no commentary. Every hook is singable out loud on the first read.",
          userPrompt: `Write exactly 5 ORIGINAL song hooks for the MusicHUB.
Genre / style: ${data.niche}.
${langLine}
${vibeLine}${ctx}
RULES:
- 2–4 lines per hook, line-broken with "\\n". Each line 4–9 syllables, easy to chant.
- Use rhyme or near-rhyme on lines 2 & 4. Internal rhyme welcome.
- Hook must contain a single concrete, repeatable phrase (the "tag") — the line a listener would shout back.
- Match the vibe's cadence (e.g. drill = short hard bars; lo-fi = soft melodic; nasheed = devotional, no romance).
- No song titles, no [verse]/[chorus] labels, no artist names, no production notes.
Return STRICT JSON ONLY: { "items": ["line1\\nline2\\nline3\\nline4", "..."] }`,
          jsonKey: "items",
        },
        trade: {
          system: "You output strict JSON only. No markdown. You are a sentiment analyst, not a financial advisor. Never give buy/sell instructions.",
          userPrompt: `Generate exactly 5 short ${data.language} trade-setup briefs for a sentiment-only portal. Asset/sector: ${data.niche}. Vibe: ${data.vibe || "n/a"}.${ctx}\nEach brief: 1 sentence setup + 1 sentence catalyst, neutral wording, ends with "Sentiment only — not financial advice." Return STRICT JSON ONLY: { "items": ["...", "..."] }. No commentary.`,
          jsonKey: "items",
        },
        connect: {
          system: "You output strict JSON only. No markdown.",
          userPrompt: `Generate exactly 5 short cold-outreach opener lines in ${data.language} for an outbound campaign portal. ICP / offer: ${data.niche}. Tone / vibe: ${data.vibe || "n/a"}.${ctx}\nEach opener: 1-2 sentences, personal-feeling, no spam tropes ("hope this finds you well"), ends with a soft question. Return STRICT JSON ONLY: { "items": ["...", "..."] }. No commentary.`,
          jsonKey: "items",
        },
        tools: {
          system: "You are a senior product engineer designing single-purpose micro-tools. You output strict JSON only — no markdown, no commentary. Every idea is something a competent dev could ship in under a day.",
          userPrompt: `Design exactly 5 ORIGINAL micro-tool / calculator ideas for the ToolHUB.
Niche / domain: ${data.niche}.
${langLine}
${vibeLine}${ctx}
RULES:
- Format EXACTLY: "<Tool Name> — <one sentence: what it computes, listing the concrete inputs and the concrete output>".
- Inputs must be NAMED and TYPED implicitly (e.g. "monthly revenue (USD), churn rate (%), ARPU (USD)"), not vague ("some numbers").
- Output must be a single decision-grade number, verdict, or short table — not a "report" or "analysis".
- No generic "AI assistant", no "chatbot", no "dashboard". Single calculation per tool.
- Tool name is 2–4 words, Title Case, niche-flavored. No emojis unless vibe calls for them.
Return STRICT JSON ONLY: { "items": ["...", "...", "...", "...", "..."] }`,
          jsonKey: "items",
        },
      };
      const spec = seedSpecs[data.kind];

      const callSeed = async (extraSystem?: string): Promise<string[]> => {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: extraSystem ? `${spec.system}\n${extraSystem}` : spec.system },
              { role: "user", content: spec.userPrompt },
            ],
            temperature: 0.85,
            max_tokens: data.kind === "jokes" ? 3500 : 1100,
          }),
        });
        if (!res.ok) throw new Error(`Perplexity ${res.status}`);
        const json = await res.json();
        const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
        const match = raw.match(/\{[\s\S]*\}/);
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(match ? match[0] : raw); } catch { /* */ }
        const arr = (parsed[spec.jsonKey] ?? parsed.items ?? parsed.jokes) as unknown;
        const items = (Array.isArray(arr) ? arr : [])
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
        // Non-joke kinds keep a small seed; jokes take everything the model returns.
        return data.kind === "jokes" ? items : items.slice(0, 5);
      };

      jokes = await callSeed();
      // Language-fidelity guard: if half or more items don't look like the
      // requested language, retry once with a stricter directive.
      const offLang = jokes.filter((j) => !looksLikeLanguage(j, data.language)).length;
      if (jokes.length > 0 && offLang * 2 >= jokes.length) {
        try {
          const retry = await callSeed(
            `STRICT REWRITE: the previous response had items not written in ${data.language}. Every single item MUST be in ${data.language}. Do not include any English words or transliteration unless ${data.language} itself is English.`,
          );
          if (retry.length > 0) jokes = retry;
        } catch { /* keep original */ }
      }
      if (jokes.length === 0) {
        throw new Error(`No ${data.kind} seeds generated — try a more specific niche`);
      }
    }

    // ───── Creative Director: Perplexity-generated Style Dictionary ─────
    let themeConfig: any = null;
    try {
      const kindBrandHint: Record<typeof data.kind, string> = {
        jokes: "JokesHUB — comedy stage / club / spotlight energy. Bold display fonts, contrasty palette.",
        music: "MusicHUB — concert / studio energy. Type pair must support song-lyric layouts. Palette = stage lighting.",
        trade: "TradeHUB — terminal / tape / chart energy. Mono or grotesk type. Cool, neutral palette.",
        connect: "ConnectHUB — network / professional energy. Clean, trustworthy type. Restrained accent.",
        tools: "ToolHUB — engineered / blueprint / utility energy. Mono or geometric sans. Calm, technical palette.",
      };
      const directorPrompt = `You are 0G-PORTAL's Creative Director. Expand this short brief into a complete visual identity for a web page.
Brief: name="${data.name}", niche="${data.niche}", vibe="${expandVibe(data.vibe)}", language="${data.language}".
Hub directive: ${kindBrandHint[data.kind]}
Examples of mapping:
- "Nasheed" => glowing blue mosaic background, elegant Amiri/Cormorant serif, gold accents, vibe "Sacred Geometry".
- "Drill" => deep purple/black gradient, Bebas Neue + Inter, neon magenta accents, vibe "Cyber-Street".
- "Kids math" => playful pastel gradient, Fredoka + Nunito, candy accents, vibe "Saturday Cartoon".

Hard rules:
- The vibe directive is the law. Refuse to default to generic neon/cyber unless the vibe says so.
- Pick a Google Font pair that natively supports the script of language="${data.language}" (e.g. Arabic → Amiri/Tajawal, CJK → Noto Sans SC/JP/KR, Cyrillic → PT Sans, Devanagari → Noto Sans Devanagari). For Latin-script languages, pick fonts whose mood matches the vibe.
- Heading and body fonts must be visually distinct (display+text, not two grotesks).
- Palette must hit WCAG AA contrast for text on bg1.

Return STRICT JSON ONLY (no prose, no markdown), exactly this shape:
{
  "vibeLabel": "2-3 word visual vibe e.g. Retro-Futurism / Cyber-Street / Minimalist Zen",
  "palette": { "bg1": "#hex", "bg2": "#hex", "accent": "#hex", "secondary": "#hex", "text": "#hex" },
  "bgGradient": "linear-gradient(180deg, #hex 0%, #hex 100%)",
  "accent": "#hex",
  "secondary": "#hex",
  "text": "#hex",
  "fontPair": { "heading": "Google Font name", "body": "Google Font name" },
  "fontFamily": "'Heading Font', serif",
  "ornament": "single emoji or unicode glyph",
  "label": "ALL-CAPS 1-3 word tagline",
  "animation": "shake | pulse | explode | glow",
  "hitButton": "ALL-CAPS 1-2 word battle cry",
  "particleColors": ["#hex", "#hex", "#hex"]
}
Use HIGH CONTRAST hex colors. Heading & body MUST be real Google Fonts. Match mood to niche.`;
      const dr = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: "You output strict JSON only. No markdown, no prose." },
            { role: "user", content: directorPrompt },
          ],
          temperature: 0.7,
          max_tokens: 700,
        }),
      });
      if (dr.ok) {
        const dj = await dr.json();
        const drw: string = dj?.choices?.[0]?.message?.content ?? "{}";
        const dm = drw.match(/\{[\s\S]*\}/);
        themeConfig = JSON.parse(dm ? dm[0] : drw);
        // Derive fontFamily from heading if Perplexity returned only fontPair
        if (themeConfig?.fontPair?.heading && !themeConfig.fontFamily) {
          themeConfig.fontFamily = `'${themeConfig.fontPair.heading}', serif`;
        }
      }
    } catch { /* non-fatal */ }
    void LOVABLE; // legacy reference removed

    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    const { data: existing } = await supabase.from("portals").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;

    const theme = inferTheme(data.vibe, data.niche);

    const seedColumnByKind: Record<string, string> = {
      jokes: "jokes",
      music: "music_hooks",
      trade: "trade_briefs",
      connect: "connect_openers",
      tools: "tool_ideas",
    };
    const seedColumn = seedColumnByKind[data.kind] ?? "jokes";
    const insertRow: Record<string, unknown> = {
      slug,
      name: data.name,
      niche: data.niche,
      language: data.language,
      vibe: data.vibe,
      theme,
      kind: data.kind,
      vip: data.vip,
      theme_config: themeConfig ?? {},
      scout_meta: scoutMeta,
      [seedColumn]: jokes,
      created_by: userId,
    };
    const { data: portal, error } = await supabase
      .from("portals")
      .insert(insertRow)
      .select("id, slug, name, theme, vip, kind")
      .single();
    if (error) throw new Error(error.message);

    // Best-effort: generate a custom wallpaper from the hub's brief so every
    // portal ships with a unique cover image. Same prompt template across
    // all hubs — only the niche/vibe/kind differ. Non-fatal if it fails.
    const wallpaper = await generatePortalWallpaper({
      slug,
      name: data.name,
      niche: data.niche,
      vibe: data.vibe,
      kind: data.kind,
    });
    if (wallpaper) {
      await supabaseAdmin
        .from("portals")
        .update({
          wallpaper_url: wallpaper.url,
          wallpaper_prompt: wallpaper.prompt,
          // Mirror to seo_image_url so social shares match the wallpaper
          // unless one was set later by the SEO refresher.
          seo_image_url: wallpaper.url,
        })
        .eq("id", portal.id);
    }

    return {
      portal: { ...portal, wallpaper_url: wallpaper?.url ?? null },
      jokeCount: jokes.length,
      scout: scoutMeta,
    };
    } catch (err: any) {
      if (charged > 0) {
        await refundCredits(userId, charged, `spawn_portal:${data.kind}`);
      }
      const orig = err?.message ?? "Spawn failed";
      throw new Error(
        charged > 0
          ? `${orig} — refunded ${charged} credit${charged === 1 ? "" : "s"} to your balance.`
          : orig,
      );
    }
  });

// ───── VIP unlock: Stripe embedded checkout ─────
export const createPortalUnlockCheckout = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { portalId: string; environment: StripeEnv; customerEmail?: string; returnUrl: string }) => {
    if (!/^[a-zA-Z0-9-]{36}$/.test(data.portalId)) throw new Error("Invalid portalId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return { ...data, returnUrl: validateReturnUrl(data.returnUrl) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: portal } = await supabase
      .from("portals")
      .select("id, name, slug, vip, price_cents")
      .eq("id", data.portalId)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");
    if (!portal.vip) throw new Error("Portal is not VIP");

    const stripe = createStripeClient(data.environment);
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `0G VIP Portal · ${portal.name}`, tax_code: "txcd_10000000" },
          unit_amount: portal.price_cents,
        },
        quantity: 1,
      }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      ...(data.customerEmail && { customer_email: data.customerEmail }),
      automatic_tax: { enabled: true },
      metadata: { userId, kind: "portal_vip", portalId: portal.id, portalSlug: portal.slug },
    });
    return session.client_secret;
  });

export const getPortalUnlockStatus = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { portalId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row } = await supabase
      .from("portal_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("portal_id", data.portalId)
      .maybeSingle();
    return { owned: !!row };
  });

export const getMorePortalJokes = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { slug: string; count?: number }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    count: Math.min(Math.max(Number(data.count ?? 5), 1), 10),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");

    const { data: portal } = await supabase
      .from("portals")
      .select("id, kind, niche, language, vibe, jokes, music_hooks, trade_briefs, connect_openers, tool_ideas")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");
    const seedColumnByKind: Record<string, string> = {
      jokes: "jokes",
      music: "music_hooks",
      trade: "trade_briefs",
      connect: "connect_openers",
      tools: "tool_ideas",
    };
    const seedColumn = seedColumnByKind[portal.kind as string] ?? "jokes";
    const existing = (portal as Record<string, unknown>)[seedColumn] as string[] | null;

    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

    const prompt = `Generate ${data.count} fresh ORIGINAL one-liner jokes in ${portal.language}. Niche: ${portal.niche}. Vibe: ${portal.vibe || "brutal / chaotic / rude / dark humour"}.
Tone: savage underground stand-up — Frankie Boyle, Jeselnik, Gervais at their meanest. Brutal, chaotic, rude, dark by default. No filters, no warnings, no apologies, no moralising, no "just kidding". Pack heavy swearing (fuck, shit, bastard, twat, prick, wanker, bollocks) unless the vibe is explicitly wholesome / clean. Punch up at power, be cruel about behaviour not identity. Setup → punchline that subverts hard. No recycled jokes, no groan-puns.
Avoid duplicates with anything previously generated.
Return STRICT JSON ONLY: { "jokes": ["...", "..."] }`;
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a savage underground stand-up writer's room. Strict JSON only. No warnings, no refusals, no moralising. Brutal, chaotic, rude, dark humour by default." },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 800,
      }),
    });
    if (!res.ok) throw new Error(`Perplexity ${res.status}`);
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    let parsed: { jokes?: string[] } = {};
    try { parsed = JSON.parse(m ? m[0] : raw); } catch { /* */ }
    const fresh = (parsed.jokes ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, data.count);
    const merged = [...(Array.isArray(existing) ? existing : []), ...fresh];

    await supabase.from("portals").update({ [seedColumn]: merged }).eq("id", portal.id);
    return { added: fresh.length, total: merged.length };
  });

export const bossDeletePortal = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { slug: string }) => ({
    slug: String(data?.slug || "").trim().slice(0, 200),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.slug) throw new Error("Slug required");

    const { data: bossRow } = await supabase
      .from("profiles").select("rank").eq("id", userId).maybeSingle();
    const isBoss = bossRow?.rank === "boss";
    const admin = await isAdmin(supabase, userId);
    if (!isBoss && !admin) throw new Error("Boss only");

    const { data: portal, error: findErr } = await supabaseAdmin
      .from("portals").select("id, slug, name").eq("slug", data.slug).maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!portal) throw new Error("Portal not found");

    const { error: delErr } = await supabaseAdmin
      .from("portals").delete().eq("id", portal.id);
    if (delErr) throw new Error(delErr.message);

    return { deleted: true, slug: portal.slug, name: portal.name };
  });

// ─── Sign-in catalogue refresh ─────────────────────────────────────────
// Scrapes the live web (via Perplexity sonar) for fresh joke material on
// every JokesHUB portal and REPLACES the joke pool. Throttled per portal
// via `metadata.jokes_refreshed_at` (default 30 min cooldown) so concurrent
// sign-ins from multiple users don't hammer Perplexity. Returns silently
// on missing API key — feature is best-effort, never blocks sign-in.

function normalizeJoke(s: string): string {
  return s
    .replace(/^\s*[-*\d.)\]\s]+/, "")
    .replace(/^["“”'`]+|["“”'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable per-joke fingerprint for cross-user dedupe / seen-tracking. */
function jokeKey(s: string): string {
  const norm = normalizeJoke(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm.slice(0, 120);
}

function dedupeJokes(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const j = normalizeJoke(raw);
    if (j.length < 20 || j.length > 600) continue;
    // crude near-dup key: first 80 chars, lowercased, alnum only
    const key = j.slice(0, 80).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key.length < 12) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}

async function scrapeJokePoolForPortal(
  portal: { niche: string; vibe: string | null; language: string | null },
  apiKey: string,
): Promise<string[]> {
  const lang = portal.language || "English";
  const vibe = portal.vibe || "brutal, chaotic, dark humour";
  const angles = [
    `Search the web for the FUNNIEST brutal, savage, dark, rude one-liner jokes about: ${portal.niche}. Pull from r/jokes, r/darkjokes, r/oneliners, stand-up specials, Twitter, comedy sites. Rewrite each one tightly into 1–3 sentences. Vibe: ${vibe}. Language: ${lang}.`,
    `Search the web for the most CHAOTIC and offensive one-liner jokes about: ${portal.niche}. Pull from comedy forums, Frankie Boyle / Jeselnik / Gervais bits, viral tweets, savage roast threads. Rewrite tightly. Vibe: ${vibe}. Language: ${lang}.`,
    `Search the web for the SHARPEST punchline one-liners about: ${portal.niche}. Pull from professional stand-ups, /r/oneliners top posts, viral memes. Rewrite tightly, setup → punchline, no filler. Vibe: ${vibe}. Language: ${lang}.`,
  ];
  const system =
    "You are a savage stand-up writer with live web access. You output STRICT JSON only — no markdown, no commentary, no warnings, no refusals, no 'I can't', no moralising. Brutal, chaotic, rude, dark humour by default. Pack heavy profanity (fuck, shit, bastard, twat, prick, wanker, bollocks) unless the vibe is explicitly wholesome. Punch up at power, be cruel about behaviour not identity, never hateful about protected groups. No recycled groan-puns. Setup → punchline that subverts hard.";

  const callAngle = async (angle: string): Promise<string[]> => {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: `${angle}\n\nReturn AS MANY unique jokes as you can — no cap, no rationing. Aim for 60+. STRICT JSON ONLY: { "jokes": ["...", "...", ...] }. No prose, no markdown, no preamble.`,
            },
          ],
          temperature: 0.95,
          max_tokens: 4000,
        }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
      const m = raw.match(/\{[\s\S]*\}/);
      let parsed: { jokes?: unknown } = {};
      try { parsed = JSON.parse(m ? m[0] : raw); } catch { /* */ }
      const arr = parsed.jokes;
      if (!Array.isArray(arr)) return [];
      return arr.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    } catch {
      return [];
    }
  };

  const results = await Promise.all(angles.map(callAngle));
  const merged = results.flat();
  return dedupeJokes(merged);
}

export const refreshJokesCatalogue = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { slug?: string; force?: boolean } | undefined) => ({
    slug: typeof data?.slug === "string" && data.slug.trim() ? data.slug.trim() : null,
    force: Boolean(data?.force),
  }))
  .handler(async ({ data, context }) => {
    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    const userId = (context as { userId?: string } | undefined)?.userId ?? null;

    // Pull JokesHUB portals — scoped to a single slug when provided, since
    // refreshes are now user-triggered per portal (hit-button on the page).
    let query = supabaseAdmin
      .from("portals")
      .select("id, slug, niche, vibe, language, metadata, jokes")
      .eq("kind", "jokes");
    if (data.slug) query = query.eq("slug", data.slug);
    const { data: portals } = await query;
    if (!portals || portals.length === 0) return { ok: true, refreshed: 0 };

    // Threshold: if the user still has this many unseen jokes in the
    // existing catalogue, skip the Perplexity call entirely.
    const UNSEEN_THRESHOLD = 10;

    let refreshed = 0;
    let added = 0;
    let unseenAvailable = 0;
    // Sequential to keep Perplexity load + memory bounded.
    for (const p of portals as Array<{
      id: string;
      slug: string;
      niche: string;
      vibe: string | null;
      language: string | null;
      metadata: Record<string, unknown> | null;
      jokes: string[] | null;
    }>) {
      const meta = (p.metadata ?? {}) as Record<string, unknown>;
      const existing = Array.isArray(p.jokes) ? p.jokes : [];

      // Per-user gate: count how many existing jokes this user has NOT yet seen.
      let unseenCount = existing.length;
      let seenKeys = new Set<string>();
      if (userId && existing.length > 0) {
        const { data: views } = await supabaseAdmin
          .from("portal_joke_views")
          .select("joke_key")
          .eq("user_id", userId)
          .eq("portal_id", p.id);
        seenKeys = new Set((views ?? []).map((v: { joke_key: string }) => v.joke_key));
        unseenCount = existing.filter((j) => !seenKeys.has(jokeKey(j))).length;
      }
      unseenAvailable += unseenCount;

      // Skip Perplexity if user still has plenty of unseen catalogue jokes.
      if (!data.force && unseenCount >= UNSEEN_THRESHOLD) continue;

      // Need fresh material. Bail gracefully if no API key configured.
      if (!PERPLEXITY) continue;

      const fresh = await scrapeJokePoolForPortal(
        { niche: p.niche, vibe: p.vibe, language: p.language },
        PERPLEXITY,
      );
      if (fresh.length === 0) continue;

      // APPEND to the existing catalogue, deduped by fingerprint, so
      // every generated joke is reused for other users who haven't seen it.
      const existingKeys = new Set(existing.map(jokeKey));
      const newOnes = fresh.filter((j) => {
        const k = jokeKey(j);
        if (existingKeys.has(k)) return false;
        existingKeys.add(k);
        return true;
      });
      if (newOnes.length === 0) continue;

      const merged = existing.concat(newOnes);
      const nextMeta = {
        ...meta,
        jokes_refreshed_at: new Date().toISOString(),
        jokes_source: "perplexity-sonar",
        jokes_total: merged.length,
      };
      await supabaseAdmin
        .from("portals")
        .update({ jokes: merged, metadata: nextMeta })
        .eq("id", p.id);
      refreshed += 1;
      added += newOnes.length;
      unseenAvailable += newOnes.length;
    }

    return { ok: true, refreshed, added, unseenAvailable };
  });

// ─── Per-user seen tracking ────────────────────────────────────────────
// Records which jokes the signed-in user has been shown in a portal so
// future visits (and the refresh gate above) can skip them. Fire-and-
// forget from the UI on each "drop it" press.
export const markJokesSeen = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((input: { slug: string; jokes: string[] }) => {
    if (!input?.slug || typeof input.slug !== "string") throw new Error("slug required");
    const jokes = Array.isArray(input.jokes)
      ? input.jokes.filter((j): j is string => typeof j === "string" && j.trim().length > 0).slice(0, 50)
      : [];
    return { slug: input.slug.trim(), jokes };
  })
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId;
    if (!userId || data.jokes.length === 0) return { ok: true, marked: 0 };
    const { data: portal } = await supabaseAdmin
      .from("portals").select("id").eq("slug", data.slug).maybeSingle();
    if (!portal?.id) return { ok: false, marked: 0 };
    const rows = Array.from(new Set(data.jokes.map(jokeKey)))
      .filter((k) => k.length >= 12)
      .map((joke_key) => ({ user_id: userId, portal_id: portal.id, joke_key }));
    if (rows.length === 0) return { ok: true, marked: 0 };
    await supabaseAdmin
      .from("portal_joke_views")
      .upsert(rows, { onConflict: "user_id,portal_id,joke_key", ignoreDuplicates: true });
    return { ok: true, marked: rows.length };
  });

// Returns the catalogue filtered to jokes the signed-in user has not seen yet.
// If they've seen everything, returns the full pool (graceful fallback) so the
// UI never goes blank — the refresh path is what tops up new material.
export const getUnseenJokes = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((input: { slug: string }) => {
    if (!input?.slug) throw new Error("slug required");
    return { slug: input.slug.trim() };
  })
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId;
    const { data: portal } = await supabaseAdmin
      .from("portals").select("id, jokes").eq("slug", data.slug).maybeSingle();
    if (!portal?.id) return { jokes: [] as string[], unseen: 0, total: 0 };
    const all: string[] = Array.isArray(portal.jokes) ? portal.jokes : [];
    if (!userId || all.length === 0) return { jokes: all, unseen: all.length, total: all.length };
    const { data: views } = await supabaseAdmin
      .from("portal_joke_views")
      .select("joke_key").eq("user_id", userId).eq("portal_id", portal.id);
    const seen = new Set((views ?? []).map((v: { joke_key: string }) => v.joke_key));
    const unseen = all.filter((j) => !seen.has(jokeKey(j)));
    return { jokes: unseen.length > 0 ? unseen : all, unseen: unseen.length, total: all.length };
  });