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
  .inputValidator((data: { name: string; niche: string; language: string; vibe: string }) => ({
    name: String(data.name || "").trim().slice(0, 80),
    niche: String(data.niche || "").trim().slice(0, 400),
    language: String(data.language || "English").trim().slice(0, 40),
    vibe: String(data.vibe || "").trim().slice(0, 200),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.name || !data.niche) throw new Error("Name and niche required");

    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

    const prompt = `Generate exactly 10 short original jokes in ${data.language}. Niche/theme: ${data.niche}. Vibe: ${data.vibe || "n/a"}. Each joke 1-3 sentences. Return STRICT JSON ONLY: { "jokes": ["...", "..."] }. No commentary.`;

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
        max_tokens: 1200,
      }),
    });
    if (!res.ok) throw new Error(`Perplexity ${res.status}`);
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: { jokes?: string[] } = {};
    try { parsed = JSON.parse(match ? match[0] : raw); } catch { /* */ }
    const jokes = (parsed.jokes ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 10);
    if (jokes.length === 0) throw new Error("No jokes generated");

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
        jokes,
        created_by: userId,
      })
      .select("id, slug, name, theme")
      .single();
    if (error) throw new Error(error.message);

    return { portal, jokeCount: jokes.length };
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