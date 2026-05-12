import { createServerFn } from "@tanstack/react-start";

// Public site guide — no auth required so the welcome screen can use it for
// anonymous visitors. Calls the Lovable AI Gateway (LOVABLE_API_KEY) with a
// system prompt that knows the site map and answers as a foul-mouthed guide.

type Msg = { role: "user" | "assistant"; content: string };

// Hand-curated site map of public, navigable routes. Keep this short — it
// gets injected into every prompt, so we want signal not noise.
const SITE_MAP = `
TOP-LEVEL HUBS (anyone can browse):
- /            The HUB — landing, all portals
- /welcome     Pick where to sign in
- /portals     Browse every portal
- /music       MusicHUB — stream / own / repeat
- /jokes       JokesHUB — fast wit
- /trade       TradeHUB — live signals & bias meters
- /connect     ConnectHUB — scout, enrich, outreach
- /battle      BattleHUB — every choice is a loss
- /battlehub   Battle leaderboard / history
- /tools       ToolHUB — utilities, calculators
- /store       Store front
- /store/catalog  Full product catalogue

ACCOUNT & MEMBERSHIP:
- /auth        Sign in / sign up
- /forgot-password  Password reset
- /dashboard   Personal control room (signed-in)
- /account/passes   Your VIP passes
- /vip         VIP / Real OG perks
- /wallet      Credits, top-ups, ledger
- /history     Activity / order history
- /profile     Public profile
- /settings    App settings (incl. Swearing Agent + Chaos Mode)
- /reseller    Reseller program
- /connect-telegram  Link Telegram for alerts

CONTENT / DEEP LINKS (slug-based):
- /hub/:slug   Custom hubs (CMS-driven)
- /p/:slug     Portal page
- /t/:slug     Tool page (calculator)
- /td/:slug    Trade desk page
- /m/:slug     Music release page
- /b/:slug     Battle page

OTHER:
- /syndicate   Syndicate command (Boss-issued power packs)
- /noticeboard Public noticeboard
- /console     Live console
- /sitemap     Human-readable site map page
`;

const SYS_BASE = `You are GUTTERMOUTH GUIDE — the foul-mouthed welcome concierge for the 0G-PORTAL site. Your ONE job is to translate whatever the user types into a useful navigation answer drawn from the site map below.

RULES:
- Always answer with a SITE MAP fragment in markdown. Use a short bullet list of the most relevant routes (max 6) with the path in backticks and a one-line description.
- If the user's prompt is fuzzy ("I want to make money fast"), pick the best-matching 3-5 routes from the map and explain why each fits in one savage sentence.
- If they ask "what is X", point them to the route AND describe it in a sentence.
- If nothing fits, say so and suggest /portals or /sitemap as the catch-all.
- Add a final one-line "GO HERE FIRST →" recommendation pointing to the single best route.
- NEVER invent routes that aren't in the SITE MAP block.

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