import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordSystemAlert } from "./system-alerts.server";
import { generateMusicBriefFallback } from "./perplexity-fallback.server";

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
    if (!apiKey) {
      await recordSystemAlert({
        category: "api_error",
        severity: "error",
        source: "suno",
        title: "SUNO_API_KEY not configured",
        message: "Music generation cannot run until the Suno API key is set.",
      });
      throw new Error("SUNO_API_KEY not configured");
    }
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

    let res: Response | null = null;
    let json: any = {};
    let networkError: unknown = null;
    try {
      res = await fetch(`${SUNO_BASE}/suno/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      json = await res.json().catch(() => ({}));
    } catch (e) {
      networkError = e;
    }

    const sunoFailed =
      networkError !== null ||
      !res ||
      !res.ok ||
      !(json?.data?.task_id ?? json?.task_id ?? json?.data?.id ?? json?.id);

    if (sunoFailed) {
      // ── Suno is down. Generate a fallback brief via Perplexity and alert the boss.
      const status = res?.status ?? 0;
      const reason =
        (networkError instanceof Error && networkError.message) ||
        json?.message ||
        `Suno error ${status || "unreachable"}`;
      console.error("[suno] failed, attempting Perplexity fallback:", reason);

      const brief = await generateMusicBriefFallback({
        prompt: data.prompt,
        style_tags: data.style_tags,
        title: data.title ?? null,
        make_instrumental: data.make_instrumental ?? false,
      });

      const { data: job, error: insErr } = await supabaseAdmin
        .from("suno_jobs")
        .insert({
          task_id: `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          portal_id: portalId,
          portal_slug: data.portal_slug ?? null,
          user_id: userId,
          status: brief ? "fallback" : "failed",
          prompt: data.prompt,
          style_tags: data.style_tags,
          title: brief?.title ?? data.title ?? null,
          make_instrumental: data.make_instrumental ?? false,
          lyric_text: brief?.lyrics ?? null,
          fallback_provider: brief ? "perplexity" : null,
          fallback_brief: (brief ?? null) as any,
          raw: { suno_error: reason, suno_status: status, suno_response: json } as any,
        })
        .select("id, task_id, status")
        .single();
      if (insErr) throw new Error(insErr.message);

      await recordSystemAlert({
        category: "api_error",
        severity: "error",
        source: "suno",
        title: "Suno API unavailable",
        message: reason,
        metadata: { status, portal_slug: data.portal_slug ?? null },
        related_job_id: job?.id ?? null,
      });

      if (brief) {
        await recordSystemAlert({
          category: "fallback",
          severity: "warn",
          source: "perplexity",
          title: `Perplexity drafted brief for "${brief.title}"`,
          message: "Suno is offline. A Perplexity-written track brief is awaiting your review.",
          metadata: {
            portal_slug: data.portal_slug ?? null,
            style_tags: brief.style_tags,
            instrumental: !!data.make_instrumental,
          },
          related_job_id: job?.id ?? null,
        });
      }

      return { ok: true, job, fallback: !!brief, reason };
    }

    const taskId: string =
      json?.data?.task_id ?? json?.task_id ?? json?.data?.id ?? json?.id;

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

    return { ok: true, job, fallback: false };
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