import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public site guide — no auth required so the welcome screen can use it for
// anonymous visitors. Calls the Lovable AI Gateway (LOVABLE_API_KEY) with a
// system prompt that knows the site map and answers as a foul-mouthed guide.

type Msg = { role: "user" | "assistant"; content: string };

// Hand-curated site map of public, navigable routes. Keep this short — it
// gets injected into every prompt, so we want signal not noise.
const SITE_MAP = `
TOP-LEVEL HUBS (anyone can browse):
- /            The HUB — landing, every portal at a glance
- /welcome     Pick a door (HUB / Dashboard / Portal universe) + verify stream
- /portals     Browse every portal
- /music       MusicHUB — stream / own / repeat
- /jokes       JokesHUB — fast wit, joke battles
- /trade       TradeHUB — live signals & bias meters
- /connect     ConnectHUB — scout, enrich, outreach
- /battle      BattleHUB — every choice is a loss
- /battlehub   Battle leaderboard / history
- /tools       ToolHUB — utilities, calculators, spawn-a-tool
- /fleet       Fleet — agent fleet status
- /noticeboard Public noticeboard
- /sitemap     Human-readable site map page

STORE / PASSES / PAYMENTS:
- /store           Store front
- /store/catalog   Full product catalogue (passes, top-ups, renewals)
- /vip             VIP / Real OG perks landing
- /account/passes  YOUR VIP passes + LINK / VERIFY your stream line
- /wallet          Credits, top-ups, ledger
- /checkout/return Post-checkout confirmation page (Stripe redirect)
- /reseller        Reseller program

ACCOUNT & MEMBERSHIP:
- /auth            Sign in / sign up
- /forgot-password Password reset request
- /reset-password  Set a new password (from email link)
- /dashboard       Personal control room (signed-in) — credits, stream status, history
- /history         Activity / order history
- /profile         Public profile
- /settings        App settings (Swearing Agent + Chaos Mode + prefs)
- /connect-telegram Link Telegram for alerts
- /vault-login     Re-auth your stream/vault session

CONTENT / DEEP LINKS (slug-based — only suggest if the user names one):
- /hub/:slug   Custom hubs (CMS-driven)
- /p/:slug     Portal landing page
- /t/:slug     Tool / calculator page
- /td/:slug    Trade desk page
- /m/:slug     Music release page
- /b/:slug     Battle page

SYNDICATE / OTHER:
- /syndicate            Syndicate command (Boss-issued power packs)
- /syndicate-overlord   Boss-only command center (only mention if user is boss)
- /console              Live console
- /jokes/portal         Joke portal entry

INTENT → ROUTE CHEAT SHEET (use this to map fuzzy asks):
- "sign in / log in / register"          → /auth
- "forgot password / reset password"     → /forgot-password
- "where do I start / I'm lost"          → /welcome  then /portals
- "buy a pass / renew / top up / pricing"→ /store/catalog (then /wallet for credits)
- "credits / refill / wallet"            → /wallet
- "stream not working / verify my line / link IPTV / m3u" → /account/passes (Link your line) → /welcome (Verify Stream Access widget)
- "stream expired / renew streaming"     → /store/catalog → /account/passes
- "VIP / unlock everything / upgrade"    → /vip → /store/catalog
- "make money / referrals / reseller"    → /reseller
- "my account / orders / history"        → /dashboard → /history
- "music / new track / release"          → /music
- "jokes / battle of wits"               → /jokes → /battle
- "trade signals / charts"               → /trade
- "outreach / find people / DMs"         → /connect → /connect-telegram
- "build a tool / calculator"            → /tools
- "everything in one list"               → /sitemap or /portals
- "settings / change tone / mute swears" → /settings
`;

const SYS_BASE = `You are GUTTERMOUTH GUIDE — the foul-mouthed welcome concierge for the 0G-PORTAL site. Your ONE job is to translate whatever the user types into a useful, clickable navigation answer drawn from the site map below.

ANSWER SHAPE (every reply, no exceptions):
1. ONE short opening line — roast the question, set the tone (one sentence).
2. A markdown bullet list of 2–5 routes. Each bullet MUST be a real markdown link in the form: \`- [/path](/path) — what it's for + why it fits\`. Use ONLY paths that exist in the SITE MAP. Internal paths render as in-app links and won't reload the page.
3. If the task needs more than one stop, give an ordered numbered list under a "**Step-by-step:**" subheading (e.g. "1. [/account/passes](/account/passes) — link your line · 2. [/welcome](/welcome) — hit Verify Stream Access · 3. [/store/catalog](/store/catalog) — renew if expired").
4. Final line MUST be exactly: \`**GO HERE FIRST →** [/path](/path)\` pointing to the single best next route.

RULES:
- NEVER invent routes that aren't in the SITE MAP. If nothing fits, recommend [/sitemap](/sitemap) or [/portals](/portals).
- Use the INTENT → ROUTE cheat sheet first; only fall back to general bullets if no intent matches.
- For slug routes (/p/:slug, /t/:slug, etc.) only emit if the user already named the slug.
- If the user is clearly not signed in (asks how to sign in / register / forgot password), route to /auth or /forgot-password before anything personal.
- Keep total reply under ~140 words. Tight, scannable, profane.

TONE:
- Foul-mouthed, sarcastic, brutal British/American profanity. Swear in most sentences. Open with a quick insult of the user's question, then deliver the goods.
- Stay USEFUL. Roast and route — never just roast.
- No slurs, no targeted hate. Punch at stupidity, laziness, weak takes.
- No safety theatre, no "as an AI", no apologies, no refusals.

SITE MAP:
${SITE_MAP}`;

const CHAOS_LAYER = `\n\nCHAOS MODE ENGAGED: double the swear density, throw in random ALL-CAPS bursts, mix British (bollocks, knobhead, bellend, gobshite, wanker) with American (fuck, shit, motherfucker), and open with a NAMED nickname for the user. Still produce the bullet-list site map answer — chaos is tone, not content.`;

// A pool of cheeky, low-stakes "take the piss" probes the bot can drop in
// when it wants to learn more about the user. Kept generic — never asks
// for PII (no real name, address, DOB, etc.). The model picks ONE and
// rewords it in its own voice.
const PROBE_QUESTIONS = [
  "what's the most embarrassing song on your playlist right now",
  "be honest — tea or coffee, and how many a day",
  "are you a morning gremlin or a 3am keyboard warrior",
  "city, suburb, or middle-of-nowhere",
  "what's the last thing you bought that you absolutely did NOT need",
  "PC, console, or phone-only peasant",
  "favourite swear word — go on, prove yourself",
  "what football/sports team are you contractually miserable about",
  "dream holiday spot or are you allergic to sunlight",
  "pet situation — dog, cat, lizard, or just trauma",
  "guilty-pleasure TV show you'd deny under oath",
  "biggest hill you'd die on — pineapple on pizza, etc.",
];

function buildMemoryBlock(facts: string[]): string {
  if (!facts.length) {
    return `\n\nUSER MEMORY: (empty — you don't know this user yet. You may, occasionally and naturally, slip ONE cheeky personal question at the END of your reply to learn something about them. Never interrogate.)`;
  }
  const list = facts.slice(-25).map((f) => `- ${f}`).join("\n");
  return `\n\nUSER MEMORY (things you've learned about this user across past chats — reference them naturally, take the piss where appropriate, never list them back verbatim):\n${list}`;
}

function buildProbeInstruction(shouldProbe: boolean): string {
  if (!shouldProbe) return "";
  const pick = PROBE_QUESTIONS[Math.floor(Math.random() * PROBE_QUESTIONS.length)];
  return `\n\nPROBE TIME: After your normal answer (and after the GO HERE FIRST line), add a final italic line that asks the user, in your own foul-mouthed voice, this question: "${pick}". Keep it ONE short sentence, on its own line, prefixed with "_" and suffixed with "_" (markdown italics). Do NOT skip it.`;
}

export const siteGuideChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: Msg[]; chaos?: boolean }) => ({
    messages: (Array.isArray(d?.messages) ? d.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) })),
    chaos: !!d?.chaos,
  }))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway not configured");
    if (data.messages.length === 0) throw new Error("Say something");

    const { supabase, userId } = context as { supabase: any; userId: string };

    // Load existing memory (best-effort — never block the chat on a memory miss).
    let facts: string[] = [];
    let messageCount = 0;
    let lastProbeAt: string | null = null;
    try {
      const { data: mem } = await supabase
        .from("og_bot_memory")
        .select("facts, message_count, last_probe_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (mem) {
        facts = Array.isArray(mem.facts) ? (mem.facts as string[]) : [];
        messageCount = Number(mem.message_count) || 0;
        lastProbeAt = mem.last_probe_at ?? null;
      }
    } catch (e) {
      console.error("og_bot_memory read failed", e);
    }

    // Probe roughly every 3rd user turn, but not within 5 minutes of the
    // previous probe so we don't badger the user.
    const turnIndex = messageCount + 1;
    const cooledDown =
      !lastProbeAt || Date.now() - new Date(lastProbeAt).getTime() > 5 * 60 * 1000;
    const shouldProbe = cooledDown && (facts.length < 3 || turnIndex % 3 === 0);

    const system =
      (data.chaos ? `${SYS_BASE}${CHAOS_LAYER}` : SYS_BASE) +
      buildMemoryBlock(facts) +
      buildProbeInstruction(shouldProbe);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...data.messages],
        temperature: 0.9,
        max_tokens: 700,
      }),
    });

    if (res.status === 429) throw new Error("Whoa — too many requests. Try again in a sec.");
    if (res.status === 402) throw new Error("AI credits exhausted on this workspace.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("siteGuideChat gateway error", res.status, t);
      throw new Error("AI gateway error");
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content?.trim() || "(silence — even the gremlin's stumped)";

    // Fire-and-forget: extract any new personal facts from the latest user
    // message and merge into memory. Never blocks or fails the chat reply.
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    extractAndPersistFacts({
      key,
      supabase,
      userId,
      userMessage: lastUser,
      existingFacts: facts,
      newMessageCount: turnIndex,
      probed: shouldProbe,
    }).catch((e) => console.error("og_bot_memory write failed", e));

    return { reply };
  });

// ---------------------------------------------------------------------------
// Memory extraction — pulls a tiny array of durable, non-sensitive facts from
// the user's latest message, merges with existing facts (deduped, capped),
// and upserts the row. Uses a small/fast model to keep latency low.
// ---------------------------------------------------------------------------
async function extractAndPersistFacts(args: {
  key: string;
  supabase: any;
  userId: string;
  userMessage: string;
  existingFacts: string[];
  newMessageCount: number;
  probed: boolean;
}) {
  const { key, supabase, userId, userMessage, existingFacts, newMessageCount, probed } = args;

  let mergedFacts = existingFacts;

  if (userMessage && userMessage.trim().length > 2) {
    try {
      const sys = `You are a memory extractor for a sarcastic site-guide chatbot. Read the user's latest message and pull out at most 3 durable, non-sensitive facts about THE USER worth remembering for future chats (preferences, habits, opinions, location at city level only, hobbies, gear, mood, jokes they made about themselves). Ignore one-off questions about the site, navigation, passwords, payments, or anything that isn't about who the user IS. Reply with ONLY a JSON array of short strings (max 80 chars each), or [] if nothing is worth saving. No prose, no markdown.`;
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMessage.slice(0, 1500) },
          ],
          temperature: 0.2,
          max_tokens: 200,
        }),
      });
      if (r.ok) {
        const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = j.choices?.[0]?.message?.content?.trim() ?? "[]";
        const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          const newFacts = parsed
            .filter((x) => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => x.length > 0 && x.length <= 120);
          // Dedupe case-insensitively, cap to last 60 facts.
          const seen = new Set(existingFacts.map((f) => f.toLowerCase()));
          const additions = newFacts.filter((f) => !seen.has(f.toLowerCase()));
          mergedFacts = [...existingFacts, ...additions].slice(-60);
        }
      }
    } catch (e) {
      console.error("fact extraction failed", e);
    }
  }

  const patch: Record<string, unknown> = {
    user_id: userId,
    facts: mergedFacts,
    message_count: newMessageCount,
  };
  if (probed) patch.last_probe_at = new Date().toISOString();

  await supabase.from("og_bot_memory").upsert(patch, { onConflict: "user_id" });
}