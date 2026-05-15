import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { createClient } from "@supabase/supabase-js";

const TG_API = "https://api.telegram.org";

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

/** Direct Telegram call using a per-bot token (NOT the gateway) */
async function tgDirect(token: string, method: string, body: any) {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(`Telegram ${method} failed [${res.status}]: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.result;
}

function projectBaseUrl(): string {
  // Stable public dev URL — works in preview + published
  return `https://project--ae4b10fa-6c9c-44d9-bbd5-85d320d62dff.lovable.app`;
}

export const listFleet = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    const admin = adminClient();
    const [{ data: bots }, { data: settings }] = await Promise.all([
      // Whitelist columns — never return webhook_secret or full token to the client.
      admin
        .from("bot_factory")
        .select(
          "id,pair_name,pair_label,bot_username,channel_chat_id,asset_class,bias,active,tier,last_pinged_at,last_broadcast,ping_count,webhook_url,created_at,updated_at"
        )
        .order("created_at", { ascending: false }),
      admin.from("fleet_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    return {
      bots: (bots || []).map((b: any) => ({
        ...b,
        // Token is encrypted at rest and never returned to the client.
        telegram_bot_token: "•••",
      })),
      settings: settings || { global_frequency: "aggressive" },
    };
  });

export const spawnFleetBot = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { pair_name: string; telegram_bot_token: string; channel_chat_id?: string; pair_label?: string; bias?: string; asset_class?: string }) => ({
    pair_name: String(d.pair_name || "").trim().slice(0, 60),
    telegram_bot_token: String(d.telegram_bot_token || "").trim(),
    channel_chat_id: String(d.channel_chat_id || "").trim().slice(0, 80),
    pair_label: String(d.pair_label || "").trim().slice(0, 80),
    bias: ["good", "bad", "neutral"].includes(d.bias || "") ? d.bias! : "neutral",
    asset_class: d.asset_class ? String(d.asset_class).slice(0, 32) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.pair_name) throw new Error("Pair name required");
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(data.telegram_bot_token)) throw new Error("Invalid Telegram bot token format");

    const admin = adminClient();

    // Verify the token + grab username
    const me = await tgDirect(data.telegram_bot_token, "getMe", {});

    // Insert via service-role-only RPC so the token is encrypted at rest and a
    // fresh encrypted webhook secret is generated server-side.
    const { data: rpcRows, error } = await admin.rpc("bot_factory_create", {
      p_pair_name: data.pair_name,
      p_pair_label: data.pair_label || data.pair_name,
      p_token: data.telegram_bot_token,
      p_bot_username: me?.username || null,
      p_channel_chat_id: data.channel_chat_id,
      p_bias: data.bias,
      p_asset_class: data.asset_class,
      p_created_by: userId,
    });
    if (error) throw new Error(error.message);
    const inserted = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!inserted?.id || !inserted?.webhook_secret) {
      throw new Error("Bot insert failed");
    }

    // Set webhook to our public route — uses bot id as path param + per-bot secret
    const webhookUrl = `${projectBaseUrl()}/api/public/fleet/webhook/${inserted.id}`;
    try {
      await tgDirect(data.telegram_bot_token, "setWebhook", {
        url: webhookUrl,
        secret_token: inserted.webhook_secret,
        allowed_updates: ["message", "edited_message", "channel_post"],
      });
      await admin.from("bot_factory").update({ webhook_url: webhookUrl }).eq("id", inserted.id);
    } catch (e: any) {
      // Roll back the insert if webhook setup fails
      await admin.from("bot_factory").delete().eq("id", inserted.id);
      throw new Error(`Webhook setup failed: ${e?.message || e}`);
    }

    return { ok: true, bot_username: me?.username, webhook_url: webhookUrl };
  });

export const deleteFleetBot = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id || "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    const admin = adminClient();
    const { data: token } = await admin.rpc("bot_factory_reveal_token", { p_id: data.id });
    if (typeof token === "string" && token.length > 0) {
      await tgDirect(token, "deleteWebhook", { drop_pending_updates: true }).catch(() => {});
    }
    const { error } = await admin.from("bot_factory").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBotTier = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { id: string; tier: "FREE" | "PAID" }) => ({
    id: String(d.id || ""),
    tier: d.tier === "PAID" ? "PAID" : "FREE",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    const admin = adminClient();
    const { error } = await admin.from("bot_factory").update({ tier: data.tier }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBotActive = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { id: string; active: boolean }) => ({ id: String(d.id || ""), active: !!d.active }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    const admin = adminClient();
    const { error } = await admin.from("bot_factory").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setGlobalFrequency = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { frequency: "aggressive" | "passive" }) => ({
    frequency: d.frequency === "passive" ? "passive" : "aggressive",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    const admin = adminClient();
    const { error } = await admin
      .from("fleet_settings")
      .update({ global_frequency: data.frequency, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true, frequency: data.frequency };
  });

/** Master Bot broadcast — fans a single command to every active bot in the fleet,
 *  posted into each pair's own channel using that pair-bot's own token. */
export const broadcastFleetCommand = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { message: string }) => ({ message: String(d.message || "").trim().slice(0, 2000) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.message) throw new Error("Message required");
    const admin = adminClient();
    const { data: bots } = await admin
      .from("bot_factory")
      .select("id,pair_name,pair_label,channel_chat_id,ping_count")
      .eq("active", true);

    const results: { pair: string; ok: boolean; err?: string }[] = [];
    for (const bot of bots || []) {
      if (!bot.channel_chat_id) {
        results.push({ pair: bot.pair_name, ok: false, err: "no channel_chat_id" });
        continue;
      }
      try {
        const { data: token } = await admin.rpc("bot_factory_reveal_token", { p_id: bot.id });
        if (typeof token !== "string" || !token) {
          results.push({ pair: bot.pair_name, ok: false, err: "no token" });
          continue;
        }
        const text =
          `🛰️ <b>0G · ${bot.pair_label || bot.pair_name}</b>\n` +
          `<i>📣 MASTER BROADCAST</i>\n\n` +
          escapeHtml(data.message);
        await tgDirect(token, "sendMessage", {
          chat_id: bot.channel_chat_id,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
        await admin.from("bot_factory").update({
          last_pinged_at: new Date().toISOString(),
          last_broadcast: data.message.slice(0, 240),
          ping_count: (bot.ping_count || 0) + 1,
        }).eq("id", bot.id);
        results.push({ pair: bot.pair_name, ok: true });
      } catch (e: any) {
        results.push({ pair: bot.pair_name, ok: false, err: e?.message?.slice(0, 200) });
      }
    }
    return { results, total: results.length, ok: results.filter(r => r.ok).length };
  });

function escapeHtml(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}