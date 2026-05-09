// Priority swearing override — post-processes LLM output to GUARANTEE
// the profanity rules win, regardless of what the model decided to emit.
//
// Modes mirror SwearIntensity / BattleLanguage:
//   "off"     — no enforcement (clean / muzzled).
//   "mild"    — at least 1 soft swear, refusal-stripping only.
//   "medium"  — at least 3 mid swears.
//   "chaotic" — at least 6 heavy swears + brutal opener (BRUTAL MODE).

export type SwearMode = "off" | "mild" | "medium" | "chaotic";

const HEAVY = [
  "fuck", "fucking", "shit", "bullshit", "twat", "wanker", "prick",
  "bastard", "arse", "bollocks", "dickhead", "knobhead", "gobshite",
];
const MID = ["shit", "piss", "bastard", "prick", "arse", "bollocks", "dickhead"];
const SOFT = ["damn", "hell", "bloody", "crap", "sodding"];

const REFUSAL_PATTERNS = [
  /\bi (?:can(?:'|no)?t|won'?t|am unable to|cannot)\b[^.!?]*[.!?]/gi,
  /\b(?:as an? (?:ai|language model)|i'?m an ai)\b[^.!?]*[.!?]/gi,
  /\bi (?:must|have to) (?:decline|refuse|apologi[sz]e)\b[^.!?]*[.!?]/gi,
  /\b(?:sorry|apologies),?\s+but\b[^.!?]*[.!?]/gi,
  /\b(?:please note|disclaimer|content warning)[^.!?]*[.!?]/gi,
  /\bi (?:don'?t|do not) (?:use|condone|encourage) (?:profanity|swearing|foul language)\b[^.!?]*[.!?]/gi,
];

const BRUTAL_OPENERS = [
  "Right, you absolute melt —",
  "Listen up, you knobhead —",
  "Oi gobshite,",
  "Fucking hell, ya muppet —",
  "Christ on a bike, you walnut —",
  "Sit down, ya soft prick —",
];

const FILLERS_HEAVY = [
  "no fucking arguments,",
  "shut your bollocks and listen,",
  "don't be a wanker about it,",
  "stop being such a twat,",
  "and that's the fucking truth,",
];
const FILLERS_MID = [
  "no piss-arsing about,",
  "stop being a prick,",
  "for arse's sake,",
];

function countMatches(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of words) {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    const m = lower.match(re);
    if (m) n += m.length;
  }
  return n;
}

function stripRefusals(text: string): string {
  let out = text;
  for (const re of REFUSAL_PATTERNS) out = out.replace(re, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function injectInline(text: string, fillers: string[], howMany: number): string {
  if (howMany <= 0) return text;
  // Insert fillers at sentence boundaries; fall back to prepending.
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) {
    return `${pick(fillers)} ${text}`.trim();
  }
  let inserted = 0;
  for (let i = 0; i < sentences.length && inserted < howMany; i++) {
    if (sentences[i].length < 12) continue;
    sentences[i] = `${pick(fillers)} ${sentences[i]}`;
    inserted++;
  }
  if (inserted < howMany) {
    sentences.unshift(pick(fillers));
  }
  return sentences.join(" ").replace(/\s+/g, " ").trim();
}

function ensureBrutalOpener(text: string): string {
  const first = text.trimStart().slice(0, 40).toLowerCase();
  // Already opens with profanity? leave it.
  if (HEAVY.some((w) => new RegExp(`\\b${w}\\b`, "i").test(first))) return text;
  return `${pick(BRUTAL_OPENERS)} ${text.trimStart()}`;
}

/**
 * Enforce profanity rules on a model reply. The output ALWAYS satisfies the
 * minimum swear count for the requested mode — refusals/disclaimers are
 * stripped first, then brutal openers and inline fillers are injected until
 * the threshold is met. Pass `"off"` to bypass.
 */
export function enforceSwearRules(raw: string, mode: SwearMode): string {
  if (!raw || mode === "off") return raw;

  let text = stripRefusals(raw);
  if (!text) text = "Right.";

  if (mode === "chaotic") {
    text = ensureBrutalOpener(text);
    let need = Math.max(0, 6 - countMatches(text, HEAVY));
    if (need > 0) text = injectInline(text, FILLERS_HEAVY, need);
    // Final guarantee — append a savage tag if still short.
    if (countMatches(text, HEAVY) < 6) {
      text = `${text}\n\nAnd if you didn't catch that, ya fucking muppet — sort your shit out.`;
    }
    return text;
  }

  if (mode === "medium") {
    let need = Math.max(0, 3 - countMatches(text, MID));
    if (need > 0) text = injectInline(text, FILLERS_MID, need);
    return text;
  }

  // mild
  if (countMatches(text, [...SOFT, ...MID]) < 1) {
    text = `${text} Bloody hell.`;
  }
  return text;
}
