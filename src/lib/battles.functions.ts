import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BattleLanguage = "clean" | "mild" | "medium" | "chaotic";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "battle"
  );
}

async function isBoss(supabase: any, userId: string): Promise<boolean> {
  const [{ data: prof }, { data: role }] = await Promise.all([
    supabase.from("profiles").select("rank").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  return prof?.rank === "boss" || !!role;
}

async function fetchPerplexityResearch(scenario: string, themes: string[]): Promise<any> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { skipped: true };
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "Return a SHORT factual brief (4-6 bullet points, max 600 chars total) of recent real-world context, slang, memes, or absurd news that would make a darkly-comedic 'every choice is bad' multiple-choice game more believable and savage. No markdown headers.",
          },
          {
            role: "user",
            content: `Scenario: ${scenario}\nThemes: ${themes.join(", ") || "general"}\nReturn just the bullet brief.`,
          },
        ],
      }),
    });
    if (!r.ok) return { error: `perplexity ${r.status}` };
    const j = await r.json();
    return { brief: j?.choices?.[0]?.message?.content ?? "" };
  } catch (e: any) {
    return { error: String(e?.message ?? e) };
  }
}

export const spawnBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string;
    scenario: string;
    language?: BattleLanguage;
    themes?: string[];
    custom_prompt?: string;
    accent?: string;
    emoji?: string;
    tagline?: string;
    public?: boolean;
    use_research?: boolean;
  }) => ({
    name: String(d.name || "").trim().slice(0, 80),
    scenario: String(d.scenario || "").trim().slice(0, 1500),
    language: (["clean", "mild", "medium", "chaotic"] as BattleLanguage[]).includes(d.language as any)
      ? (d.language as BattleLanguage)
      : "medium",
    themes: Array.isArray(d.themes) ? d.themes.map((t) => String(t).slice(0, 40)).slice(0, 8) : [],
    custom_prompt: String(d.custom_prompt || "").trim().slice(0, 1000),
    accent: String(d.accent || "#ff2e55").slice(0, 16),
    emoji: String(d.emoji || "💀").slice(0, 4),
    tagline: String(d.tagline || "EVERY CHOICE IS A LOSS").slice(0, 60),
    public: d.public !== false,
    use_research: d.use_research !== false,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isBoss(supabase, userId))) throw new Error("Boss / admin only");
    if (!data.name || !data.scenario) throw new Error("Name and scenario required");

    const research = data.use_research ? await fetchPerplexityResearch(data.scenario, data.themes) : { skipped: true };

    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    const { data: existing } = await supabase.from("battles").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;

    const { data: row, error } = await supabase
      .from("battles")
      .insert({
        slug,
        name: data.name,
        scenario: data.scenario,
        language: data.language,
        themes: data.themes,
        custom_prompt: data.custom_prompt,
        accent: data.accent,
        emoji: data.emoji,
        tagline: data.tagline,
        public: data.public,
        research,
        created_by: userId,
      })
      .select("id, slug, name")
      .single();
    if (error) throw new Error(error.message);
    return { battle: row, slug };
  });

const LANG_RULES: Record<BattleLanguage, string> = {
  clean: "PG. Zero swearing. Punchy snark only. Use 'mate', 'goofball', 'absolute walnut'.",
  mild: "PG-13. Soft swears OK ('damn', 'hell', 'bloody', 'crap'). 1-2 max per text.",
  medium: "Adult. Mid swears OK ('shit', 'piss', 'bastard', 'prick', 'arse'). 2-4 per text.",
  chaotic: "Unhinged adult. Heavy swears OK ('fuck', 'fucking', 'bullshit', 'twat', 'wanker'). Brutal roast tone.",
};

export const playBattleRound = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; session_id: string; round?: number; previous?: { situation: string; pickedText: string; outcome: string } | null }) => ({
    slug: String(d.slug || "").trim().slice(0, 80),
    session_id: String(d.session_id || "").trim().slice(0, 80) || crypto.randomUUID(),
    round: Math.min(20, Math.max(1, Number(d.round || 1))),
    previous: d.previous ?? null,
  }))
  .handler(async ({ data }) => {
    const LOVABLE = process.env.LOVABLE_API_KEY;
    if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");

    // Use admin client (public route, no auth required) — read battle config
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: battle, error } = await supabase
      .from("battles")
      .select("id, slug, name, scenario, language, themes, custom_prompt, research, public")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!battle) throw new Error("Battle not found");
    if (!battle.public) throw new Error("Battle is private");

    const lang = (battle.language as BattleLanguage) ?? "medium";
    const research = (battle.research as any)?.brief ?? "";

    const system = `You are the OG-STREAMZ BattleHUB Game Master. You generate ONE round of a darkly-comedic multiple-choice game where EVERY option is bad — the player can only pick the least catastrophic disaster. ${LANG_RULES[lang]} ${battle.custom_prompt || ""}
THEMES: ${(battle.themes ?? []).join(", ") || "no specific themes"}
CONTEXT BRIEF (from research):
${research || "(none)"}
RULES:
- Provide a vivid 1-2 sentence "situation" continuing the scenario.
- Provide EXACTLY 4 choices. Every choice MUST be a bad outcome.
- Each choice has: "text" (what the player picks, <90 chars), "consequence" (the savage 1-2 sentence outcome), "badness" (1=mild trainwreck, 5=apocalyptic).
- No safe / good options. No moralising. Stay in character.`;

    const userMsg = data.previous
      ? `SCENARIO: ${battle.scenario}\nROUND ${data.round}.\nPrevious situation: ${data.previous.situation}\nPlayer picked: ${data.previous.pickedText}\nWhat happened: ${data.previous.outcome}\nGenerate the NEXT round (escalate the disaster).`
      : `SCENARIO: ${battle.scenario}\nROUND 1. Open the game.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "render_round",
              description: "Render one round of the battle game",
              parameters: {
                type: "object",
                properties: {
                  situation: { type: "string" },
                  choices: {
                    type: "array",
                    minItems: 4,
                    maxItems: 4,
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        consequence: { type: "string" },
                        badness: { type: "integer", minimum: 1, maximum: 5 },
                      },
                      required: ["text", "consequence", "badness"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["situation", "choices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "render_round" } },
      }),
    });
    if (r.status === 429) throw new Error("Rate limited — try again in a moment.");
    if (r.status === 402) throw new Error("AI credits exhausted — top up Lovable AI in Settings.");
    if (!r.ok) throw new Error(`AI gateway ${r.status}`);

    const j = await r.json();
    const call = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try { parsed = JSON.parse(call ?? "{}"); } catch { throw new Error("AI returned invalid round"); }
    if (!parsed.situation || !Array.isArray(parsed.choices) || parsed.choices.length !== 4) {
      throw new Error("AI returned malformed round");
    }

    // Log play row
    await supabase.from("battle_plays").insert({
      battle_id: battle.id,
      session_id: data.session_id,
      round: data.round,
      situation: parsed.situation,
      choices: parsed.choices,
    });

    // Bump view count on round 1
    if (data.round === 1) {
      try { await supabase.rpc("increment_portal_view", { _slug: battle.slug }); } catch { /* noop */ }
    }

    return {
      session_id: data.session_id,
      round: data.round,
      situation: parsed.situation as string,
      choices: parsed.choices as Array<{ text: string; consequence: string; badness: number }>,
    };
  });