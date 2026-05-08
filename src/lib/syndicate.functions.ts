import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { runDeepSearch } from "./orchestrator.functions";

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

export type Plan = "free" | "metal" | "energy" | "syndicate";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

function adminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env missing");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function tgFetch(path: string, body: any) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY not configured (connect Telegram)");
  const res = await fetch(`${TG_GATEWAY}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(`Telegram ${path} failed [${res.status}]: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.result ?? json;
}

export async function tgSendMessage(chat_id: string | number, text: string, opts: any = {}) {
  return tgFetch("/sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...opts });
}

export async function tgSendVideo(chat_id: string | number, video: string, opts: any = {}) {
  return tgFetch("/sendVideo", { chat_id, video, parse_mode: "HTML", supports_streaming: true, ...opts });
}

export async function tgSendAudio(chat_id: string | number, audio: string, opts: any = {}) {
  return tgFetch("/sendAudio", { chat_id, audio, parse_mode: "HTML", ...opts });
}

/** FCA CP26/13 (May 2026) compliance badge — must accompany every signal. */
export const FCA_COMPLIANCE_BADGE =
  "⚖️ <b>SENTIMENT ANALYSIS ONLY — NOT A DIRECT FINANCIAL PROMOTION</b>\n<i>Compliant with FCA CP26/13 (May 2026). 0G-PORTAL Sentiment Mesh.</i>";

/** VIP broadcast channel for the Master Bot bundle posts. */
export const VIP_BROADCAST_CHAT_ID = "@og_portal";

// ───── Admin: Bot config CRUD ─────
export const listBots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    const { data, error } = await supabase
      .from("bot_configs")
      .select("*")
      .order("pair_name", { ascending: true });
    if (error) throw new Error(error.message);
    return { bots: data || [] };
  });

export const upsertBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    pair_name: string;
    pair_label: string;
    channel_chat_id: string;
    tier_required: Plan;
    update_frequency?: string;
    asset_class?: string;
    bias?: string;
    active?: boolean;
  }) => ({
    id: d.id || undefined,
    pair_name: String(d.pair_name || "").trim().slice(0, 60),
    pair_label: String(d.pair_label || "").trim().slice(0, 80),
    channel_chat_id: String(d.channel_chat_id || "").trim().slice(0, 80),
    tier_required: (["metal","energy","syndicate"].includes(d.tier_required) ? d.tier_required : "metal") as Plan,
    update_frequency: String(d.update_frequency || "15min").slice(0, 32),
    asset_class: d.asset_class ? String(d.asset_class).slice(0, 32) : undefined,
    bias: d.bias ? String(d.bias).slice(0, 16) : "neutral",
    active: d.active ?? true,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.pair_name || !data.channel_chat_id) throw new Error("pair_name and channel_chat_id required");

    const row: any = {
      pair_name: data.pair_name,
      pair_label: data.pair_label || data.pair_name,
      channel_chat_id: data.channel_chat_id,
      tier_required: data.tier_required,
      update_frequency: data.update_frequency,
      asset_class: data.asset_class || null,
      bias: data.bias || "neutral",
      active: data.active,
      created_by: userId,
    };
    const q = data.id
      ? supabase.from("bot_configs").update(row).eq("id", data.id).select("*").single()
      : supabase.from("bot_configs").insert(row).select("*").single();
    const { data: bot, error } = await q;
    if (error) throw new Error(error.message);
    return { bot };
  });

export const deleteBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id || "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    const { error } = await supabase.from("bot_configs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ───── Broadcast: Master fans out a Boss Alert to every active channel ─────
function biasEmoji(bias: string) {
  return bias === "good" ? "🟢" : bias === "bad" ? "🔴" : "🛰️";
}

async function postPairUpdate(bot: any, headline: string, body: string) {
  const txt =
    `${biasEmoji(bot.bias)} <b>0G · ${escapeHtml(bot.pair_label)}</b>\n` +
    `<i>${escapeHtml(headline)}</i>\n\n` +
    `${escapeHtml(body)}\n\n` +
    `<a href="https://t.me/${process.env.TELEGRAM_BOT_USERNAME || "0G_Master_Bot"}">⚡ 0G-PORTAL · Syndicate</a>`;
  return tgSendMessage(bot.channel_chat_id, txt);
}
function escapeHtml(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const broadcastGlobalAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message: string }) => ({ message: String(d.message || "").trim().slice(0, 2000) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.message) throw new Error("Message required");

    const admin = adminClient();
    const { data: bots } = await admin.from("bot_configs").select("*").eq("active", true);
    const results: { pair: string; ok: boolean; err?: string }[] = [];
    for (const bot of bots || []) {
      try {
        await postPairUpdate(bot, "🚨 GLOBAL BOSS ALERT", data.message);
        results.push({ pair: bot.pair_name, ok: true });
        await admin.from("bot_configs").update({
          last_pinged_at: new Date().toISOString(),
          last_broadcast: data.message.slice(0, 240),
          ping_count: (bot.ping_count || 0) + 1,
        }).eq("id", bot.id);
      } catch (e: any) {
        results.push({ pair: bot.pair_name, ok: false, err: e?.message?.slice(0, 200) });
      }
    }
    return { results, total: results.length, ok: results.filter(r => r.ok).length };
  });

// ───── Cron tick: scout each bot's pair and post a digest ─────
export async function runSyndicateTickInternal(): Promise<{ posted: number; skipped: number; errors: string[] }> {
  const admin = adminClient();
  const { data: bots, error } = await admin.from("bot_configs").select("*").eq("active", true);
  if (error) throw new Error(error.message);

  let posted = 0, skipped = 0;
  const errors: string[] = [];
  const now = Date.now();

  for (const bot of bots || []) {
    // simple cadence: 15min default; honor per-bot 5min/15min/hourly
    const minutes = bot.update_frequency === "5min" ? 5
      : bot.update_frequency === "hourly" ? 60
      : bot.update_frequency === "volatility" ? 99999  // skipped until volatility wired
      : 15;
    const last = bot.last_pinged_at ? new Date(bot.last_pinged_at).getTime() : 0;
    if (last && now - last < minutes * 60_000) { skipped++; continue; }
    if (bot.update_frequency === "volatility") { skipped++; continue; }

    try {
      const query = `Latest market-moving headlines for ${bot.pair_name} in the last hour. Bias: ${bot.bias}. Give a 2-sentence trader takeaway and one cited source.`;
      const deep = await runDeepSearch({ query, recency: "hour" }).catch(() => null);
      const headline = deep?.answer?.split("\n")[0]?.slice(0, 140) || `${bot.pair_label} · pulse update`;
      const body = (deep?.answer || `No new high-signal updates for ${bot.pair_label}.`).slice(0, 800);
      const cite = deep?.verified_sources?.[0]?.url ? `\n\nSource: ${deep.verified_sources[0].url}` : "";
      await postPairUpdate(bot, headline, body + cite);
      await admin.from("bot_configs").update({
        last_pinged_at: new Date().toISOString(),
        last_broadcast: headline.slice(0, 240),
        ping_count: (bot.ping_count || 0) + 1,
      }).eq("id", bot.id);
      posted++;
    } catch (e: any) {
      errors.push(`${bot.pair_name}: ${e?.message?.slice(0, 200)}`);
    }
  }
  return { posted, skipped, errors };
}

export const runSyndicateTickNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    return runSyndicateTickInternal();
  });

// ───── Subscriber management ─────
export const setSubscriberPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; plan: Plan; telegram_user_id?: number; telegram_username?: string }) => ({
    user_id: String(d.user_id || ""),
    plan: (["free","metal","energy","syndicate"].includes(d.plan) ? d.plan : "free") as Plan,
    telegram_user_id: d.telegram_user_id ? Number(d.telegram_user_id) : undefined,
    telegram_username: d.telegram_username ? String(d.telegram_username).slice(0, 64) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    const admin = adminClient();

    await admin.from("profiles").update({ subscription_plan: data.plan }).eq("id", data.user_id);
    await admin.from("syndicate_subscribers").upsert({
      user_id: data.user_id,
      plan: data.plan,
      status: data.plan === "free" ? "canceled" : "active",
      telegram_user_id: data.telegram_user_id ?? null,
      telegram_username: data.telegram_username ?? null,
    }, { onConflict: "user_id" });

    // If plan downgraded to free, kick from all pair channels
    if (data.plan === "free" && data.telegram_user_id) {
      const { data: bots } = await admin.from("bot_configs").select("*").eq("active", true);
      for (const bot of bots || []) {
        try {
          await tgFetch("/banChatMember", { chat_id: bot.channel_chat_id, user_id: data.telegram_user_id });
          await tgFetch("/unbanChatMember", { chat_id: bot.channel_chat_id, user_id: data.telegram_user_id, only_if_banned: true });
        } catch { /* channel may not have this user; ignore */ }
      }
    }
    return { ok: true };
  });

export const getFleetStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const empty = {
      bots: [] as any[],
      planCounts: { free: 0, metal: 0, energy: 0, syndicate: 0 } as Record<string, number>,
      activeMembers: 0,
      churned: 0,
      churnRate: 0,
      recentProfiles: [] as any[],
      error: null as string | null,
    };
    try {
      if (!(await isAdmin(supabase, userId))) return { ...empty, error: "Admin only" };
      const admin = adminClient();
      const [bots, subs, profiles] = await Promise.all([
        admin.from("bot_configs").select("pair_name, pair_label, tier_required, active, last_pinged_at, ping_count"),
        admin.from("syndicate_subscribers").select("plan, status"),
        admin.from("profiles").select("id, email, subscription_plan").order("created_at", { ascending: false }).limit(50),
      ]);

      const planCounts: Record<string, number> = { free: 0, metal: 0, energy: 0, syndicate: 0 };
      let activeMembers = 0, churned = 0;
      for (const s of subs.data || []) {
        planCounts[s.plan] = (planCounts[s.plan] || 0) + 1;
        if (s.status === "active") activeMembers++;
        if (s.status === "canceled" || s.status === "kicked") churned++;
      }
      const churnRate = activeMembers + churned > 0 ? Math.round((churned / (activeMembers + churned)) * 100) : 0;

      return {
        bots: bots.data || [],
        planCounts,
        activeMembers,
        churned,
        churnRate,
        recentProfiles: profiles.data || [],
        error: null,
      };
    } catch (e: any) {
      console.error("getFleetStats failed:", e?.message ?? e);
      return { ...empty, error: e?.message ?? "Stats unavailable" };
    }
  });