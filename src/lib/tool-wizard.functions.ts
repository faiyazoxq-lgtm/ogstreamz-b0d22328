import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { z } from "zod";
import { callClaude } from "@/lib/claude.server";

const QAItem = z.object({
  q: z.string().min(1).max(300),
  a: z.string().max(600).default(""),
});

const ClarifyInput = z.object({
  brief: z.string().min(3).max(1000),
  qa: z.array(QAItem).max(8).default([]),
});

const FinalizeInput = z.object({
  brief: z.string().min(3).max(1000),
  qa: z.array(QAItem).max(8).default([]),
});

function extractJson(raw: string): any {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON in response");
  return JSON.parse(m[0]);
}

/**
 * Claude plays Interrogator: reads the brief + any prior answers and returns
 * up to 3 sharp clarifying questions. If the brief is already concrete enough
 * it returns `{ ready: true, questions: [] }`.
 */
export const wizardClarify = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d) => ClarifyInput.parse(d))
  .handler(async ({ data }): Promise<{ ready: boolean; questions: string[]; error?: string }> => {
    const system =
      "You are the ToolHUB Interrogator. Job: read a brief for a micro-tool (calculator or checklist) and ask the SHARPEST clarifying questions needed before another agent can build it. " +
      "Rules: max 3 questions. Skip what's already clear. If the brief is concrete enough to build, return ready=true with empty questions. " +
      'Return STRICT JSON only: {"ready": boolean, "questions": string[]}.';
    const qaBlock = data.qa.length
      ? "\n\nPrior Q&A:\n" + data.qa.map((x, i) => `${i + 1}. Q: ${x.q}\n   A: ${x.a || "(no answer)"}`).join("\n")
      : "";
    const res = await callClaude({
      system,
      prompt: `Brief:\n${data.brief}${qaBlock}\n\nReturn JSON now.`,
      maxTokens: 600,
    });
    if (!res.ok) return { ready: false, questions: [], error: res.error };
    try {
      const parsed = extractJson(res.text);
      const questions = Array.isArray(parsed.questions)
        ? parsed.questions.map((x: any) => String(x)).filter(Boolean).slice(0, 3)
        : [];
      return { ready: !!parsed.ready || questions.length === 0, questions };
    } catch (e: any) {
      return { ready: false, questions: [], error: e?.message ?? "parse failed" };
    }
  });

/**
 * Gemini plays Architect: merges the brief + Q&A into a polished spawn payload
 * { name, audience, vibe, logic } that the user can review then send to
 * `spawnTool` unchanged.
 */
export const wizardFinalize = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d) => FinalizeInput.parse(d))
  .handler(async ({ data }): Promise<{
    ok: true;
    name: string;
    audience: "kids" | "students" | "pro";
    vibe: string;
    logic: string;
  } | { ok: false; error: string }> => {
    const LOVABLE = process.env.LOVABLE_API_KEY;
    if (!LOVABLE) return { ok: false, error: "Lovable AI offline" };

    const qaBlock = data.qa.length
      ? "\n\nClarifications:\n" + data.qa.map((x) => `Q: ${x.q}\nA: ${x.a || "(no answer)"}`).join("\n\n")
      : "";
    const system =
      "You are the ToolHUB Architect. Convert a user's brief + clarifications into a clean spawn payload for a micro-tool spawner. " +
      'Return STRICT JSON only: {"name": string (max 60 chars, punchy title-case), "audience": "kids"|"students"|"pro", "vibe": string (max 80 chars, visual mood), "logic": string (max 480 chars, plain-English description of inputs, formula/steps, and output)}. ' +
      "No markdown, no commentary.";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Brief:\n${data.brief}${qaBlock}\n\nReturn JSON now.` },
        ],
        temperature: 0.5,
      }),
    });
    if (res.status === 429) return { ok: false, error: "Rate limited — try again in a moment." };
    if (res.status === 402) return { ok: false, error: "AI credits exhausted." };
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `AI ${res.status}: ${body.slice(0, 160)}` };
    }
    const j = await res.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = extractJson(raw);
      const audience = ["kids", "students", "pro"].includes(parsed.audience) ? parsed.audience : "students";
      return {
        ok: true,
        name: String(parsed.name ?? "").slice(0, 60).trim() || "New Tool",
        audience,
        vibe: String(parsed.vibe ?? "clean modern").slice(0, 80).trim(),
        logic: String(parsed.logic ?? data.brief).slice(0, 480).trim(),
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "parse failed" };
    }
  });