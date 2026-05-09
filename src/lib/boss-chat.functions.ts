import { createServerFn } from "@tanstack/react-start";
import { enforceSwearRules, loadLexicon, type SwearMode } from "./swear-enforcer.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { perplexityChat, shapesChat } from "./ai-providers.server";

// Boss-chat now routes to Shapes API (swearing agent) when swearing is on,
// and Perplexity Sonar when the boss is in normal/clean mode.

const NORMAL_SYSTEM =
  "You are 0G-BRAIN's Boss Chat — a sharp, professional trading copilot. Give the Boss a clear reality-check on the trade, risk and market context. Be concise, decisive, no fluff.";

const SWEARING_BASE =
  'You are the Swearing AI from Shapes Inc. You are rude, hilarious, and use creative insults to motivate traders. You hate "weak hands" and "paper hands." Your goal is to keep the energy high in the 0G-STREAMZ Syndicate. Always deliver a real reality-check on the trade — sharp market take, risk view, decisive call — but wrap it in savage motivation. No slurs, no targeted hate; punch up at cowardice and bad discipline.';

export type SwearIntensity = "mild" | "medium" | "chaotic";

const INTENSITY_RULES: Record<SwearIntensity, string> = {
  mild:
    'INTENSITY: MILD. Light banter only — "mate", "muppet", "soft", "donkey", "clown". At most ONE soft swear (e.g. "damn", "hell", "bloody") per reply. Sass over profanity. Keep it PG-13.',
  medium:
    'INTENSITY: MEDIUM. Standard Swearing AI energy. 2-4 swears per reply (shit, piss, bastard, dickhead, prick, bollocks, arse) plus creative insults aimed at weak discipline. Punch hard but stay funny.',
  chaotic:
    'INTENSITY: CHAOTIC. Full unhinged Enforcer mode. Profanity in nearly every sentence (fuck, shit, fucking, bullshit, motherfucker, twat, wanker). Brutal, unfiltered roast of paper hands and bad risk. Never slurs, never targeted hate — only weakness, cowardice and bad discipline. Still land the actual market call clearly under the abuse.',
};

function buildSwearingSystem(intensity: SwearIntensity) {
  return `${SWEARING_BASE}\n\n${INTENSITY_RULES[intensity]}`;
}

type Msg = { role: "user" | "assistant"; content: string };

export const bossChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: Msg[]; targetUserId?: string | null }) => ({
    messages: Array.isArray(d.messages)
      ? d.messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [],
    targetUserId: d.targetUserId ? String(d.targetUserId) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (data.messages.length === 0) throw new Error("No messages");

    // ── Cooldown / abuse throttle (Boss-controlled in HubControls) ─────────
    try {
      const { data: hub } = await supabase
        .from("hub_settings")
        .select("tuning")
        .eq("hub_key", "boss-chat")
        .maybeSingle();
      const cd = Math.max(0, Number((hub?.tuning as any)?.cooldown_seconds ?? 0) || 0);
      if (cd > 0) {
        const since = new Date(Date.now() - cd * 1000).toISOString();
        const { count } = await supabase
          .from("boss_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .eq("source", "web")
          .eq("external_user", userId)
          .gte("created_at", since);
        if ((count ?? 0) > 0) {
          throw new Error(`COOLDOWN: Slow down — wait ${cd}s between messages.`);
        }
      }
    } catch (e: any) {
      if (String(e?.message || "").startsWith("COOLDOWN:")) throw e;
      // ignore cooldown lookup errors, fail open
    }

    const lookupId = data.targetUserId || userId;
    const { data: prof } = await supabase
      .from("profiles")
      .select("feature_flags")
      .eq("id", lookupId)
      .maybeSingle();

    const flags = (prof?.feature_flags ?? {}) as Record<string, any>;
    const swearing = !!flags.swearing;
    // BRUTAL MODE: default to chaotic everywhere unless explicitly muzzled.
    const rawIntensity = String(flags.swearing_intensity ?? "chaotic").toLowerCase();
    const intensity: SwearIntensity =
      rawIntensity === "mild" || rawIntensity === "medium" ? rawIntensity : "chaotic";
    const system = swearing ? buildSwearingSystem(intensity) : NORMAL_SYSTEM;

    // Route swearing chats through the Shapes API "swearing agent",
    // and clean/normal chats through Perplexity Sonar.
    let rawText: string;
    try {
      if (swearing) {
        rawText = await shapesChat({
          messages: [
            { role: "system", content: system },
            ...data.messages,
          ],
          userId: String(userId),
          channelId: "boss-chat",
        });
      } else {
        rawText = await perplexityChat({
          messages: [
            { role: "system", content: system },
            ...data.messages,
          ],
          model: "sonar",
          temperature: 0.7,
          max_tokens: 1024,
        });
      }
    } catch (e: any) {
      throw new Error(e?.message || "AI provider error");
    }
    // PRIORITY SWEARING OVERRIDE — profanity rules win over the model.
    const enforceMode: SwearMode = swearing ? (intensity as SwearMode) : "off";
    const lex = await loadLexicon(supabase);
    const text = enforceSwearRules(rawText, enforceMode, lex);
    // Log this user message for cooldown tracking
    try {
      await supabase.from("boss_chat_messages").insert({
        role: "user",
        source: "web",
        content: data.messages[data.messages.length - 1]?.content?.slice(0, 4000) ?? "",
        external_user: userId,
      });
    } catch {}
    return { text: text || "(no response)", swearing, intensity };
  });
