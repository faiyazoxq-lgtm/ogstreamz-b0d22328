import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { tgSendMessage } from "@/lib/telegram-bot.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _supabase;
}

function fmtPass(source: string) {
  if (source?.startsWith("store:real_og:")) return "Real OG Lifetime Pass";
  if (source?.startsWith("store:streams_pass:")) return "Streams Pass";
  if (source?.startsWith("store:vip_pass:")) return "VIP Pass";
  if (source?.startsWith("pass:")) return "Welcome Pass";
  return "VIP Pass";
}

function copyFor(kind: "7d" | "1d" | "expired", label: string, expires: Date) {
  const dateStr = expires.toUTCString();
  if (kind === "7d") {
    return `⏳ Heads up — your <b>${label}</b> expires in 7 days (${dateStr}).\nRenew at https://ogstreamz.co.uk/account/passes`;
  }
  if (kind === "1d") {
    return `⚠️ Final reminder — your <b>${label}</b> expires in 24 hours (${dateStr}).\nRenew now: https://ogstreamz.co.uk/account/passes`;
  }
  return `🛑 Your <b>${label}</b> has just expired.\nGrab a new one: https://ogstreamz.co.uk/account/passes`;
}

async function processBucket(kind: "7d" | "1d" | "expired") {
  const sb = getSupabase() as any;
  // Window for each bucket:
  // 7d: expires in (6.5d, 7.5d]
  // 1d: expires in (12h, 36h]
  // expired: expired in last 24h
  const now = Date.now();
  let lo: Date, hi: Date;
  if (kind === "7d") {
    lo = new Date(now + 6.5 * 86400_000);
    hi = new Date(now + 7.5 * 86400_000);
  } else if (kind === "1d") {
    lo = new Date(now + 12 * 3600_000);
    hi = new Date(now + 36 * 3600_000);
  } else {
    lo = new Date(now - 24 * 3600_000);
    hi = new Date(now);
  }

  const { data: passes, error } = await sb
    .from("vip_passes")
    .select("id, user_id, source, expires_at, revoked_at")
    .is("revoked_at", null)
    .gt("expires_at", lo.toISOString())
    .lte("expires_at", hi.toISOString())
    .limit(500);
  if (error || !passes) return { kind, sent: 0, error: error?.message };

  let sent = 0;
  for (const p of passes as any[]) {
    // Skip very long passes (e.g. Real OG = 100 years) for the 7d/1d buckets — only fire near actual expiry.
    const daysLeft = (new Date(p.expires_at).getTime() - now) / 86400_000;
    if (kind !== "expired" && daysLeft > 365) continue;

    // Skip if already sent
    const { data: existing } = await sb
      .from("telegram_pass_reminders")
      .select("id").eq("pass_id", p.id).eq("kind", kind).maybeSingle();
    if (existing) continue;

    const { data: link } = await sb
      .from("telegram_user_links")
      .select("chat_id, notify_reminders")
      .eq("user_id", p.user_id)
      .maybeSingle();

    // Always record the row so we don't keep re-checking, even if the user has no Telegram.
    await sb.from("telegram_pass_reminders").insert({ pass_id: p.id, user_id: p.user_id, kind });

    if (!link?.chat_id || link.notify_reminders === false) continue;
    try {
      await tgSendMessage(link.chat_id, copyFor(kind, fmtPass(p.source), new Date(p.expires_at)));
      sent++;
    } catch (e) {
      console.error("tg reminder send failed", e);
    }
  }
  return { kind, sent };
}

export const Route = createFileRoute("/api/public/hooks/telegram-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-hook-secret");
        const expected = process.env.REMINDER_HOOK_SECRET || "";
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
        const ua = (request.headers.get("user-agent") || "").slice(0, 200);

        if (!expected) {
          console.error("[telegram-reminders] REMINDER_HOOK_SECRET not configured");
          return Response.json(
            { error: "server_misconfigured", message: "Reminder hook secret is not configured." },
            { status: 500 },
          );
        }
        if (!provided) {
          console.warn(`[telegram-reminders] 401 missing x-hook-secret ip=${ip} ua="${ua}"`);
          return Response.json(
            { error: "missing_secret", message: "x-hook-secret header is required." },
            { status: 401 },
          );
        }
        // timing-safe compare
        let diff = provided.length ^ expected.length;
        const len = Math.min(provided.length, expected.length);
        for (let i = 0; i < len; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
        if (diff !== 0) {
          console.warn(`[telegram-reminders] 403 invalid x-hook-secret ip=${ip} ua="${ua}"`);
          return Response.json(
            { error: "invalid_secret", message: "x-hook-secret did not match." },
            { status: 403 },
          );
        }

        const results = await Promise.all([
          processBucket("7d"),
          processBucket("1d"),
          processBucket("expired"),
        ]);
        return Response.json({ ok: true, results });
      },
    },
  },
});