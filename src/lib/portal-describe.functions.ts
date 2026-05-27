import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { callClaude } from "@/lib/claude.server";

type Kind = "jokes" | "music" | "trade" | "connect" | "tools";

async function isAdminOrBoss(supabase: any, userId: string): Promise<boolean> {
  const [{ data: roleRow }, { data: bossRow }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabase.rpc("is_boss", { _uid: userId }),
  ]);
  return !!roleRow || !!bossRow;
}

const KIND_BRIEF: Record<Kind, string> = {
  jokes: "an AI jokes portal — a themed page that hosts 5 freshly-generated short comedy bits in a specific style/voice",
  music: "a music landing portal — a themed page promoting a sound, artist or release with mood-driven visuals",
  trade: "a trade scout portal — a themed dashboard tracking an asset, sector or market angle",
  connect: "an outbound connect portal — a themed landing page targeting a specific ICP with a single offer",
  tools: "a tools portal — a themed wrapper around a small calculator or utility for a specific audience",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Single-shot Lovable AI Gateway call. Returns "" on failure (council degrades gracefully). */
async function gatewayOnce(
  model: string,
  system: string,
  user: string,
  maxTokens = 600,
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (json.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}

export const describePortal = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { kind: Kind; name?: string; niche?: string; vibe?: string; language?: string }) => ({
    kind: (["jokes", "music", "trade", "connect", "tools"].includes(data.kind) ? data.kind : "jokes") as Kind,
    name: String(data.name ?? "").trim().slice(0, 80),
    niche: String(data.niche ?? "").trim().slice(0, 400),
    vibe: String(data.vibe ?? "").trim().slice(0, 200),
    language: String(data.language ?? "English").trim().slice(0, 40) || "English",
  }))
  .handler(async ({ data, context }): Promise<{ description: string }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdminOrBoss(supabase, userId))) {
      throw new Response("Admin only", { status: 403 });
    }
    const seed = [data.name && `Name: ${data.name}`, data.niche && `Keywords: ${data.niche}`, data.vibe && `Vibe: ${data.vibe}`]
      .filter(Boolean)
      .join("\n");
    if (!seed) throw new Error("Add a portal name or some keywords first");

    const target = KIND_BRIEF[data.kind];
    const finalSpec =
      `Write 2-3 tight sentences (max 380 chars) in ${data.language}. ` +
      `Be specific about audience, tone and visual mood. No headings, no quotes, no markdown, no emoji.`;

    // ───────── AGENT COUNCIL ─────────
    // Goal: produce the BEST possible final brief by first engineering the
    // optimal generation prompt, then having multiple agents critique it,
    // and finally letting Claude execute the consensus prompt.

    // Agent 1 — Gemini Pro: prompt engineer. Turns the user's raw seed into
    // a structured, vivid generation prompt tuned for ${target}.
    const draftPrompt =
      (await gatewayOnce(
        "google/gemini-3.1-pro-preview",
        `You are a senior PROMPT ENGINEER. Your job is to take a user's rough seed for ${target} ` +
          `and rewrite it as the optimal one-shot generation prompt for a downstream writer model. ` +
          `Output ONLY the prompt itself — no preamble, no quotes, no markdown. ` +
          `The prompt must explicitly tell the writer to: ${finalSpec} ` +
          `It must lock in audience, tone, visual mood, and any concrete hooks implied by the seed. ` +
          `Keep it under 220 words.`,
        `USER SEED (${data.kind} portal):\n${seed}`,
        400,
      )) || `Expand this seed into ${finalSpec}\n\nSEED:\n${seed}`;

    // Agent 2 — GPT-5: critic. Reviews the engineered prompt against the
    // user's original vision and returns a SHARPENED final prompt.
    const refinedPrompt =
      (await gatewayOnce(
        "openai/gpt-5",
        `You are a ruthless EDITOR reviewing a generation prompt before it ships to the writer. ` +
          `Check: does it honour the user's vision, lock in specifics (audience, tone, mood), and instruct the writer correctly? ` +
          `Return ONLY the final, sharpened prompt — no commentary, no quotes, no markdown. ` +
          `It must still instruct the writer to: ${finalSpec}`,
        `USER VISION (raw seed for ${target}):\n${seed}\n\n---\n\nCANDIDATE PROMPT:\n${draftPrompt}`,
        500,
      )) || draftPrompt;

    // Agent 3 — Claude Sonnet 4.5: executor. Writes the actual brief using
    // the council-approved prompt via the same authenticated helper that
    // backs askClaude.
    const claude = await callClaude({
      prompt: refinedPrompt,
      system:
        `You are the WRITER. Follow the prompt exactly. ${finalSpec} ` +
        `Respond with the brief and nothing else.`,
      model: "claude-sonnet-4-5",
      maxTokens: 400,
    });
    if (claude.ok && claude.text) {
      return { description: claude.text.slice(0, 400) };
    }

    // Fallback — Claude unavailable: let Gemini write the brief directly
    // using the refined prompt so the wizard still completes.
    const fallback = await gatewayOnce(
      "google/gemini-3-flash-preview",
      `You are the WRITER. ${finalSpec}`,
      refinedPrompt,
      400,
    );
    if (!fallback) throw new Error(claude.ok ? "AI returned no description" : claude.error);
    return { description: fallback.slice(0, 400) };
  });