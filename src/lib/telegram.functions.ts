import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function tg(method: string, body: Record<string, unknown>) {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  const TG = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");
  if (!TG) throw new Error("TELEGRAM_API_KEY missing");
  const r = await fetch(`${TG_GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": TG,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(`Telegram ${method} failed [${r.status}]: ${j?.description ?? JSON.stringify(j)}`);
  }
  return j.result;
}

export type BrandBible = {
  brandName?: string;
  voice?: string;
  bio?: string;
  shortBio?: string;
  logoEmoji?: string;
  marketingPlan?: string;
  starterMessages?: string[];
};

export const generateBrandBible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) => ({ slug: String(data.slug || "").trim().slice(0, 80) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");

    const { data: portal } = await supabase
      .from("portals")
      .select("id, name, niche, language, vibe, telegram_config")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY) throw new Error("PERPLEXITY_API_KEY missing");

    const prompt = `You are a brand strategist for a Telegram community.
Niche: "${portal.niche}". Vibe: "${portal.vibe || "n/a"}". Language: ${portal.language}.
Return STRICT JSON ONLY (no markdown):
{
  "brandName": "snappy brand name (1-3 words)",
  "voice": "1-2 sentence description of the spiritual/marketing voice",
  "bio": "Telegram channel description, max 240 chars",
  "shortBio": "Telegram short bio, max 120 chars",
  "logoEmoji": "single emoji that represents the brand",
  "marketingPlan": "3-5 bullet marketing plan as a single string with \\n separators",
  "starterMessages": ["5 starter Telegram messages in ${portal.language}, each punchy and on-brand"]
}`;

    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "Output strict JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 900,
      }),
    });
    if (!r.ok) throw new Error(`Perplexity ${r.status}`);
    const j = await r.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    let bible: BrandBible = {};
    try { bible = JSON.parse(m ? m[0] : raw); } catch { /* */ }

    const next = {
      ...(portal.telegram_config ?? {}),
      brand: bible,
      enabled: true,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("portals").update({ telegram_config: next }).eq("id", portal.id);
    return { brand: bible };
  });

export const updateTelegramLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string; groupLink?: string; vipLink?: string; botUsername?: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    groupLink: String(data.groupLink || "").trim().slice(0, 240),
    vipLink: String(data.vipLink || "").trim().slice(0, 240),
    botUsername: String(data.botUsername || "").trim().replace(/^@/, "").slice(0, 64),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");

    const okUrl = (s: string) => !s || /^https:\/\/(t\.me|telegram\.me)\//i.test(s);
    if (!okUrl(data.groupLink)) throw new Error("Group link must be a https://t.me/ URL");
    if (!okUrl(data.vipLink)) throw new Error("VIP link must be a https://t.me/ URL");

    const { data: portal } = await supabase
      .from("portals").select("id, telegram_config").eq("slug", data.slug).maybeSingle();
    if (!portal) throw new Error("Portal not found");

    const next = {
      ...(portal.telegram_config ?? {}),
      groupLink: data.groupLink || null,
      vipLink: data.vipLink || null,
      botUsername: data.botUsername || null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("portals").update({ telegram_config: next }).eq("id", portal.id);
    return { ok: true };
  });

export const deployToTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) => ({ slug: String(data.slug || "").trim().slice(0, 80) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");

    const { data: portal } = await supabase
      .from("portals").select("id, name, telegram_config").eq("slug", data.slug).maybeSingle();
    if (!portal) throw new Error("Portal not found");
    const cfg = (portal.telegram_config ?? {}) as { brand?: BrandBible };
    const brand = cfg.brand;
    if (!brand) throw new Error("Generate the Brand Bible first");

    const me = await tg("getMe", {});
    const name = (brand.brandName || portal.name).slice(0, 64);
    const desc = (brand.bio || "Powered by 0G-PORTAL").slice(0, 512);
    const shortDesc = (brand.shortBio || brand.bio || "0G-PORTAL").slice(0, 120);

    const results: Record<string, any> = { bot: me?.username ?? null };
    try { results.setMyName = await tg("setMyName", { name }); } catch (e: any) { results.setMyName = e.message; }
    try { results.setMyDescription = await tg("setMyDescription", { description: desc }); } catch (e: any) { results.setMyDescription = e.message; }
    try { results.setMyShortDescription = await tg("setMyShortDescription", { short_description: shortDesc }); } catch (e: any) { results.setMyShortDescription = e.message; }
    try {
      results.setMyCommands = await tg("setMyCommands", {
        commands: [
          { command: "start", description: `Welcome to ${name}` },
          { command: "portal", description: "Open the 0G portal" },
          { command: "vip", description: "VIP access" },
        ],
      });
    } catch (e: any) { results.setMyCommands = e.message; }

    const next = {
      ...cfg,
      botUsername: me?.username ?? (cfg as any).botUsername ?? null,
      deployed: true,
      deployed_at: new Date().toISOString(),
      lastDeploy: results,
    };
    await supabase.from("portals").update({ telegram_config: next }).eq("id", portal.id);
    return { results, botUsername: me?.username ?? null };
  });