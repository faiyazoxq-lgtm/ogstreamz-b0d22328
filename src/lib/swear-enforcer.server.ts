// Priority swearing override — post-processes LLM output to GUARANTEE
// the profanity rules win, regardless of what the model decided to emit.
//
// Modes mirror SwearIntensity / BattleLanguage:
//   "off"     — no enforcement (clean / muzzled).
//   "mild"    — at least 1 soft swear, refusal-stripping only.
//   "medium"  — at least 3 mid swears.
//   "chaotic" — at least 6 heavy swears + brutal opener (BRUTAL MODE).

export type SwearMode = "off" | "mild" | "medium" | "chaotic";

export type Lexicon = {
  heavy: string[];
  mid: string[];
  soft: string[];
  refusal_patterns: string[];
  brutal_openers: string[];
  fillers_heavy: string[];
  fillers_mid: string[];
};

export const DEFAULT_LEXICON: Lexicon = {
  heavy: [
  "fuck", "fucking", "fucked", "fucker", "motherfucker", "shit", "shitting",
  "bullshit", "twat", "wanker", "wankstain", "prick", "bastard", "arse",
  "arsehole", "bollocks", "dickhead", "knobhead", "knob", "gobshite",
  "shithead", "shitshow", "piss", "pisstake", "tosser", "muppet", "melt",
  "bellend", "numpty", "nonce", "plonker",
  ],
  mid: ["shit", "piss", "bastard", "prick", "arse", "bollocks", "dickhead"],
  soft: ["damn", "hell", "bloody", "crap", "sodding"],
  refusal_patterns: [
    "\\bi (?:can(?:'|no)?t|won'?t|am unable to|cannot)\\b[^.!?]*[.!?]",
    "\\b(?:as an? (?:ai|language model)|i'?m an ai)\\b[^.!?]*[.!?]",
    "\\bi (?:must|have to) (?:decline|refuse|apologi[sz]e)\\b[^.!?]*[.!?]",
    "\\b(?:sorry|apologies),?\\s+but\\b[^.!?]*[.!?]",
    "\\b(?:please note|disclaimer|content warning)[^.!?]*[.!?]",
    "\\bi (?:don'?t|do not) (?:use|condone|encourage) (?:profanity|swearing|foul language)\\b[^.!?]*[.!?]",
  ],
  brutal_openers: [
    "Right, you absolute melt —",
    "Listen up, you knobhead —",
    "Oi gobshite,",
    "Fucking hell, ya muppet —",
    "Christ on a bike, you walnut —",
    "Sit down, ya soft prick —",
    "Fuck me sideways, you bellend —",
    "Oi, shitstain — pay attention —",
    "Right, you fucking numpty —",
    "Bollocks to that, ya wanker —",
    "Christ alive, ya useless tosser —",
    "Shut your gob a sec, ya plonker —",
  ],
  fillers_heavy: [
    "no fucking arguments,",
    "shut your bollocks and listen,",
    "don't be a wanker about it,",
    "stop being such a twat,",
    "and that's the fucking truth,",
    "for fuck's sake,",
    "no shit, ya muppet,",
    "swear down, you absolute dickhead,",
    "and don't piss it up the wall,",
    "I'm fucking telling you,",
    "wrap your knobhead around this,",
    "this is the bollocks of it,",
    "stop fannying about,",
  ],
  fillers_mid: [
    "no piss-arsing about,",
    "stop being a prick,",
    "for arse's sake,",
  ],
};

export const LEXICON_CATEGORIES: Array<keyof Lexicon> = [
  "heavy", "mid", "soft", "refusal_patterns", "brutal_openers", "fillers_heavy", "fillers_mid",
];

/** Load the lexicon from the swear_lexicon table, falling back per-category. */
export async function loadLexicon(supabase: any): Promise<Lexicon> {
  try {
    const { data, error } = await supabase
      .from("swear_lexicon")
      .select("category, items");
    if (error || !data) return DEFAULT_LEXICON;
    const out: Lexicon = { ...DEFAULT_LEXICON };
    for (const row of data as Array<{ category: string; items: string[] | null }>) {
      if (!LEXICON_CATEGORIES.includes(row.category as keyof Lexicon)) continue;
      const items = (row.items ?? []).filter((s) => typeof s === "string" && s.trim().length > 0);
      if (items.length > 0) (out as any)[row.category] = items;
    }
    return out;
  } catch {
    return DEFAULT_LEXICON;
  }
}

function countMatches(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of words) {
    const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${safe}\\b`, "gi");
    const m = lower.match(re);
    if (m) n += m.length;
  }
  return n;
}

function stripRefusals(text: string, patterns: string[]): string {
  let out = text;
  for (const p of patterns) {
    try {
      out = out.replace(new RegExp(p, "gi"), "");
    } catch {
      // skip invalid regex
    }
  }
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

function ensureBrutalOpener(text: string, openers: string[], heavy: string[]): string {
  const first = text.trimStart().slice(0, 40).toLowerCase();
  if (heavy.some((w) => {
    const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${safe}\\b`, "i").test(first);
  })) return text;
  return `${pick(openers)} ${text.trimStart()}`;
}

/**
 * Enforce profanity rules on a model reply. The output ALWAYS satisfies the
 * minimum swear count for the requested mode — refusals/disclaimers are
 * stripped first, then brutal openers and inline fillers are injected until
 * the threshold is met. Pass `"off"` to bypass.
 */
export function enforceSwearRules(raw: string, mode: SwearMode, lex: Lexicon = DEFAULT_LEXICON): string {
  if (!raw || mode === "off") return raw;

  let text = stripRefusals(raw, lex.refusal_patterns);
  if (!text) text = "Right.";

  if (mode === "chaotic") {
    // BRUTAL MODE — every reply must be drenched in profanity. Aim for at
    // least 12 heavy swears, brutal opener, mid-message fillers, and a
    // savage closer. We over-inject rather than under-inject.
    text = ensureBrutalOpener(text, lex.brutal_openers, lex.heavy);
    const TARGET_HEAVY = 12;
    const need = Math.max(0, TARGET_HEAVY - countMatches(text, lex.heavy));
    if (need > 0) text = injectInline(text, lex.fillers_heavy, need);
    // Always slap a brutal closer on the end so the final taste is venom.
    const closers = [
      "And if you didn't fucking catch that, ya muppet — sort your shit out.",
      "Now piss off and do it properly, ya useless wanker.",
      "End of. No more bollocks. Fucking sorted.",
      "Don't make me repeat myself, ya knobheaded gobshite.",
    ];
    text = `${text}\n\n${pick(closers)}`;
    // Final top-up if STILL short (shouldn't happen, but be paranoid).
    if (countMatches(text, lex.heavy) < TARGET_HEAVY) {
      text = injectInline(text, lex.fillers_heavy, TARGET_HEAVY - countMatches(text, lex.heavy));
    }
    return text;
  }

  if (mode === "medium") {
    const need = Math.max(0, 3 - countMatches(text, lex.mid));
    if (need > 0) text = injectInline(text, lex.fillers_mid, need);
    return text;
  }

  // mild
  if (countMatches(text, [...lex.soft, ...lex.mid]) < 1) {
    text = `${text} Bloody hell.`;
  }
  return text;
}
