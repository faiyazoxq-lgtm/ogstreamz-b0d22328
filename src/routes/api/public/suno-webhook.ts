import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";
async function tgSend(path: string, body: any) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return null;
  const r = await fetch(`${TG_GATEWAY}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return r.ok ? (await r.json().catch(() => null))?.result : null;
}

/**
 * Suno webhook receiver (sunoapi.com).
 * Provider posts JSON when a track finishes. Shape varies; we extract
 * task_id + the first delivered clip's audio_url + lyric/prompt text.
 */
function pickClips(payload: any) {
  const candidates: any[] =
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.data?.data) && payload.data.data) ||
    (Array.isArray(payload?.clips) && payload.clips) ||
    (Array.isArray(payload?.data?.clips) && payload.data.clips) ||
    [];
  const withAudio = candidates.filter(
    (c) => c?.audio_url || c?.audio || c?.source_audio_url,
  );
  const ordered = withAudio.length ? withAudio : candidates;
  return [ordered[0] ?? null, ordered[1] ?? null] as [any, any];
}

function clipAudio(c: any): string | null {
  return c?.audio_url || c?.audio || c?.source_audio_url || null;
}
function clipImage(c: any): string | null {
  return c?.image_url || c?.image_large_url || null;
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
        // Verify webhook secret from x-webhook-secret header (header keeps secret out
        // of access logs, CDN logs and Referer). Query param is no longer accepted.
        const provided = request.headers.get("x-webhook-secret") || "";
        const expected = process.env.SUNO_WEBHOOK_SECRET || "";
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
        const ua = (request.headers.get("user-agent") || "").slice(0, 200);

        if (!expected) {
          console.error("[suno-webhook] SUNO_WEBHOOK_SECRET not configured");
          return Response.json(
            { error: "server_misconfigured", message: "Suno webhook secret is not configured." },
            { status: 500 },
          );
        }
        if (!provided) {
          console.warn(`[suno-webhook] 401 missing x-webhook-secret ip=${ip} ua="${ua}"`);
          return Response.json(
            { error: "missing_secret", message: "x-webhook-secret header is required." },
            { status: 401 },
          );
        }
        let diff = provided.length ^ expected.length;
        const len = Math.min(provided.length, expected.length);
        for (let i = 0; i < len; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
        if (diff !== 0) {
          console.warn(`[suno-webhook] 403 invalid x-webhook-secret ip=${ip} ua="${ua}"`);
          return Response.json(
            { error: "invalid_secret", message: "x-webhook-secret did not match." },
            { status: 403 },
          );
        }

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

        const [clipA, clipB] = pickClips(payload);
        const audioUrlV1 = clipAudio(clipA);
        const audioUrlV2 = clipAudio(clipB);
        const audioUrl = audioUrlV1; // back-compat
        const lyricText: string | null =
          clipA?.lyric || clipA?.lyrics || clipA?.prompt || null;
        const imageUrlV1 = clipImage(clipA);
        const imageUrlV2 = clipImage(clipB);
        const imageUrl = imageUrlV1;
        const title: string | null = clipA?.title || null;

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
            audio_url_v1: audioUrlV1,
            audio_url_v2: audioUrlV2,
            lyric_text: lyricText,
            image_url: imageUrl,
            image_url_v1: imageUrlV1,
            image_url_v2: imageUrlV2,
            title: title ?? undefined,
            raw: payload,
          })
          .eq("task_id", taskId)
          .select("id, portal_id, portal_slug, user_id, power_pack_id, signal_bundle_id")
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

        // Power Pack chain — when this track belongs to a pack, append it
        // to the same Telegram channel and mark the pack complete.
        if (audioUrl && job.power_pack_id) {
          try {
            await supabaseAdmin
              .from("power_packs")
              .update({ suno_audio_url: audioUrl, status: "complete" })
              .eq("id", job.power_pack_id);

            const { data: bot } = await supabaseAdmin
              .from("bot_configs")
              .select("channel_chat_id")
              .eq("active", true)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const { data: pack } = await supabaseAdmin
              .from("power_packs")
              .select("asset, bias")
              .eq("id", job.power_pack_id)
              .maybeSingle();

            if (bot?.channel_chat_id) {
              await tgSend("/sendAudio", {
                chat_id: bot.channel_chat_id,
                audio: audioUrl,
                title: title ?? `0G ${pack?.asset ?? ""} Anthem`,
                performer: "0G-Syndicate",
                caption: `🎧 Anthem ready — ${pack?.asset ?? ""} · ${(pack?.bias ?? "").toUpperCase()}`,
              });
            }
          } catch (e) {
            console.error("Power Pack chain failed", e);
          }
        }

        // Signal-Bundle chain — Master Bot posts the Victory Anthem reply
        // into the VIP broadcast channel and updates the bundle row.
        if (audioUrl && job.signal_bundle_id) {
          try {
            const { data: bundle } = await supabaseAdmin
              .from("signal_bundles")
              .select("channel_chat_id, intro_message_id, signal_payload, veo_video_url")
              .eq("id", job.signal_bundle_id)
              .maybeSingle();
            if (bundle?.channel_chat_id) {
              const ticker =
                (bundle.signal_payload as any)?.price?.primaryTicker ||
                (bundle.signal_payload as any)?.topMove?.ticker ||
                "MARKET";
              const compliance =
                "⚖️ <b>SENTIMENT ANALYSIS ONLY — NOT A DIRECT FINANCIAL PROMOTION</b>\n<i>Compliant with FCA CP26/13 (May 2026). 0G-PORTAL Sentiment Mesh.</i>";
              const sent = await tgSend("/sendAudio", {
                chat_id: bundle.channel_chat_id,
                audio: audioUrl,
                title: title ?? `0G Victory Anthem — ${ticker}`,
                performer: "0G-Syndicate Master Bot",
                caption: `🎵 <b>Victory Anthem — ${ticker}</b>\n\n${compliance}`,
                parse_mode: "HTML",
                reply_parameters: bundle.intro_message_id
                  ? { message_id: bundle.intro_message_id }
                  : undefined,
              });
              const nextStatus = bundle.veo_video_url ? "complete" : "partial";
              await supabaseAdmin
                .from("signal_bundles")
                .update({
                  suno_audio_url: audioUrl,
                  suno_message_id: (sent as any)?.message_id ?? null,
                  status: nextStatus,
                })
                .eq("id", job.signal_bundle_id);
            }
          } catch (e) {
            console.error("Signal-Bundle chain failed", e);
          }
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