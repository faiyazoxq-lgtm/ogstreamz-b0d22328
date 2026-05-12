/**
 * FormHUB server-only helpers.
 *
 * Generates JSON form schemas via Lovable AI and forwards submissions to
 * Telegram via the connector gateway. NEVER import this from client code —
 * it reads `process.env` and is intended for `*.functions.ts` handlers only.
 */
import { tgCall } from "./telegram-bot.server";

export type FormFieldType =
  | "text"
  | "email"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "rating";

export type FormField = {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  /** For rating fields: max stars (1..10). */
  max?: number;
};

export type FormSchema = {
  formType: "contact" | "survey";
  fields: FormField[];
  submitLabel: string;
  thankYou: string;
};

const SYSTEM = `You design clean, conversion-friendly web forms. You output ONLY valid JSON matching the requested schema. No prose, no markdown fences.`;

function userPrompt(formType: "contact" | "survey", name: string, prompt: string): string {
  const typeHint = formType === "contact"
    ? "A lead-capture / contact form. Always include name + email. Add 1-3 relevant qualifier questions."
    : "A short survey or poll. Include 3-7 thoughtful questions tied to the prompt. Use rating, select, radio, or checkbox fields where appropriate.";
  return [
    `Form type: ${formType}`,
    `Form name: ${name}`,
    `Boss's intent: ${prompt}`,
    "",
    typeHint,
    "",
    "Return JSON ONLY in this exact shape:",
    `{
  "formType": "${formType}",
  "fields": [
    { "name": "snake_case_id", "label": "Visible label", "type": "text|email|textarea|select|radio|checkbox|rating", "required": true|false, "placeholder": "optional", "options": ["only for select/radio/checkbox"], "max": 5 }
  ],
  "submitLabel": "Send",
  "thankYou": "One short confirmation sentence."
}`,
    "",
    "Rules: snake_case names, max 8 fields, no duplicate names, options 2-6 entries, rating max 5 or 10.",
  ].join("\n");
}

export async function generateFormSchemaAI(
  formType: "contact" | "survey",
  name: string,
  prompt: string,
): Promise<FormSchema> {
  const KEY = process.env.LOVABLE_API_KEY;
  if (!KEY) throw new Error("AI offline");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt(formType, name, prompt) },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("Rate limited — please wait and retry.");
  if (res.status === 402) throw new Error("AI credits exhausted on the platform side.");
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { throw new Error("AI returned invalid JSON"); }
  return normalizeSchema(parsed, formType);
}

function normalizeSchema(raw: any, formType: "contact" | "survey"): FormSchema {
  const allowed: FormFieldType[] = ["text", "email", "textarea", "select", "radio", "checkbox", "rating"];
  const seen = new Set<string>();
  const fields: FormField[] = Array.isArray(raw?.fields) ? raw.fields : [];
  const cleaned: FormField[] = [];
  for (const f of fields.slice(0, 8)) {
    if (!f || typeof f !== "object") continue;
    const name = String(f.name ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    if (!name || seen.has(name)) continue;
    const type = allowed.includes(f.type) ? (f.type as FormFieldType) : "text";
    const label = String(f.label ?? name).slice(0, 120);
    const required = !!f.required;
    const placeholder = f.placeholder ? String(f.placeholder).slice(0, 120) : undefined;
    let options: string[] | undefined;
    if (["select", "radio", "checkbox"].includes(type) && Array.isArray(f.options)) {
      options = f.options.map((o: any) => String(o).slice(0, 60)).filter(Boolean).slice(0, 8);
      if (options.length < 2) continue;
    }
    let max: number | undefined;
    if (type === "rating") {
      const n = Number(f.max);
      max = Number.isFinite(n) && n >= 3 && n <= 10 ? Math.round(n) : 5;
    }
    seen.add(name);
    cleaned.push({ name, label, type, required, placeholder, options, max });
  }
  if (cleaned.length === 0) throw new Error("AI produced no usable fields");
  return {
    formType,
    fields: cleaned,
    submitLabel: String(raw?.submitLabel ?? "Send").slice(0, 30) || "Send",
    thankYou: String(raw?.thankYou ?? "Thanks — we got it.").slice(0, 200),
  };
}

/** Format a submission as a readable Telegram message. */
export function formatSubmissionForTelegram(
  portalName: string,
  payload: Record<string, unknown>,
  fields: FormField[],
): string {
  const lines: string[] = [`📩 <b>${escapeHtml(portalName)}</b> — new submission`, ""];
  for (const f of fields) {
    const v = payload[f.name];
    if (v === undefined || v === null || v === "") continue;
    const display = Array.isArray(v) ? v.join(", ") : String(v);
    lines.push(`• <b>${escapeHtml(f.label)}:</b> ${escapeHtml(display).slice(0, 500)}`);
  }
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

export async function sendSubmissionToTelegram(
  chatId: string | number,
  text: string,
): Promise<boolean> {
  try {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }, { tag: "tg.form-submit" });
    return true;
  } catch {
    return false;
  }
}
