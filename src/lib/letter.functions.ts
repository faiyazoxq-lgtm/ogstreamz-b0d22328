import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

export type LetterInput = {
  issue: string;          // category, e.g. "Complaint"
  subIssue: string;       // specific reason / topic
  tone: string;           // Formal, Firm, Friendly, Apologetic, Persuasive
  audience: string;       // Business, Government, Individual, Landlord, Employer, etc.
  format: string;         // Business letter, Email, Memo, Cover letter
  recipientName: string;
  recipientOrg: string;
  recipientAddress: string;
  senderName: string;
  senderAddress: string;
  senderContact: string;  // email/phone
  subject: string;        // optional one-liner the user already has in mind
  context: string;        // facts / what happened / what they want
  outcome: string;        // desired outcome / requested action
  answers?: string;
};

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

function sanitize(d: Partial<LetterInput>): LetterInput {
  return {
    issue: clip(d.issue, 80),
    subIssue: clip(d.subIssue, 120),
    tone: clip(d.tone, 40),
    audience: clip(d.audience, 60),
    format: clip(d.format, 40),
    recipientName: clip(d.recipientName, 120),
    recipientOrg: clip(d.recipientOrg, 160),
    recipientAddress: clip(d.recipientAddress, 400),
    senderName: clip(d.senderName, 120),
    senderAddress: clip(d.senderAddress, 400),
    senderContact: clip(d.senderContact, 160),
    subject: clip(d.subject, 160),
    context: clip(d.context, 2000),
    outcome: clip(d.outcome, 600),
    answers: clip(d.answers, 2000),
  };
}

function systemPrompt(d: LetterInput, mode: "clarify" | "draft"): string {
  const base =
    `You are LetterHUB, a professional correspondence assistant. ` +
    `The user is preparing a ${d.format || "letter"} (${d.issue || "general"} — ${d.subIssue || "unspecified"}) ` +
    `addressed to a ${d.audience || "recipient"}. Desired tone: ${d.tone || "formal"}. ` +
    `Always be courteous, clear and unambiguous. Never invent facts, names, dates, monetary amounts, or institutions — if a detail is missing, omit it gracefully or use a clearly bracketed placeholder like [date] or [reference]. ` +
    `Stay within professional norms: no threats, no defamation, no profanity.`;

  if (mode === "clarify") {
    return (
      base +
      `\n\nReturn EXACTLY a JSON array of 3 to 6 short clarifying questions you need answered before drafting an effective letter. ` +
      `Make each question specific to the chosen issue, sub-issue and audience. Output JSON only, no prose. ` +
      `Example: ["What date did the incident occur?", "Have you contacted them about this before?"]`
    );
  }

  return (
    base +
    `\n\nDraft a polished letter in plain English using the chosen format. Structure for a business letter:\n` +
    `1. Sender block (name, address, contact)\n2. Date placeholder [today]\n3. Recipient block (name, organisation, address)\n4. Subject line (Re: ...)\n5. Salutation\n6. Opening paragraph stating purpose\n7. 2-4 body paragraphs covering facts, reasoning and supporting points\n8. Clear request / desired outcome\n9. Polite closing line\n10. Sign-off + sender name\n\n` +
    `For an Email format omit postal address blocks and start with a short subject + greeting. ` +
    `For a Cover letter focus paragraphs on fit, relevant achievements, and call-to-action. ` +
    `For a Memo use TO / FROM / DATE / SUBJECT header and short numbered body.\n\n` +
    `Output the letter body as plain text only. No markdown, no preamble, no commentary, no \`\`\` fences.`
  );
}

async function callGateway(messages: any[], temperature = 0.4) {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  if (!LOVABLE) throw new Error("AI offline");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      temperature,
    }),
  });
  if (res.status === 429) throw new Error("Rate limited — please wait a moment and try again.");
  if (res.status === 402) throw new Error("AI credits exhausted on the platform side.");
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  return content.trim();
}

export const clarifyLetter = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: Partial<LetterInput>) => sanitize(data))
  .handler(async ({ data }) => {
    if (!data.issue || !data.context) {
      return { ok: false as const, error: "Issue and context required.", questions: [] as string[] };
    }
    try {
      const raw = await callGateway([
        { role: "system", content: systemPrompt(data, "clarify") },
        {
          role: "user",
          content:
            `Issue: ${data.issue} / ${data.subIssue}\nFormat: ${data.format}\nTone: ${data.tone}\nAudience: ${data.audience}\nRecipient: ${data.recipientName} (${data.recipientOrg})\nSubject hint: ${data.subject}\nContext:\n${data.context}\nDesired outcome:\n${data.outcome}`,
        },
      ]);
      let questions: string[] = [];
      try {
        const match = raw.match(/\[[\s\S]*\]/);
        questions = JSON.parse(match ? match[0] : raw);
      } catch {
        questions = raw
          .split(/\n+/)
          .map((l) => l.replace(/^[\d\-\*\.\)\s]+/, "").trim())
          .filter((l) => l.length > 4 && l.endsWith("?"));
      }
      questions = questions.filter((q) => typeof q === "string").slice(0, 6);
      return { ok: true as const, error: null, questions };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "AI error", questions: [] };
    }
  });

export const generateLetter = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: Partial<LetterInput>) => sanitize(data))
  .handler(async ({ data, context }) => {
    if (!data.issue || !data.context || !data.senderName) {
      return { ok: false as const, error: "Missing required fields.", letter: "", balance: null as number | null };
    }
    const { supabase } = context as { supabase: any };

    const { data: balance, error: spendErr } = await supabase.rpc("spend_credits", {
      _amount: 3,
      _reason: `letterhub:${data.issue}`.slice(0, 80),
    });
    if (spendErr) {
      const msg = (spendErr.message || "").toLowerCase();
      if (msg.includes("insufficient")) {
        return { ok: false as const, error: "insufficient", letter: "", balance: null };
      }
      return { ok: false as const, error: spendErr.message, letter: "", balance: null };
    }

    try {
      const letter = await callGateway(
        [
          { role: "system", content: systemPrompt(data, "draft") },
          {
            role: "user",
            content:
              `Sender:\n${data.senderName}\n${data.senderAddress}\n${data.senderContact}\n\n` +
              `Recipient:\n${data.recipientName}\n${data.recipientOrg}\n${data.recipientAddress}\n\n` +
              `Subject hint: ${data.subject}\nIssue: ${data.issue} — ${data.subIssue}\nFormat: ${data.format}\nTone: ${data.tone}\nAudience: ${data.audience}\n\n` +
              `Context / facts:\n${data.context}\n\nDesired outcome:\n${data.outcome}\n\nAnswers to clarifying questions:\n${data.answers || "(none provided)"}`,
          },
        ],
        0.35,
      );
      return { ok: true as const, error: null, letter, balance: balance ?? null };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "AI error", letter: "", balance: null };
    }
  });

export const suggestLetterAnswer = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((raw: { question: string; inputs: Partial<LetterInput> }) => ({
    question: clip(raw?.question, 400),
    inputs: sanitize(raw?.inputs || {}),
  }))
  .handler(async ({ data }) => {
    if (!data.question) return { ok: false as const, error: "Missing question", suggestion: "" };
    try {
      const d = data.inputs;
      const suggestion = await callGateway(
        [
          {
            role: "system",
            content:
              "You are LetterHUB's auto-fill assistant. Given the user's letter context and a clarifying question, produce ONE concise draft answer (1–3 sentences, max 60 words) the user can edit. " +
              "Use only facts that are clearly supported by the provided context. If the context does not contain the answer, propose a plausible placeholder using clearly bracketed tokens like [date], [amount], [reference]. " +
              "Output plain text only — no quotes, no preamble, no markdown.",
          },
          {
            role: "user",
            content:
              `Letter context:\nIssue: ${d.issue} — ${d.subIssue}\nFormat: ${d.format} · Tone: ${d.tone} · Audience: ${d.audience}\nRecipient: ${d.recipientName} (${d.recipientOrg})\nSubject: ${d.subject}\nFacts:\n${d.context}\nDesired outcome:\n${d.outcome}\n\nClarifying question:\n${data.question}`,
          },
        ],
        0.4,
      );
      return { ok: true as const, error: null, suggestion: clip(suggestion, 600) };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "AI error", suggestion: "" };
    }
  });

// ===================== History =====================

export type LetterHistoryRow = {
  id: string;
  title: string;
  inputs: LetterInput;
  questions: string[];
  answers: Record<string, string>;
  letter: string;
  created_at: string;
  updated_at: string;
};

const titleFor = (d: LetterInput) =>
  clip(d.subject || `${d.issue}${d.subIssue ? " — " + d.subIssue : ""}` || "Untitled letter", 140);

export const saveLetterHistory = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((raw: { id?: string; inputs: Partial<LetterInput>; questions?: string[]; answers?: Record<string, string>; letter: string; title?: string }) => ({
    id: raw?.id ? String(raw.id).slice(0, 64) : undefined,
    inputs: sanitize(raw?.inputs || {}),
    questions: Array.isArray(raw?.questions) ? raw!.questions.slice(0, 12).map((q) => clip(q, 400)) : [],
    answers: raw?.answers && typeof raw.answers === "object"
      ? Object.fromEntries(Object.entries(raw.answers).slice(0, 12).map(([k, v]) => [String(k).slice(0, 8), clip(v, 600)]))
      : {},
    letter: clip(raw?.letter, 30000),
    title: raw?.title ? clip(raw.title, 140) : "",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const title = data.title || titleFor(data.inputs);
    if (data.id) {
      const { data: row, error } = await supabase
        .from("letter_history")
        .update({
          title,
          inputs: data.inputs,
          questions: data.questions,
          answers: data.answers,
          letter: data.letter,
        })
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (error) return { ok: false as const, error: error.message, id: null as string | null };
      return { ok: true as const, error: null, id: row?.id ?? data.id };
    }
    const { data: row, error } = await supabase
      .from("letter_history")
      .insert({
        user_id: userId,
        title,
        inputs: data.inputs,
        questions: data.questions,
        answers: data.answers,
        letter: data.letter,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message, id: null };
    return { ok: true as const, error: null, id: row.id as string };
  });

export const listLetterHistory = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data, error } = await supabase
      .from("letter_history")
      .select("id,title,inputs,letter,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false as const, error: error.message, items: [] as Array<{ id: string; title: string; created_at: string; updated_at: string; preview: string }> };
    const items = (data || []).map((r: any) => ({
      id: r.id as string,
      title: r.title as string,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      preview: String(r.letter || "").slice(0, 160),
    }));
    return { ok: true as const, error: null, items };
  });

export const getLetterHistory = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((raw: { id: string }) => ({ id: String(raw?.id || "").slice(0, 64) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.id) return { ok: false as const, error: "Missing id", row: null as LetterHistoryRow | null };
    const { data: row, error } = await supabase
      .from("letter_history")
      .select("id,title,inputs,questions,answers,letter,created_at,updated_at")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message, row: null };
    if (!row) return { ok: false as const, error: "Not found", row: null };
    return { ok: true as const, error: null, row: row as LetterHistoryRow };
  });

export const deleteLetterHistory = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((raw: { id: string }) => ({ id: String(raw?.id || "").slice(0, 64) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.id) return { ok: false as const, error: "Missing id" };
    const { error } = await supabase
      .from("letter_history")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, error: null };
  });