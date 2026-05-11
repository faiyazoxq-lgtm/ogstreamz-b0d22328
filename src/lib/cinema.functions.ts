import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

function defaultPromptFor(pair: string, bias: string): string {
  const p = (pair || "").toLowerCase();
  if (p.includes("gold") || p.includes("xau"))
    return "Cinematic 4K macro shot, liquid gold flowing over slate grey rocks, neon blue digital grid overlay, realistic physics, slow shimmering reflections, ultra detailed, depth of field.";
  if (p.includes("silver") || p.includes("xag"))
    return "Cinematic 4K macro shot, liquid mercury silver pouring across dark obsidian, electric cyan grid overlay, slow motion ripples, neon studio lighting.";
  if (p.includes("oil") || p.includes("brent") || p.includes("wti"))
    return "Cinematic 4K macro shot, thick black crude oil drops splashing in slow motion against a steel surface, orange neon refinery light flares, faint amber digital grid overlay.";
  if (p.includes("btc") || p.includes("bitcoin"))
    return "Cinematic 4K shot, glowing orange holographic Bitcoin glyphs orbiting in a dark neon city skyline, particle sparks, slow camera dolly, cyberpunk grid overlay.";
  if (p.includes("eth"))
    return "Cinematic 4K shot, faceted iridescent crystal Ethereum prism rotating in a dark void, prismatic light refraction, violet neon grid overlay.";
  if (p.includes("eur") || p.includes("usd") || p.includes("gbp") || p.includes("jpy"))
    return "Cinematic 4K shot, glowing currency symbols colliding in slow motion above a dark trading desk, blue neon grid overlay, electric arc particles, financial terminal aesthetic.";
  const tone = bias === "bad"
    ? "crimson alarm lighting, embers and smoke drifting, ominous mood"
    : bias === "good"
    ? "emerald growth pulses, rising particle currents, optimistic mood"
    : "cool blue neon reconnaissance light, atmospheric haze";
  return `Cinematic 4K abstract trading visual for ${pair}: ${tone}, neon digital grid overlay, slow camera motion, ultra detailed, photorealistic physics.`;
}

const VEO_MODEL = "veo-3.1-generate-preview";
const GAPI = "https://generativelanguage.googleapis.com/v1beta";

async function veoGenerate(prompt: string, aspect: "16:9" | "9:16", apiKey: string): Promise<ArrayBuffer> {
  // 1) Kick off long-running prediction
  const startRes = await fetch(`${GAPI}/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio: aspect, sampleCount: 1, personGeneration: "allow_adult" },
    }),
  });
  if (!startRes.ok) {
    const t = await startRes.text();
    throw new Error(`Veo start failed [${startRes.status}]: ${t.slice(0, 400)}`);
  }
  const startJson: any = await startRes.json();
  const opName: string | undefined = startJson?.name;
  if (!opName) throw new Error("Veo: no operation name returned");

  // 2) Poll until done (Veo typically 30–90s)
  const deadline = Date.now() + 4 * 60 * 1000;
  let op: any = startJson;
  while (!op?.done) {
    if (Date.now() > deadline) throw new Error("Veo polling timed out after 4m");
    await new Promise((r) => setTimeout(r, 6000));
    const pollRes = await fetch(`${GAPI}/${opName}?key=${apiKey}`);
    if (!pollRes.ok) {
      const t = await pollRes.text();
      throw new Error(`Veo poll failed [${pollRes.status}]: ${t.slice(0, 300)}`);
    }
    op = await pollRes.json();
    if (op?.error) throw new Error(`Veo error: ${op.error.message || JSON.stringify(op.error)}`);
  }

  // 3) Extract video URI (shape varies a bit across previews)
  const resp = op.response || {};
  const samples =
    resp?.generateVideoResponse?.generatedSamples ||
    resp?.generatedSamples ||
    resp?.videos ||
    [];
  const first = samples?.[0];
  const uri: string | undefined =
    first?.video?.uri || first?.uri || first?.gcsUri || first?.video?.gcsUri;
  if (!uri) throw new Error(`Veo: no video URI in response: ${JSON.stringify(resp).slice(0, 400)}`);

  // 4) Download bytes
  const downloadUrl = uri.includes("?") ? `${uri}&key=${apiKey}` : `${uri}?key=${apiKey}`;
  const dl = await fetch(downloadUrl);
  if (!dl.ok) {
    const t = await dl.text();
    throw new Error(`Veo download failed [${dl.status}]: ${t.slice(0, 200)}`);
  }
  return await dl.arrayBuffer();
}

export const generatePortalCinema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string; aspect?: "16:9" | "9:16"; prompt?: string }) => ({
    slug: String(data.slug || "").trim().slice(0, 80),
    aspect: (data.aspect === "9:16" ? "9:16" : "16:9") as "16:9" | "9:16",
    prompt: data.prompt ? String(data.prompt).slice(0, 1500) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");

    const GOOGLE_AI_STUDIO_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!GOOGLE_AI_STUDIO_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env missing");

    // Fetch portal to derive prompt if not provided
    const { data: portal, error: pErr } = await supabase
      .from("portals")
      .select("slug, kind, scout_meta, bg_video_prompt")
      .eq("slug", data.slug).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!portal) throw new Error("Portal not found");

    const meta = (portal.scout_meta || {}) as any;
    const prompt = data.prompt || portal.bg_video_prompt || defaultPromptFor(meta.pair || "", meta.bias || "neutral");

    const bytes = await veoGenerate(prompt, data.aspect, GOOGLE_AI_STUDIO_API_KEY);

    // Upload with service role (storage policies require admin role; service role bypasses RLS)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const path = `${data.slug}/${data.aspect.replace(":", "x")}-${Date.now()}.mp4`;
    const { error: upErr } = await admin.storage.from("portals-media").upload(path, new Uint8Array(bytes), {
      contentType: "video/mp4",
      upsert: true,
      cacheControl: "31536000",
    });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: pub } = admin.storage.from("portals-media").getPublicUrl(path);
    const url = pub.publicUrl;

    const { error: updErr } = await admin
      .from("portals")
      .update({ bg_video_url: url, bg_video_aspect: data.aspect, bg_video_prompt: prompt })
      .eq("slug", data.slug);
    if (updErr) throw new Error(updErr.message);

    return { url, aspect: data.aspect, prompt };
  });