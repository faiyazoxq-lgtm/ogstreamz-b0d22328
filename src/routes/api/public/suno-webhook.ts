import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Suno webhook receiver (sunoapi.com).
 * Provider posts JSON when a track finishes. Shape varies; we extract
 * task_id + the first delivered clip's audio_url + lyric/prompt text.
 */
function pickFirstClip(payload: any) {
  const candidates: any[] =
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.data?.data) && payload.data.data) ||
    (Array.isArray(payload?.clips) && payload.clips) ||
    (Array.isArray(payload?.data?.clips) && payload.data.clips) ||
    [];
  return candidates.find((c) => c?.audio_url || c?.audio || c?.source_audio_url) ?? candidates[0] ?? null;
}

function extractTaskId(payload: any): string | null {
  return (
    payload?.task_id ||
    payload?.data?.task_id ||
    payload?.taskId ||
    payload?.data?.taskId ||
    payload?.id ||
    null
  );
}

export const Route = createFileRoute("/api/public/suno-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const taskId = extractTaskId(payload);
        if (!taskId) {
          console.error("Suno webhook: missing task_id", payload);
          return new Response("Missing task_id", { status: 400 });
        }

        const clip = pickFirstClip(payload);
        const audioUrl: string | null =
          clip?.audio_url || clip?.audio || clip?.source_audio_url || null;
        const lyricText: string | null =
          clip?.lyric || clip?.lyrics || clip?.prompt || null;
        const imageUrl: string | null =
          clip?.image_url || clip?.image_large_url || null;
        const title: string | null = clip?.title || null;

        const status: string =
          payload?.status ||
          payload?.data?.status ||
          (audioUrl ? "complete" : "processing");

        // Update the job row
        const { data: job, error: jobErr } = await supabaseAdmin
          .from("suno_jobs")
          .update({
            status,
            audio_url: audioUrl,
            lyric_text: lyricText,
            image_url: imageUrl,
            title: title ?? undefined,
            raw: payload,
          })
          .eq("task_id", taskId)
          .select("id, portal_id, portal_slug, user_id")
          .maybeSingle();

        if (jobErr) {
          console.error("Suno webhook: job update failed", jobErr);
          return new Response("DB error", { status: 500 });
        }
        if (!job) {
          console.warn("Suno webhook: no job for task_id", taskId);
          return new Response("ok"); // ack so provider doesn't retry forever
        }

        // Mirror the finished result onto the linked portal
        if (audioUrl && (job.portal_id || job.portal_slug)) {
          const filter = job.portal_id
            ? { col: "id", val: job.portal_id }
            : { col: "slug", val: job.portal_slug! };
          const { error: pErr } = await supabaseAdmin
            .from("portals")
            .update({
              audio_url: audioUrl,
              lyric_text: lyricText,
              audio_snippet_url: audioUrl,
              updated_at: new Date().toISOString(),
            })
            .eq(filter.col, filter.val);
          if (pErr) console.error("Suno webhook: portal update failed", pErr);
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "POST only" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});