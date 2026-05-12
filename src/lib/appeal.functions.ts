import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppealInput = {
  jurisdiction: string;
  penaltyType: string;
  reasonCategory: string;
  noticeRef: string;
  noticeDate: string;
  deadline: string;
  amount: string;
  issuer: string;
  fullName: string;
  address: string;
  facts: string;
  answers?: string;
};

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

function sanitizeInput(d: Partial<AppealInput>): AppealInput {
  return {
    jurisdiction: clip(d.jurisdiction, 120),
    penaltyType: clip(d.penaltyType, 80),
    reasonCategory: clip(d.reasonCategory, 80),
    noticeRef: clip(d.noticeRef, 80),
    noticeDate: clip(d.noticeDate, 40),
    deadline: clip(d.deadline, 40),
    amount: clip(d.amount, 40),
    issuer: clip(d.issuer, 160),
    fullName: clip(d.fullName, 120),
    address: clip(d.address, 400),
    facts: clip(d.facts, 2000),
    answers: clip(d.answers, 2000),
  };
}

function systemPrompt(input: AppealInput, mode: "clarify" | "draft"): string {
  const base =
    `You are an AppealHUB legal-letter assistant. The user is preparing a written appeal against a ${input.penaltyType || "penalty"} ` +
    `(reason category: ${input.reasonCategory || "unspecified"}) issued in jurisdiction "${input.jurisdiction || "unspecified"}".\n` +
    `You must reason about the relevant statute, regulations and procedural rules for that jurisdiction. ` +
    `For UK matters cite Acts such as the Traffic Management Act 2004, Civil Enforcement of Parking Contraventions (England) General Regulations 2007, Housing Act 1988/2004, Council Tax (Administration & Enforcement) Regulations 1992, etc., where relevant. ` +
    `For other jurisdictions cite the closest equivalent governing statute or code. Never invent statute names — if unsure, refer to "the governing regulations" instead.\n` +
    `Always be neutral, factual, and respectful. Never advise wrongdoing. Make clear this is a draft to be reviewed by the recipient or a qualified legal professional.`;

  if (mode === "clarify") {
    return (
      base +
      `\n\nReturn EXACTLY a JSON array of 3 to 6 short clarifying questions you need answered before drafting a strong appeal letter. ` +
      `Each question must be specific to the penalty type and jurisdiction. Output JSON only, no prose. Example: ["Were you the registered keeper at the time?", "Do you have photographic evidence of the signage?"]`
    );
  }

  return (
    base +
    `\n\nDraft a formal appeal letter in plain English. Structure:\n` +
    `1. Sender block (name + address)\n2. Date\n3. Recipient (issuer)\n4. Reference line (Notice ref + amount)\n5. Subject line\n6. Salutation\n7. 4-7 numbered grounds of appeal grounded in the cited statute, applied to the user's facts and answers\n8. Requested remedy (cancel / reduce / accept representations)\n9. Reservation of rights\n10. Sign-off\n\n` +
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

export const clarifyAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Partial<AppealInput>) => sanitizeInput(data))
  .handler(async ({ data }) => {
    if (!data.penaltyType || !data.facts) {
      return { ok: false as const, error: "Penalty type and facts required.", questions: [] as string[] };
    }
    try {
      const raw = await callGateway([
        { role: "system", content: systemPrompt(data, "clarify") },
        {
          role: "user",
          content:
            `Notice details:\nIssuer: ${data.issuer}\nReference: ${data.noticeRef}\nDate issued: ${data.noticeDate}\nDeadline: ${data.deadline}\nAmount: ${data.amount}\n\nUser's facts:\n${data.facts}`,
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

export const generateAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Partial<AppealInput>) => sanitizeInput(data))
  .handler(async ({ data, context }) => {
    if (!data.penaltyType || !data.facts || !data.fullName) {
      return { ok: false as const, error: "Missing required fields.", letter: "", balance: null as number | null };
    }
    const { supabase } = context as { supabase: any };

    // Charge 3 credits up-front
    const { data: balance, error: spendErr } = await supabase.rpc("spend_credits", {
      _amount: 3,
      _reason: `appealhub:${data.penaltyType}`.slice(0, 80),
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
              `Sender:\n${data.fullName}\n${data.address}\n\nIssuer: ${data.issuer}\nNotice ref: ${data.noticeRef}\nDate issued: ${data.noticeDate}\nDeadline: ${data.deadline}\nAmount: ${data.amount}\n\nFacts:\n${data.facts}\n\nAnswers to clarifying questions:\n${data.answers || "(none provided)"}`,
          },
        ],
        0.3,
      );
      return { ok: true as const, error: null, letter, balance: balance ?? null };
    } catch (e: any) {
      // Best-effort refund
      await supabase.rpc("admin_adjust_credits" as any, { _amount: 3, _reason: "appealhub:refund" }).catch(() => {});
      return { ok: false as const, error: e?.message || "AI error", letter: "", balance: null };
    }
  });