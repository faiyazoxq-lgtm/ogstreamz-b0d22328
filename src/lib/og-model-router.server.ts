// Server-only OG Bot model router.
//
// Decides which model + which pipeline to run based on:
//   - mode ("normal" vs "og") from the user's chat-side toggle
//   - the OG-Bot global toggle (`enabled` from hub_settings og-bot row)
//   - the user's query intent (chat / code / image / music / video / research)
//
// Normal mode = Gemini Hub: default to gemini-3-flash-preview for speed.
// OG mode    = Research & Creative Powerhouse: classify intent, then
//              route to Perplexity → Gemini-Pro/GPT-5.5 chain (chat/research),
//              or to a media tool (image/music/video).

export type OgMode = "normal" | "og";
export type Intent = "chat" | "code" | "research" | "image" | "music" | "video";

const MODEL_NORMAL = "google/gemini-3-flash-preview";
const MODEL_OG_GENERAL = "google/gemini-3.1-pro-preview";
const MODEL_OG_REASONING = "openai/gpt-5.5";
const MODEL_OG_CLAUDE = "anthropic/claude-sonnet-4-5";

/** Lightweight regex-based intent classifier. Cheap, deterministic, no extra LLM hop. */
export function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();

  // Media intents — match phrasing, not just keywords, so the word "image" in
  // "what's in this image?" doesn't trigger generation.
  if (
    /\b(make|create|generate|draw|render|design|sketch|paint)\b[^.?!]*\b(image|picture|photo|poster|logo|artwork|illustration|graphic|cover)\b/.test(q) ||
    /\b(image|picture|photo|poster|logo|artwork|illustration) of\b/.test(q)
  ) return "image";

  if (
    /\b(make|create|generate|compose|write|produce)\b[^.?!]*\b(song|track|tune|beat|melody|jingle|music|instrumental|lyric)\b/.test(q) ||
    /\b(song|track|tune|beat|melody|jingle) about\b/.test(q)
  ) return "music";

  if (
    /\b(make|create|generate|render|produce|shoot)\b[^.?!]*\b(video|clip|trailer|reel|movie|animation|short)\b/.test(q) ||
    /\b(video|clip|trailer|reel) of\b/.test(q)
  ) return "video";

  // Code-heavy reasoning — route OG synthesis to GPT-5.5
  if (
    /\b(code|function|bug|error|stack ?trace|typescript|javascript|python|rust|sql|regex|algorithm|leetcode|refactor|implement|debug)\b/.test(q)
  ) return "code";

  // Research-leaning — Perplexity grounding helps most here. The OG-mode
  // pipeline always runs research, so this just biases the synthesis model.
  if (
    /\b(latest|recent|today|news|price|stat|stats|compare|vs\.?|review|cite|source|study|research|paper|happened|happening)\b/.test(q)
  ) return "research";

  return "chat";
}

/** Pick the model used by the OG-Bot draft engine (tool-calling form-filler). */
export function pickDraftModel(mode: OgMode, enabled: boolean, query?: string): string {
  if (!enabled || mode === "normal") return MODEL_NORMAL;
  const intent = query ? classifyIntent(query) : "chat";
  return intent === "code" ? MODEL_OG_REASONING : MODEL_OG_GENERAL;
}

/** Pick the synthesis model for the streaming chat surface in OG mode. */
export function pickSynthesisModel(intent: Intent): string {
  // Claude takes the hard reasoning lanes when ANTHROPIC_API_KEY is wired —
  // super-intelligence mode: Perplexity research → Claude synth.
  if (process.env.ANTHROPIC_API_KEY && (intent === "code" || intent === "research")) {
    return MODEL_OG_CLAUDE;
  }
  if (intent === "code") return MODEL_OG_REASONING;
  return MODEL_OG_GENERAL;
}

export const OG_MODELS = {
  normal: MODEL_NORMAL,
  ogGeneral: MODEL_OG_GENERAL,
  ogReasoning: MODEL_OG_REASONING,
  ogClaude: MODEL_OG_CLAUDE,
} as const;