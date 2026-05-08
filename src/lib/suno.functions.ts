import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SUNO_BASE = "https://api.sunoapi.com/api/v1";

const SpawnInput = z.object({
  prompt: z.string().min(1).max(5000),
  style_tags: z.string().min(1).max(500),
  title: z.string().min(1).max(200).optional(),
  make_instrumental: z.boolean().optional().default(false),
  portal_slug: z.string().min(1).max(120).optional(),
});

export const spawnMusic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SpawnInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) throw new Error("SUNO_API_KEY not configured");
    const { userId } = context;

    // Resolve portal (optional)
    let portalId: string | null = null;
    if (data.portal_slug) {
      const { data: p } = await supabaseAdmin
        .from("portals")
        .select("id")
        .eq("slug", data.portal_slug)
        .maybeSingle();
      portalId = p?.id ?? null;
    }

    // Build webhook URL — sunoapi.com posts results here when finished
    const origin =
      process.env.PUBLIC_SITE_URL ??
      (process.env.SUPABASE_URL ? "" : "") ??
      "";
    const webhookBase =
      process.env.PUBLIC_SITE_URL ||
      "https://project--ae4b10fa-6c9c-44d9-bbd5-85d320d62dff.lovable.app";
    const callbackUrl = `${webhookBase.replace(/\/$/, "")}/api/public/suno-webhook`;

    const payload = {
      custom_mode: true,
      mv: "suno-v5-5",
      prompt: data.prompt,
      tags: data.style_tags,
      title: data.title ?? "0G-Studio Track",
      make_instrumental: data.make_instrumental ?? false,
      webhook_url: callbackUrl,
    };

    const res = await fetch(`${SUNO_BASE}/suno/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Suno create failed", res.status, json);
      throw new Error(json?.message || `Suno error ${res.status}`);
    }

    // sunoapi.com returns { code, data: { task_id } } (shape can vary)
    const taskId: string | undefined =
      json?.data?.task_id ??
      json?.task_id ??
      json?.data?.id ??
      json?.id;
    if (!taskId) {
      console.error("No task_id in Suno response", json);
      throw new Error("Suno did not return a task_id");
    }

    const { data: job, error: insErr } = await supabaseAdmin
      .from("suno_jobs")
      .insert({
        task_id: taskId,
        portal_id: portalId,
        portal_slug: data.portal_slug ?? null,
        user_id: userId,
        status: "pending",
        prompt: data.prompt,
        style_tags: data.style_tags,
        title: data.title ?? null,
        make_instrumental: data.make_instrumental ?? false,
        raw: json,
      })
      .select("id, task_id, status")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { ok: true, job };
  });

export const listMyRecentJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("suno_jobs")
      .select("id, task_id, status, title, audio_url, lyric_text, created_at, portal_slug")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return { jobs: data ?? [] };
  });