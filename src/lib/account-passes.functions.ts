import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

async function tg(method: string, body: Record<string, unknown>) {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  const TG = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE) throw new Error("Telegram bot not configured (LOVABLE_API_KEY)");
  if (!TG) throw new Error("Telegram bot not configured (TELEGRAM_API_KEY)");
  const r = await fetch(`${TG_GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": TG,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(`Telegram ${method} failed [${r.status}]: ${j?.description ?? "unknown"}`);
  }
  return j.result;
}

function makeCode(): string {
  // 8-char URL-safe code, easy to type in Telegram.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

export const getMyPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await (supabase as any).rpc("get_user_purchases_summary");
    if (error) throw new Error(error.message);
    return data ?? { passes: [], orders: [], credit_purchases: [] };
  });

export const getTelegramLinkStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data } = await supabase
      .from("telegram_user_links")
      .select("chat_id, tg_username, link_code, code_expires_at, linked_at, notify_purchases, notify_reminders, notify_live")
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  });

export const generateTelegramLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const code = makeCode();
    const expires = new Date(Date.now() + 30 * 60_000).toISOString();

    const { error } = await supabase
      .from("telegram_user_links")
      .upsert(
        {
          user_id: userId,
          link_code: code,
          code_expires_at: expires,
          // Reset chat_id only if not linked yet — keep existing link.
        },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(error.message);
    return { code, expires_at: expires };
  });

export const unlinkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("telegram_user_links")
      .update({ chat_id: null, tg_username: null, linked_at: null, link_code: null, code_expires_at: null })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Pull the user's current Telegram profile photo (via the bot), upload it
 * to the public `avatars` bucket, and set it as the member's
 * profiles.avatar_url. Requires the user to have linked Telegram first
 * (chat_id present in telegram_user_links).
 */
export const importTelegramAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: link } = await supabase
      .from("telegram_user_links")
      .select("chat_id")
      .eq("user_id", userId)
      .maybeSingle();

    const chatId = link?.chat_id ? Number(link.chat_id) : null;
    if (!chatId) {
      throw new Error("Connect your Telegram first, then try again.");
    }

    const photos: any = await tg("getUserProfilePhotos", { user_id: chatId, limit: 1 });
    const sizes = photos?.photos?.[0];
    if (!Array.isArray(sizes) || sizes.length === 0) {
      throw new Error("No Telegram profile photo found. Set one in Telegram, then retry.");
    }
    // Largest size is last.
    const largest = sizes[sizes.length - 1];
    const fileId: string | undefined = largest?.file_id;
    if (!fileId) throw new Error("Telegram returned no usable photo.");

    const fileMeta: any = await tg("getFile", { file_id: fileId });
    const filePath: string | undefined = fileMeta?.file_path;
    if (!filePath) throw new Error("Telegram getFile returned no path.");

    const LOVABLE = process.env.LOVABLE_API_KEY!;
    const TG = process.env.TELEGRAM_API_KEY!;
    const dl = await fetch(`${TG_GATEWAY}/file/${filePath}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE}`,
        "X-Connection-Api-Key": TG,
      },
    });
    if (!dl.ok) throw new Error(`Telegram file download failed [${dl.status}]`);
    const bytes = new Uint8Array(await dl.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("Telegram returned an empty image.");

    const ext = (filePath.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const objectKey = `${userId}/telegram-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(objectKey, bytes, {
        contentType: ext === "png" ? "image/png" : "image/jpeg",
        upsert: true,
      });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(objectKey);
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);
    if (updErr) throw new Error(updErr.message);

    return { avatar_url: publicUrl };
  });

/** Set or clear the member's profile avatar URL. */
export const setProfileAvatar = createServerFn({ method: "POST" })
  .inputValidator((d: { avatar_url: string | null }) => ({
    avatar_url: d?.avatar_url == null ? null : String(d.avatar_url).trim().slice(0, 2000) || null,
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.avatar_url })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, avatar_url: data.avatar_url };
  });

export const updateTelegramPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { notify_purchases?: boolean; notify_reminders?: boolean; notify_live?: boolean }) => ({
    notify_purchases: typeof d.notify_purchases === "boolean" ? d.notify_purchases : undefined,
    notify_reminders: typeof d.notify_reminders === "boolean" ? d.notify_reminders : undefined,
    notify_live: typeof d.notify_live === "boolean" ? d.notify_live : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const patch: Record<string, boolean> = {};
    for (const k of ["notify_purchases", "notify_reminders", "notify_live"] as const) {
      if (typeof (data as any)[k] === "boolean") patch[k] = (data as any)[k];
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("telegram_user_links")
      .update(patch)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });