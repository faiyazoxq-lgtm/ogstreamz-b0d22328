import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDeepSearch } from "./orchestrator.functions";
import { spawnMusic } from "./suno.functions";
import { tgSendMessage } from "./syndicate.functions";

const Cmd = z.object({
  asset: z.string().min(1).max(40),
  bias: z.enum(["bullish", "bearish", "neutral"]).default("neutral"),
  command: z.string().min(1).max(500),
  level: z.string().max(40).optional(),
});

type ReasonOut = {
  summary: string;
  bullCase: string;
  bearCase: string;
  anthemPrompt: string;
  anthemTags: string;
  videoPrompt: string;
  telegramCaption: string;
};

async function reasonWithGemini(
  asset: string,
  bias: string,
  command: string,
  headlines: string[],
  citations: string[],
): Promise<ReasonOut> {
  const PPLX = process.env.PERPLEXITY_API_KEY;
  if (!PPLX) throw new Error("PERPLEXITY_API_KEY missing");

  const sys =
    "You are 0G-BRAIN, the chief strategist of the 0G Syndicate. Output STRICT JSON only — no markdown, no prose. " +
    "Cross-reference the provided headlines with the boss's command and produce a Power Pack brief.";

  const user = `Boss command: "${command}"
Asset: ${asset}
Desired bias: ${bias}
Live headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n") || "(none)"}
Sources: ${citations.slice(0, 5).join(", ")}

Return STRICT JSON with this exact shape:
{
  "summary": "2-sentence elite trader summary referencing the news",
  "bullCase": "1-2 sentence bullish thesis with a concrete catalyst",
  "bearCase": "1-2 sentence bearish counter-thesis",
  "anthemPrompt": "lyrics brief for a 60s ${bias} ${asset} anthem — Urdu/English blend, multi-platinum producer voice",
  "anthemTags": "comma-separated Suno style tags, e.g. 'trap, anthemic, 808, brass stabs, 130bpm'",
  "videoPrompt": "cinematic 5s Veo prompt — no text overlays — visual metaphor for ${bias} ${asset}",
  "telegramCaption": "VIP-channel caption (max 600 chars), HTML-safe, with one emoji per line max"
}`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.65,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Perplexity ${res.status}: ${t.slice(0, 200)}`);
  }
  const j: any = await res.json();
  const txt: string = j?.choices?.[0]?.message?.content ?? "{}";
  const m = txt.match(/\{[\s\S]*\}/);
  let parsed: Partial<ReasonOut> = {};
  try {
    parsed = JSON.parse(m ? m[0] : txt);
  } catch {
    /* */
  }
  return {
    summary: parsed.summary ?? `${asset} ${bias} brief`,
    bullCase: parsed.bullCase ?? "",
    bearCase: parsed.bearCase ?? "",
    anthemPrompt: parsed.anthemPrompt ?? `Anthem for ${asset} ${bias} run`,
    anthemTags: parsed.anthemTags ?? `${bias === "bullish" ? "triumphant trap" : "dark cinematic"}, anthemic, 130bpm`,
    videoPrompt: parsed.videoPrompt ?? `Cinematic ${bias} ${asset} sequence`,
    telegramCaption:
      parsed.telegramCaption ??
      `<b>0G-Syndicate Power Pack</b>\n${asset} · ${bias.toUpperCase()}\n\n${parsed.summary ?? command}`,
  };
}

async function tgBroadcastIntro(chatId: string, pack: any) {
  const head = `<b>⚡ 0G-SYNDICATE POWER PACK</b>\n<b>${pack.asset}</b> · <b>${pack.bias.toUpperCase()}</b>\n\n${pack.telegram_caption ?? pack.summary ?? ""}`;
  const links = (pack.headlines as string[])
    ?.slice(0, 5)
    .map((h, i) => `${i + 1}. ${h}`)
    .join("\n");
  const body = `${head}\n\n<b>Live Wire</b>\n${links ?? ""}`;
  return tgSendMessage(chatId, body.slice(0, 3800));
}

/**
 * Boss command → orchestrate Perplexity + Gemini + Suno + Telegram.
 * Veo video generation is queued (Veo API is async / long-running);
 * the videoPrompt is stored and can be produced in a follow-up step.
 */
export const runPowerPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Cmd.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };

    // 0. create the pack row up front so the UI can subscribe
    const { data: pack, error: insErr } = await supabaseAdmin
      .from("power_packs")
      .insert({
        user_id: userId,
        asset: data.asset,
        bias: data.bias,
        command: data.command,
        status: "scouting",
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    try {
      // 1. Perplexity scout
      const scoutQuery = `${data.asset} latest market news, catalysts, and price action. ${data.command}`;
      const scout = await runDeepSearch({ query: scoutQuery, recency: "day", minSources: 5 });
      const headlines = scout.verified_sources.slice(0, 5).map((s) => s.title);
      const citations = scout.verified_sources.slice(0, 5).map((s) => s.url);

      await supabaseAdmin
        .from("power_packs")
        .update({
          headlines,
          citations,
          status: "reasoning",
        })
        .eq("id", pack.id);

      // 2. Gemini reason
      const brief = await reasonWithGemini(data.asset, data.bias, data.command, headlines, citations);

      await supabaseAdmin
        .from("power_packs")
        .update({
          summary: brief.summary,
          bull_case: brief.bullCase,
          bear_case: brief.bearCase,
          anthem_prompt: brief.anthemPrompt,
          video_prompt: brief.videoPrompt,
          telegram_caption: brief.telegramCaption,
          status: "producing",
        })
        .eq("id", pack.id);

      // 3. Suno (async via webhook). Veo is queued — see note above.
      let sunoTaskId: string | null = null;
      try {
        const sunoTitle = `0G ${data.asset} ${data.bias} Anthem`;
        const sunoRes = await spawnMusic({
          data: {
            prompt: brief.anthemPrompt,
            style_tags: brief.anthemTags,
            title: sunoTitle,
          },
        } as any);
        sunoTaskId = (sunoRes as any)?.job?.task_id ?? null;
        if (sunoTaskId) {
          await supabaseAdmin
            .from("suno_jobs")
            .update({ power_pack_id: pack.id })
            .eq("task_id", sunoTaskId);
          await supabaseAdmin
            .from("power_packs")
            .update({ suno_task_id: sunoTaskId })
            .eq("id", pack.id);
        }
      } catch (e: any) {
        console.error("Power Pack: Suno spawn failed", e?.message);
      }

      // 4. Telegram broadcast (intro now; audio appended by webhook)
      let tgStatus = "skipped";
      let tgMessageId: string | null = null;
      try {
        const { data: bot } = await supabaseAdmin
          .from("bot_configs")
          .select("channel_chat_id")
          .eq("active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bot?.channel_chat_id) {
          const sent = await tgBroadcastIntro(bot.channel_chat_id, {
            ...pack,
            ...brief,
            headlines,
            telegram_caption: brief.telegramCaption,
          });
          tgMessageId = String(sent?.message_id ?? "");
          tgStatus = "sent";
        } else {
          tgStatus = "no_channel";
        }
      } catch (e: any) {
        console.error("Power Pack: Telegram intro failed", e?.message);
        tgStatus = "error";
      }

      const { data: finalPack } = await supabaseAdmin
        .from("power_packs")
        .update({
          status: "broadcast",
          telegram_status: tgStatus,
          telegram_message_id: tgMessageId,
        })
        .eq("id", pack.id)
        .select("*")
        .single();

      return { ok: true, pack: finalPack };
    } catch (e: any) {
      await supabaseAdmin
        .from("power_packs")
        .update({ status: "error", summary: e?.message?.slice(0, 500) ?? "error" })
        .eq("id", pack.id);
      throw e;
    }
  });

export const listMyPowerPacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("power_packs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);
    return { packs: data ?? [] };
  });