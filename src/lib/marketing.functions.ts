import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * 0G Auto-Marketing Engine
 *
 * Triggered fire-and-forget the moment a portal is spawned. Does:
 *   1. Expand the user's prompt with Gemini into a full pitch + audience ICP + copy.
 *   2. Persist to portal_marketing + portals.seo_*
 *   3. Broadcast a Telegram audio post to the VIP channel.
 *   4. Queue an Apollo cold-outreach connect_campaign.
 *
 * Non-blocking: any sub-step failure logs but never throws.
 */

const TELEGRAM_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

type MarketingDraft = {
  expandedPitch: string;
  audienceICP: string;
  apolloFilters: {
    titles: string[];
    industries: string[];
    locations: string[];
    keywords: string[];
  };
  emailSubject: string;
  emailBody: string;
  telegramCaption: string;
  seoTitle: string;
  seoDescription: string;
  hashtags: string[];
};

const FALLBACK_DRAFT = (portal: any): MarketingDraft => ({
  expandedPitch: portal.vibe || portal.name,
  audienceICP: "creators and culture seekers 18-44",
  apolloFilters: { titles: [], industries: ["Music", "Entertainment"], locations: [], keywords: [portal.style || ""] },
  emailSubject: `New drop from 0G-Syndicate: ${portal.name}`,
  emailBody: `Just dropped: ${portal.name}.\n\n${portal.vibe || ""}\n\nListen → ${portalUrl(portal.slug, portal.kind)}\n\n— 0G-Syndicate`,
  telegramCaption: `🔥 ${portal.name}\n${portal.style || ""} · ${portal.language || "EN"}\n${portalUrl(portal.slug, portal.kind)}`,
  seoTitle: `${portal.name} — 0G Portal`.slice(0, 60),
  seoDescription: (portal.vibe || `${portal.name} on 0G-Syndicate`).slice(0, 160),
  hashtags: ["0gsyndicate", (portal.style || "music").replace(/\s+/g, "")],
});

function portalUrl(slug: string, kind: string): string {
  const base = process.env.LOVABLE_PUBLIC_URL || "https://project--ae4b10fa-6c9c-44d9-bbd5-85d320d62dff.lovable.app";
  const prefix = kind === "music" ? "m" : kind === "joke" ? "p" : kind === "trade" ? "td" : "t";
  return `${base}/${prefix}/${slug}`;
}

async function geminiDraft(portal: any): Promise<MarketingDraft> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return FALLBACK_DRAFT(portal);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const sys = `You are the 0G-Syndicate marketing director. Output STRICT JSON matching the schema. No prose.`;
  const user = `Portal:
- Name: ${portal.name}
- Kind: ${portal.kind}
- Style/Genre: ${portal.style || "n/a"}
- Language: ${portal.language || "English"}
- Vibe / Original Brief: ${portal.vibe || "n/a"}
- Slug: ${portal.slug}

Expand the brief into a complete go-to-market kit. Pick a sharply specific target audience (ICP). Write Apollo filter values that real B2B/B2C buyers might match. Telegram caption must be punchy under 350 chars and use 1-3 emojis.

Schema:
{
  "expandedPitch": "2 punchy paragraphs",
  "audienceICP": "1 sentence target audience",
  "apolloFilters": { "titles": ["..."], "industries": ["..."], "locations": ["..."], "keywords": ["..."] },
  "emailSubject": "<70 chars",
  "emailBody": "personal cold email, 90-140 words",
  "telegramCaption": "<350 chars",
  "seoTitle": "<60 chars",
  "seoDescription": "<160 chars",
  "hashtags": ["tag1", "tag2", "tag3"]
}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.85, maxOutputTokens: 2048 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(text);
    return { ...FALLBACK_DRAFT(portal), ...parsed };
  } catch (e) {
    console.warn("[marketing] gemini draft failed, using fallback:", e);
    return FALLBACK_DRAFT(portal);
  }
}

async function tgBroadcast(caption: string): Promise<string | null> {
  const tk = process.env.TELEGRAM_API_KEY;
  const lk = process.env.LOVABLE_API_KEY;
  if (!tk || !lk) return null;
  // Find the first active VIP-tier channel in bot_configs
  const { data: cfg } = await supabaseAdmin
    .from("bot_configs")
    .select("channel_chat_id")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const chatId = cfg?.channel_chat_id;
  if (!chatId) return null;
  try {
    const res = await fetch(`${TELEGRAM_GATEWAY}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lk}`,
        "X-Connection-Api-Key": tk,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML", disable_web_page_preview: false }),
    });
    const j = await res.json();
    if (!res.ok) {
      console.warn("[marketing] telegram failed:", j);
      return null;
    }
    return String(j?.result?.message_id ?? "");
  } catch (e) {
    console.warn("[marketing] telegram crashed:", e);
    return null;
  }
}

export const runPortalMarketing = createServerFn({ method: "POST" })
  .inputValidator((d: { portalId: string }) => ({ portalId: String(d.portalId || "").slice(0, 64) }))
  .handler(async ({ data }) => {
    if (!data.portalId) throw new Error("portalId required");
    const { data: portal } = await supabaseAdmin
      .from("portals")
      .select("id, slug, name, kind, style, language, vibe, created_by")
      .eq("id", data.portalId)
      .maybeSingle();
    if (!portal) throw new Error("Portal not found");

    // Insert pending row up-front so the dashboard can see status.
    await supabaseAdmin.from("portal_marketing").insert({
      portal_id: portal.id,
      portal_slug: portal.slug,
      status: "pending",
    });

    const draft = await geminiDraft(portal);
    const url = portalUrl(portal.slug, portal.kind);

    // Persist SEO meta on the portal itself.
    await supabaseAdmin
      .from("portals")
      .update({
        seo_title: draft.seoTitle,
        seo_description: draft.seoDescription,
        seo_refreshed_at: new Date().toISOString(),
      })
      .eq("id", portal.id);

    // Telegram + Apollo in parallel.
    const captionWithLink = draft.telegramCaption.includes(url) ? draft.telegramCaption : `${draft.telegramCaption}\n\n${url}`;
    const [tgMsgId, campaign] = await Promise.all([
      tgBroadcast(captionWithLink),
      (async () => {
        try {
          const offer = `${portal.name} — ${draft.audienceICP}`;
          if (!portal.created_by) return null; // connect_campaigns requires an owner
          const { data: c } = await supabaseAdmin
            .from("connect_campaigns")
            .insert({
              icp: draft.audienceICP,
              offer,
              target_url: url,
              target_company: (draft.apolloFilters.industries?.[0] || "creators"),
              created_by: portal.created_by,
              status: "draft",
              scout_summary: draft.expandedPitch,
              scout_news: [],
            })
            .select("id")
            .maybeSingle();
          return c?.id ?? null;
        } catch (e) {
          console.warn("[marketing] connect_campaign insert failed:", e);
          return null;
        }
      })(),
    ]);

    await supabaseAdmin
      .from("portal_marketing")
      .update({
        expanded_pitch: draft.expandedPitch,
        audience_icp: draft.audienceICP,
        apollo_filters: draft.apolloFilters,
        email_subject: draft.emailSubject,
        email_body: draft.emailBody,
        telegram_caption: captionWithLink,
        hashtags: draft.hashtags,
        seo_title: draft.seoTitle,
        seo_description: draft.seoDescription,
        telegram_message_id: tgMsgId ?? undefined,
        campaign_id: campaign,
        status: "shipped",
      })
      .eq("portal_id", portal.id);

    return { ok: true, telegram: !!tgMsgId, campaign: !!campaign };
  });
