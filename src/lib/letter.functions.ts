import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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