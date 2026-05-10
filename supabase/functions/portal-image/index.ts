// Generates a square OG/cover image for a portal using Lovable AI (Nano Banana),
// uploads it to the portals-media bucket, and stores the public URL on
// portals.seo_image_url. Boss/admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL from image model");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: m[1] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth as caller (RLS-aware) to verify boss/admin
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const [{ data: isBoss }, { data: isAdmin }] = await Promise.all([
      admin.rpc("is_boss", { _uid: uid }),
      admin.rpc("has_role", { _user_id: uid, _role: "admin" }),
    ]);
    if (!isBoss && !isAdmin) {
      return new Response(JSON.stringify({ error: "Boss only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const portalId = String(body.portal_id ?? "");
    const stylePrompt = typeof body.style === "string" ? body.style.slice(0, 400) : "";
    if (!portalId) {
      return new Response(JSON.stringify({ error: "portal_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: portal, error: pErr } = await admin
      .from("portals")
      .select("id, slug, name, kind, niche, vibe, theme, seo_title, seo_description, brief")
      .eq("id", portalId)
      .maybeSingle();
    if (pErr || !portal) {
      return new Response(JSON.stringify({ error: "Portal not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt from portal brief
    const briefSummary = portal.brief && typeof portal.brief === "object"
      ? JSON.stringify(portal.brief).slice(0, 600) : "";
    const prompt = [
      `High-impact 1:1 cover/OG image for "${portal.name}".`,
      `Hub: ${portal.kind}. Niche: ${portal.niche}.`,
      portal.vibe ? `Vibe: ${portal.vibe}.` : "",
      `Theme: ${portal.theme}.`,
      portal.seo_title ? `Title: ${portal.seo_title}.` : "",
      portal.seo_description ? `Description: ${portal.seo_description}.` : "",
      briefSummary ? `Brief: ${briefSummary}` : "",
      stylePrompt ? `Style notes: ${stylePrompt}` : "",
      "Bold composition, cinematic lighting, no readable text, no logos, no watermarks. 1:1 square.",
    ].filter(Boolean).join(" ");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502;
      const msg = aiRes.status === 429
        ? "Image model rate-limited. Try again in a minute."
        : aiRes.status === 402
          ? "AI credits exhausted — top up Lovable AI usage."
          : `Image model error: ${txt.slice(0, 200)}`;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const imageDataUrl: string | undefined =
      aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) {
      return new Response(JSON.stringify({ error: "No image returned by model" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bytes, mime } = dataUrlToBytes(imageDataUrl);
    const ext = mime === "image/jpeg" ? "jpg" : "png";
    const path = `portals/${portal.slug}/cover-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("portals-media")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ error: `Upload failed: ${upErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: pub } = admin.storage.from("portals-media").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    const { error: updErr } = await admin
      .from("portals")
      .update({ seo_image_url: publicUrl, seo_refreshed_at: new Date().toISOString() })
      .eq("id", portalId);
    if (updErr) {
      return new Response(JSON.stringify({ error: `DB update failed: ${updErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, url: publicUrl, prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});