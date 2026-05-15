import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireStrictAuth } from "@/lib/strict-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Portal Shell server functions: cached AI-generated header (title + short
 * description + background image) per portal, plus the per-user creations
 * library every portal can write into.
 */

export type PortalHeader = {
  portal_key: string;
  title: string;
  description: string;
  bg_url: string | null;
};

const PortalKeyZ = z.string().min(1).max(48).regex(/^[a-z0-9_-]+$/);

/* ----------------------------- Header (cached) ---------------------------- */

export const getPortalHeader = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      portalKey: PortalKeyZ,
      name: z.string().min(1).max(80),
      seed: z.string().max(280).optional(),
    }).parse,
  )
  .handler(async ({ data }): Promise<PortalHeader> => {
    // Cache hit — return stored header.
    const existing = await supabaseAdmin
      .from("portal_headers")
      .select("portal_key, title, description, bg_url")
      .eq("portal_key", data.portalKey)
      .maybeSingle();
    if (existing.data) return existing.data as PortalHeader;

    // Cache miss — AI generation is expensive (text + image via LOVABLE_API_KEY).
    // Require authentication before triggering generation, otherwise an
    // unauthenticated bot could enumerate unique portalKeys and exhaust credits.
    // Anonymous viewers still get a sensible static placeholder for new portals.
    const req = getRequest();
    const authHeader = req?.headers.get("authorization") ?? "";
    let authedUser = false;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (token && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
        try {
          const tmp = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const { data: claims } = await tmp.auth.getClaims(token);
          authedUser = !!claims?.claims?.sub;
        } catch {
          authedUser = false;
        }
      }
    }
    if (!authedUser) {
      return {
        portal_key: data.portalKey,
        title: data.name,
        description: `${data.name} — generate, remix, ship.`,
        bg_url: null,
      };
    }

    const LOVABLE = process.env.LOVABLE_API_KEY;
    if (!LOVABLE) throw new Error("AI gateway not configured");

    // 1) Title + short description in one structured call.
    const sysCopy =
      "You write short, vivid product copy for an AI portal. " +
      "Output ONLY a JSON object with keys `title` (string, 1-3 words, no quotes) " +
      "and `description` (string, max 180 chars, one punchy sentence, no emoji, no quotes).";
    const userCopy = `Portal name: ${data.name}\n${data.seed ? `Theme: ${data.seed}` : ""}`;

    const copyRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sysCopy },
          { role: "user", content: userCopy },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (copyRes.status === 429) throw new Error("AI rate limit — try again shortly");
    if (copyRes.status === 402) throw new Error("AI credits exhausted");
    if (!copyRes.ok) throw new Error(`AI copy ${copyRes.status}`);
    const copyJson = await copyRes.json();
    const raw = copyJson?.choices?.[0]?.message?.content ?? "{}";
    let title = data.name;
    let description = "";
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.title === "string" && parsed.title.trim()) title = parsed.title.trim().slice(0, 60);
      if (typeof parsed?.description === "string") description = parsed.description.trim().slice(0, 220);
    } catch {
      /* fall back to defaults */
    }
    if (!description) description = `${data.name} — generate, remix, ship.`;

    // 2) Background image — Nano Banana. Best-effort; portal still cached
    // even if image gen fails so we don't burn copy credits on retry.
    let bgUrl: string | null = null;
    try {
      const imgPrompt =
        `Cinematic widescreen background art evoking: ${description}. ` +
        `Moody, deep blacks, neon highlights, no text, no logo, no watermark, ` +
        `wide composition, leave horizontal center fairly dark for overlaid text.`;
      const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: imgPrompt }],
          modalities: ["image", "text"],
        }),
      });
      if (imgRes.ok) {
        const imgJson = await imgRes.json();
        const dataUrl: string | undefined =
          imgJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (dataUrl?.startsWith("data:image")) {
          const [meta, b64] = dataUrl.split(",");
          const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png";
          const ext = mime.split("/")[1] ?? "png";
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const path = `${data.portalKey}.${ext}`;
          const up = await supabaseAdmin.storage
            .from("portal-bg")
            .upload(path, bytes, { contentType: mime, upsert: true });
          if (!up.error) {
            const pub = supabaseAdmin.storage.from("portal-bg").getPublicUrl(path);
            bgUrl = pub.data.publicUrl;
          }
        }
      }
    } catch {
      /* swallow — header still useful without bg */
    }

    const insert = await supabaseAdmin
      .from("portal_headers")
      .upsert({
        portal_key: data.portalKey,
        title,
        description,
        bg_url: bgUrl,
      })
      .select("portal_key, title, description, bg_url")
      .single();
    if (insert.error) throw new Error(insert.error.message);
    return insert.data as PortalHeader;
  });

/* ------------------------------ Creations lib ----------------------------- */

const OutputZ = z.record(z.string(), z.unknown());

export const recordPortalCreation = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator(
    z.object({
      portalKey: PortalKeyZ,
      prompt: z.string().min(1).max(4000),
      output: OutputZ.default({}),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("portal_creations")
      .insert({
        user_id: userId,
        portal_key: data.portalKey,
        prompt: data.prompt,
        output: data.output as never,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listPortalCreations = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator(
    z.object({
      portalKey: PortalKeyZ,
      limit: z.number().int().min(1).max(50).default(10),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("portal_creations")
      .select("id, prompt, output, created_at")
      .eq("portal_key", data.portalKey)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const deletePortalCreation = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("portal_creations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });