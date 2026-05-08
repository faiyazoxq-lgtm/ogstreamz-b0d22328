import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

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

export const spawnPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; niche: string; language: string; vibe: string; vip?: boolean; useScout?: boolean }) => ({
    name: String(data.name || "").trim().slice(0, 80),
    niche: String(data.niche || "").trim().slice(0, 400),
    language: String(data.language || "English").trim().slice(0, 40),
    vibe: String(data.vibe || "").trim().slice(0, 200),
    vip: !!data.vip,
    useScout: data.useScout !== false,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.name || !data.niche) throw new Error("Name and niche required");

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
    const prompt = `Generate exactly 5 short original SAVAGE jokes in ${data.language}. Niche/theme: ${data.niche}. Vibe: ${data.vibe || "n/a"}.${ctx}\nEach joke 1-3 sentences. Punchy, sharp, on-trend. Return STRICT JSON ONLY: { "jokes": ["...", "..."] }. No commentary.`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You output strict JSON only. No markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 800,
      }),
    });
    if (!res.ok) throw new Error(`Perplexity ${res.status}`);
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: { jokes?: string[] } = {};
    try { parsed = JSON.parse(match ? match[0] : raw); } catch { /* */ }
    const jokes = (parsed.jokes ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 5);
    if (jokes.length === 0) throw new Error("No jokes generated");

    // ───── Creative Director: Perplexity-generated Style Dictionary ─────
    let themeConfig: any = null;
    try {
      const directorPrompt = `You are 0G-PORTAL's Creative Director. Expand this short brief into a complete visual identity for a web page.
Brief: name="${data.name}", niche="${data.niche}", vibe="${data.vibe || "n/a"}".
Examples of mapping:
- "Nasheed" => glowing blue mosaic background, elegant Amiri/Cormorant serif, gold accents, vibe "Sacred Geometry".
- "Drill" => deep purple/black gradient, Bebas Neue + Inter, neon magenta accents, vibe "Cyber-Street".
- "Kids math" => playful pastel gradient, Fredoka + Nunito, candy accents, vibe "Saturday Cartoon".

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

    const { data: portal, error } = await supabase
      .from("portals")
      .insert({
        slug,
        name: data.name,
        niche: data.niche,
        language: data.language,
        vibe: data.vibe,
        theme,
        vip: data.vip,
        theme_config: themeConfig ?? {},
        scout_meta: scoutMeta,
        jokes,
        created_by: userId,
      })
      .select("id, slug, name, theme, vip")
      .single();
    if (error) throw new Error(error.message);

    return { portal, jokeCount: jokes.length, scout: scoutMeta };
  });

// ───── VIP unlock: Stripe embedded checkout ─────
export const createPortalUnlockCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { portalId: string; environment: StripeEnv; customerEmail?: string; returnUrl: string }) => {
    if (!/^[a-zA-Z0-9-]{36}$/.test(data.portalId)) throw new Error("Invalid portalId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return data;
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string; count?: number }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    count: Math.min(Math.max(Number(data.count ?? 5), 1), 10),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");

    const { data: portal } = await supabase
      .from("portals")
      .select("id, niche, language, vibe, jokes")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

    const prompt = `Generate ${data.count} fresh original jokes in ${portal.language}. Niche: ${portal.niche}. Vibe: ${portal.vibe || "n/a"}. Avoid duplicates. STRICT JSON: { "jokes": ["...", "..."] }`;
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
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
    const merged = [...(portal.jokes as string[] ?? []), ...fresh];

    await supabase.from("portals").update({ jokes: merged }).eq("id", portal.id);
    return { added: fresh.length, total: merged.length };
  });