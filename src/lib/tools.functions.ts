import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "tool";
}

export type ToolAudience = "kids" | "students" | "pro";

export type ToolConfig = {
  audience: ToolAudience;
  vibe: string;
  kind: "calculator" | "checklist";
  intro: string;
  inputs: Array<{ key: string; label: string; unit?: string; type: "number" | "text"; placeholder?: string; defaultValue?: string }>;
  formula?: string; // JS expression using input keys, e.g. "v / r"
  result?: { label: string; unit?: string; decimals?: number };
  steps?: string[]; // reasoning steps shown after solving (deep mode)
  basicExplanation: string;
  deepExplanation: string; // VIP only
  kidExplain?: string; // for kids audience
  checklistItems?: string[]; // for checklist kind
  theme: { accent: string; bg: string; emoji: string; tagline: string };
};

export const spawnTool = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { name: string; audience: ToolAudience; logic: string; vibe: string; vip?: boolean }) => ({
    name: String(data.name || "").trim().slice(0, 80),
    audience: (["kids", "students", "pro"].includes(data.audience) ? data.audience : "students") as ToolAudience,
    logic: String(data.logic || "").trim().slice(0, 500),
    vibe: String(data.vibe || "").trim().slice(0, 200),
    vip: !!data.vip,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.name || !data.logic) throw new Error("Name and logic required");

    const PPLX = process.env.PERPLEXITY_API_KEY;
    if (!PPLX) throw new Error("PERPLEXITY_API_KEY missing");

    const audienceRules =
      data.audience === "kids"
        ? "Use simple words a 9-year-old understands. Short sentences. Use emojis. Provide a fun 'kidExplain' string with a story analogy."
        : data.audience === "pro"
          ? "Use precise technical terminology. Include units in SI. Deep explanation should reference equations, derivations, and edge cases."
          : "Use clear academic language suitable for high school / college students. Cite the underlying principle.";

    const prompt = `You are designing a 0G-PORTAL micro-tool.
Tool name: "${data.name}"
Audience: ${data.audience}
Visual vibe: ${data.vibe || "clean modern"}
Logic description: ${data.logic}

${audienceRules}

Decide if this is a "calculator" (math formula) or "checklist" (saved progress list).
If calculator: provide a JS expression using ONLY the input keys, basic operators (+ - * / **), Math.* functions, and parentheses. NO statements. NO function declarations. NO assignments.
Example formula for Ohm's Law (v=current*resistance, key 'current' and 'resistance' returning voltage): "current * resistance".

Return STRICT JSON ONLY matching this TypeScript type:
{
  "kind": "calculator" | "checklist",
  "intro": "1-sentence hook",
  "inputs": [{"key":"snake_case","label":"Human","unit":"opt","type":"number"|"text","placeholder":"opt","defaultValue":"opt"}],
  "formula": "JS expression (calculator only)",
  "result": {"label":"Voltage","unit":"V","decimals":2},
  "steps": ["step 1 ...","step 2 ..."],
  "basicExplanation": "1-2 sentences for free users",
  "deepExplanation": "3-5 sentences for VIP/Pro members with derivation",
  "kidExplain": "fun analogy (kids audience only, else empty)",
  "checklistItems": ["item 1","item 2"],
  "theme": {"accent":"#hex","bg":"#hex","emoji":"single emoji","tagline":"ALL CAPS 1-3 word"}
}
No markdown. No commentary.`;

    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "Output strict JSON only. No markdown, no commentary." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error("Perplexity spawnTool error", r.status, body.slice(0, 500));
      throw new Error(`Perplexity ${r.status}: ${body.slice(0, 200)}`);
    }
    const j = await r.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try { parsed = JSON.parse(m ? m[0] : raw); } catch { throw new Error("AI returned invalid JSON"); }

    // sanitize formula: only allow safe chars
    if (parsed.kind === "calculator" && parsed.formula) {
      const safe = /^[\sA-Za-z0-9_+\-*/().,]+$/;
      if (!safe.test(parsed.formula)) throw new Error("Generated formula failed safety check");
      const inputKeys: string[] = (Array.isArray(parsed.inputs) ? parsed.inputs : [])
        .map((i: any) => String(i?.key || ""))
        .filter(Boolean);
      // Identifier allowlist: only `Math`, declared input keys, and Math's
      // own properties (sin/cos/PI/...) may appear as bare identifiers.
      // This blocks prompt-injected formulas from reaching Node globals like
      // `process`, `require`, `global`, or `globalThis`.
      const allowedIdents = new Set<string>([
        "Math",
        ...inputKeys,
        ...Object.getOwnPropertyNames(Math),
      ]);
      const idents = parsed.formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
      for (const id of idents) {
        if (!allowedIdents.has(id)) {
          throw new Error(`Disallowed identifier in formula: ${id}`);
        }
      }
      // Sandbox validation: run the formula 3x with sample inputs to make
      // sure it parses and produces finite numbers.
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
        const fn = new Function("Math", ...inputKeys, `"use strict"; return (${parsed.formula});`);
        const samples = [1, 2, 7];
        for (const s of samples) {
          const args = inputKeys.map(() => s);
          const out = Number(fn(Math, ...args));
          if (!Number.isFinite(out)) throw new Error("non-finite result");
        }
      } catch (e: any) {
        throw new Error(`Sandbox validation failed: ${e?.message ?? "bad formula"}`);
      }
    }

    const config: ToolConfig = {
      audience: data.audience,
      vibe: data.vibe,
      kind: parsed.kind === "checklist" ? "checklist" : "calculator",
      intro: String(parsed.intro || ""),
      inputs: Array.isArray(parsed.inputs) ? parsed.inputs.slice(0, 8) : [],
      formula: parsed.formula,
      result: parsed.result,
      steps: Array.isArray(parsed.steps) ? parsed.steps.slice(0, 8) : [],
      basicExplanation: String(parsed.basicExplanation || ""),
      deepExplanation: String(parsed.deepExplanation || ""),
      kidExplain: String(parsed.kidExplain || ""),
      checklistItems: Array.isArray(parsed.checklistItems) ? parsed.checklistItems.slice(0, 20) : [],
      theme: {
        accent: parsed.theme?.accent || "#3ad6ff",
        bg: parsed.theme?.bg || "#06121f",
        emoji: parsed.theme?.emoji || "⚡",
        tagline: parsed.theme?.tagline || "0G TOOL",
      },
    };

    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    const { data: existing } = await supabase.from("calculators").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;

    const { data: row, error } = await supabase
      .from("calculators")
      .insert({
        slug,
        name: data.name,
        description: data.logic,
        config: config as any,
        vip: data.vip,
        published: true,
      })
      .select("id, slug, name, vip")
      .single();
    if (error) throw new Error(error.message);

    return { tool: row, slug };
  });

/**
 * Returns VIP-only fields for a calculator (deepExplanation, steps, kidExplain).
 * Server-side enforcement: requires auth + VIP/admin/boss status. Without this,
 * the public loader would leak paid content to every visitor.
 */
export const getToolVipContent = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator(z.object({ slug: z.string().min(1).max(120) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // VIP entitlement check — VIP profile, admin role, or boss.
    const [{ data: prof }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("status").eq("id", userId).maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin"])
        .maybeSingle(),
    ]);
    const isVip =
      prof?.status === "vip" || !!roleRow || (await isAdmin(supabase, userId));
    if (!isVip) throw new Error("VIP required");

    // Use admin client to read the full config regardless of row policies.
    const { data: row, error } = await supabaseAdmin
      .from("calculators")
      .select("config")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Tool not found");
    const cfg = (row.config ?? {}) as Partial<ToolConfig>;
    return {
      deepExplanation: cfg.deepExplanation ?? "",
      steps: cfg.steps ?? [],
      kidExplain: cfg.kidExplain ?? "",
    };
  });
