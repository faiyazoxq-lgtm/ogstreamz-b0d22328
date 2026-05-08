import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runTradeScan } from "./trade.functions";
import {
  tgSendMessage,
  tgSendVideo,
  FCA_COMPLIANCE_BADGE,
  VIP_BROADCAST_CHAT_ID,
} from "./syndicate.functions";

const SUNO_BASE = "https://api.sunoapi.com/api/v1";
const VEO_MODEL = "veo-3.0-generate-001";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

function buildIntroMessage(intel: any): string {
  const biasEmoji = intel.signal === "BUY" ? "🟢" : intel.signal === "SELL" ? "🔴" : "🟡";
  const ticker = intel.price?.primaryTicker || intel.topMove?.ticker || "MARKET";
  const px = intel.price?.value ? `$${Number(intel.price.value).toLocaleString()}` : "—";
  const tgt = intel.levels?.target ? `$${intel.levels.target}` : "—";
  const stp = intel.levels?.stop ? `$${intel.levels.stop}` : "—";
  return (
    `🚨 <b>0G-SIGNAL BUNDLE: ${ticker}</b>\n` +
    `BIAS: ${biasEmoji} <b>${intel.sentiment}</b>\n` +
    `PRICE: <b>${px}</b>\n` +
    `CATALYST: ${intel.thesis}\n` +
    `TARGET: ${tgt} | STOP: ${stp}\n` +
    `CONFIDENCE: <b>${intel.confidence}%</b>\n\n` +
    `🎵 Victory Anthem · 🎬 Cinematic Ticker — incoming…\n\n` +
    FCA_COMPLIANCE_BADGE
  );
}

// ────────── BOT-TO-BOT WORK ORDER → MUSIC BOT ──────────
async function dispatchMusicBot(args: {
  bundleId: string;
  userId: string;
  intel: any;
  portalSlug: string;
}): Promise<string | null> {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) return null;
  const ticker = args.intel.price?.primaryTicker || args.intel.topMove?.ticker || "MARKET";
  const sentiment = String(args.intel.sentiment || "MIXED").toLowerCase();
  const styleTags = `synthwave, trading floor, victory anthem, ${sentiment}, cinematic`;
  const lyricPrompt =
    `[Verse]\nThe ${ticker} candles light the screen,\nSentiment ${sentiment}, the cleanest play we've seen.\n` +
    `[Chorus]\nZero-G, take the bid, ride the bias,\n${args.intel.signal} on the tape, syndicate alliance.\n` +
    `[Bridge]\n${(args.intel.thesis || "Edge confirmed.").slice(0, 120)}`;
  const webhookBase =
    process.env.PUBLIC_SITE_URL ||
    "https://project--ae4b10fa-6c9c-44d9-bbd5-85d320d62dff.lovable.app";
  const callbackUrl = `${webhookBase.replace(/\/$/, "")}/api/public/suno-webhook`;

  const res = await fetch(`${SUNO_BASE}/suno/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      custom_mode: true,
      mv: "suno-v5-5",
      prompt: lyricPrompt,
      tags: styleTags,
      title: `0G Victory Anthem — ${ticker}`,
      make_instrumental: false,
      webhook_url: callbackUrl,
    }),
  });
  if (!res.ok) {
    console.error("[mesh] music-bot dispatch failed", res.status);
    return null;
  }
  const json: any = await res.json().catch(() => ({}));
  const taskId: string | undefined =
    json?.data?.task_id ?? json?.task_id ?? json?.data?.id ?? json?.id;
  if (!taskId) return null;

  await supabaseAdmin.from("suno_jobs").insert({
    task_id: taskId,
    portal_slug: args.portalSlug,
    user_id: args.userId,
    status: "pending",
    prompt: lyricPrompt,
    style_tags: styleTags,
    title: `0G Victory Anthem — ${ticker}`,
    make_instrumental: false,
    signal_bundle_id: args.bundleId,
    raw: json,
  });
  return taskId;
}

// ────────── BOT-TO-BOT WORK ORDER → V-HUB BOT (Veo) ──────────
async function dispatchVHubBot(args: { intel: any }): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const ticker = args.intel.price?.primaryTicker || args.intel.topMove?.ticker || "MARKET";
  const dir = args.intel.signal === "BUY" ? "rising green" : args.intel.signal === "SELL" ? "falling red" : "sideways amber";
  const prompt =
    `Cinematic 8-second 16:9 trading-terminal ticker for ${ticker}: ${dir} candles, ` +
    `neon HUD overlays, slow dolly across glowing screens in a dark high-frequency-trading ` +
    `room. Volumetric light, subtle dust, anamorphic lens flares. No text overlays.`;

  const res = await fetch(
    `${GEMINI_BASE}/models/${VEO_MODEL}:predictLongRunning?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { aspectRatio: "16:9", personGeneration: "dont_allow" },
      }),
    },
  );
  if (!res.ok) {
    console.error("[mesh] v-hub dispatch failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json: any = await res.json().catch(() => ({}));
  return json?.name ?? null;
}

// ────────── MASTER BOT: SPAWN BUNDLE ──────────
const SpawnInput = z.object({ slug: z.string().min(1).max(120) });

export const bundleAndBroadcastSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SpawnInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    if (!(await isAdmin(userId))) throw new Error("Boss only — admins can broadcast bundles");

    // 1. Trade Bot generates the signal
    const intel: any = await runTradeScan({ data: { slug: data.slug } });

    // 2. Insert bundle row
    const { data: bundle, error: insErr } = await supabaseAdmin
      .from("signal_bundles")
      .insert({
        user_id: userId,
        portal_slug: data.slug,
        channel_chat_id: VIP_BROADCAST_CHAT_ID,
        signal_payload: intel,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    const bundleId = bundle.id as string;

    // 3. Master Bot posts intro to VIP channel (with FCA CP26/13 compliance badge)
    let introMsgId: number | null = null;
    try {
      const sent = await tgSendMessage(VIP_BROADCAST_CHAT_ID, buildIntroMessage(intel));
      introMsgId = sent?.message_id ?? null;
    } catch (e: any) {
      await supabaseAdmin
        .from("signal_bundles")
        .update({ status: "failed", error: `Intro post failed: ${e?.message || e}` })
        .eq("id", bundleId);
      throw new Error(`VIP channel post failed: ${e?.message || e}`);
    }

    // 4. Bot-to-Bot work orders → MusicHUB + V-HUB (parallel, fire-and-forget)
    const [sunoTaskId, veoOp] = await Promise.all([
      dispatchMusicBot({ bundleId, userId, intel, portalSlug: data.slug }).catch((e) => {
        console.error("[mesh] music dispatch err", e);
        return null;
      }),
      dispatchVHubBot({ intel }).catch((e) => {
        console.error("[mesh] v-hub dispatch err", e);
        return null;
      }),
    ]);

    await supabaseAdmin
      .from("signal_bundles")
      .update({
        intro_message_id: introMsgId,
        suno_task_id: sunoTaskId,
        veo_operation: veoOp,
        status: "partial",
      })
      .eq("id", bundleId);

    return {
      ok: true,
      bundleId,
      introMessageId: introMsgId,
      sunoTaskId,
      veoOperation: veoOp,
      channel: VIP_BROADCAST_CHAT_ID,
      compliance: FCA_COMPLIANCE_BADGE,
    };
  });

// ────────── POLL VEO + POST CINEMATIC TICKER REPLY ──────────
const PollInput = z.object({ bundleId: z.string().uuid() });

export const pollVeoBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PollInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    if (!(await isAdmin(userId))) throw new Error("Boss only");
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing");

    const { data: bundle } = await supabaseAdmin
      .from("signal_bundles")
      .select("*")
      .eq("id", data.bundleId)
      .maybeSingle();
    if (!bundle) throw new Error("Bundle not found");
    if (bundle.veo_video_url) {
      return { ready: true, alreadyPosted: true, video_url: bundle.veo_video_url };
    }
    if (!bundle.veo_operation) return { ready: false, reason: "No Veo operation" };

    const opRes = await fetch(`${GEMINI_BASE}/${bundle.veo_operation}?key=${key}`);
    if (!opRes.ok) {
      const text = await opRes.text().catch(() => "");
      throw new Error(`Veo poll failed [${opRes.status}]: ${text.slice(0, 200)}`);
    }
    const op: any = await opRes.json();
    if (!op?.done) return { ready: false, status: "rendering" };

    // Extract video URI
    const videoUri: string | undefined =
      op?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ??
      op?.response?.predictions?.[0]?.video?.uri ??
      op?.response?.videos?.[0]?.uri;
    if (!videoUri) {
      await supabaseAdmin
        .from("signal_bundles")
        .update({ status: "failed", error: "Veo response missing video URI" })
        .eq("id", data.bundleId);
      return { ready: false, error: "Veo returned no video URI", raw: op };
    }

    // Download via API key, upload to public storage so Telegram can fetch by URL
    const dl = await fetch(`${videoUri}${videoUri.includes("?") ? "&" : "?"}key=${key}`);
    if (!dl.ok) throw new Error(`Veo download failed [${dl.status}]`);
    const buf = new Uint8Array(await dl.arrayBuffer());
    const path = `veo/${data.bundleId}.mp4`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("portals-media")
      .upload(path, buf, { contentType: "video/mp4", upsert: true });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
    const { data: pub } = supabaseAdmin.storage.from("portals-media").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // Post cinematic reply to VIP channel
    const ticker =
      bundle.signal_payload?.price?.primaryTicker ||
      bundle.signal_payload?.topMove?.ticker ||
      "MARKET";
    const caption = `🎬 <b>Cinematic Ticker — ${ticker}</b>\n\n${FCA_COMPLIANCE_BADGE}`;
    const sent = await tgSendVideo(bundle.channel_chat_id, publicUrl, {
      caption,
      reply_parameters: bundle.intro_message_id
        ? { message_id: bundle.intro_message_id }
        : undefined,
    });

    const { data: refreshed } = await supabaseAdmin
      .from("signal_bundles")
      .select("suno_audio_url")
      .eq("id", data.bundleId)
      .maybeSingle();
    const nextStatus = refreshed?.suno_audio_url ? "complete" : "partial";
    await supabaseAdmin
      .from("signal_bundles")
      .update({
        veo_video_url: publicUrl,
        veo_message_id: sent?.message_id ?? null,
        status: nextStatus,
      })
      .eq("id", data.bundleId);

    return { ready: true, video_url: publicUrl, message_id: sent?.message_id ?? null };
  });

// ────────── LIST BUNDLES (for admin dashboard) ──────────
export const listMyBundles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { data } = await supabaseAdmin
      .from("signal_bundles")
      .select("id, portal_slug, status, intro_message_id, suno_audio_url, veo_video_url, veo_operation, created_at, signal_payload")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { bundles: data ?? [] };
  });
