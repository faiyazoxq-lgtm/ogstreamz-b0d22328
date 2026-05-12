import { createServerFn } from "@tanstack/react-start";

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

export const siteGuideChat = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Msg[]; chaos?: boolean }) => ({
    messages: (Array.isArray(d?.messages) ? d.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) })),
    chaos: !!d?.chaos,
  }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway not configured");
    if (data.messages.length === 0) throw new Error("Say something");

    const system = data.chaos ? `${SYS_BASE}${CHAOS_LAYER}` : SYS_BASE;

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
    return { reply };
  });