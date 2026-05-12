import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, FileDown, Loader2, ArrowRight, ArrowLeft, RotateCcw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { CreditWallet } from "@/components/CreditWallet";
import { VaultLockedDialog } from "@/components/VaultLockedDialog";
import { clarifyLetter, generateLetter, type LetterInput } from "@/lib/letter.functions";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { requireMember } from "@/lib/route-guards";

export const Route = createFileRoute("/letterhub")({
  beforeLoad: requireMember,
  head: () => ({
    meta: [
      { title: "LetterHUB · Professional Letter Generator — 0G-STREAMZ" },
      { name: "description", content: "Pick the issue, run the wizard, and download a polished, professionally worded PDF letter." },
      { property: "og:title", content: "LetterHUB · Professional Letter Generator" },
      { property: "og:description", content: "AI-assisted, properly formatted letters for complaints, requests, references and more." },
    ],
  }),
  component: LetterHubPage,
});

const ISSUES = [
  "Complaint",
  "Formal request",
  "Demand for payment",
  "Refund / chargeback",
  "Resignation",
  "Reference / recommendation",
  "Cover letter",
  "Apology",
  "Notice (vacate, cancel, terminate)",
  "Dispute / response",
  "Authorisation / consent",
  "Thank you / commendation",
  "Other",
];

const TONES = ["Formal", "Firm", "Friendly", "Apologetic", "Persuasive"];
const FORMATS = ["Business letter", "Email", "Cover letter", "Memo"];
const AUDIENCES = ["Business", "Government / council", "Landlord", "Employer / HR", "School / university", "Bank / insurer", "Individual"];

const EMPTY: LetterInput = {
  issue: "",
  subIssue: "",
  tone: "Formal",
  audience: "Business",
  format: "Business letter",
  recipientName: "",
  recipientOrg: "",
  recipientAddress: "",
  senderName: "",
  senderAddress: "",
  senderContact: "",
  subject: "",
  context: "",
  outcome: "",
  answers: "",
};

function LetterHubPage() {
  const { user, profile } = useAuth();
  const clarify = useServerFn(clarifyLetter);
  const generate = useServerFn(generateLetter);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<LetterInput>(EMPTY);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState("");
  const [locked, setLocked] = useState(false);

  const set = <K extends keyof LetterInput>(k: K, v: LetterInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm(EMPTY);
    setQuestions([]);
    setAnswers({});
    setLetter("");
    setStep(1);
  };

  const canStep2 = form.issue && form.subIssue.trim() && form.format && form.tone && form.audience;
  const canStep3 =
    form.senderName.trim() && form.recipientName.trim() && form.context.trim().length > 20 && form.outcome.trim().length > 5;

  const goClarify = async () => {
    if (!user) return setLocked(true);
    setLoading(true);
    try {
      const res = await clarify({ data: form });
      if (!res.ok) {
        toast.error(res.error || "Could not fetch questions.");
        return;
      }
      setQuestions(res.questions);
      setAnswers({});
      setStep(4);
    } catch (e: any) {
      toast.error(e?.message || "AI error");
    } finally {
      setLoading(false);
    }
  };

  const goGenerate = async () => {
    if (!user) return setLocked(true);
    setLoading(true);
    try {
      const answersText = questions
        .map((q, i) => `Q: ${q}\nA: ${answers[i]?.trim() || "(no answer)"}`)
        .join("\n\n");
      const res = await generate({ data: { ...form, answers: answersText } });
      if (!res.ok) {
        if (res.error === "insufficient") {
          toast.error("Not enough credits. LetterHUB needs 3 credits per letter.");
        } else {
          toast.error(res.error || "AI error");
        }
        return;
      }
      setLetter(res.letter);
      toast.success(
        res.balance != null ? `Letter ready · ${res.balance} credits left` : "Letter ready",
      );
    } catch (e: any) {
      toast.error(e?.message || "AI error");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!letter) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 56;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(letter, maxWidth);
    let y = margin;
    lines.forEach((line: string) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 16;
    });
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "Drafted via LetterHUB · 0G-STREAMZ. Review carefully before sending.",
      margin,
      pageHeight - 28,
    );
    const safe = (form.subject || form.issue || "letter").replace(/[^a-z0-9]+/gi, "-");
    doc.save(`letter-${safe.toLowerCase()}.pdf`);
  };

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all " +
        (active
          ? "border-[oklch(0.72_0.22_245/0.9)] bg-[oklch(0.72_0.22_245/0.18)] text-white"
          : "border-border bg-background/40 text-foreground hover:border-[oklch(0.72_0.22_245/0.6)]")
      }
    >
      {children}
    </button>
  );

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.12)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--neon-blue-bright)" }}>
          <Mail className="h-3.5 w-3.5" /> LetterHUB
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Professional Letter Generator</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Pick the issue, run the wizard, and download a polished, professionally worded PDF letter. <span className="text-foreground font-bold">3 credits per letter.</span>
        </p>
      </header>

      <ol className="flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-[0.25em]">
        {(["Issue", "Parties & Facts", "Clarify", "Letter"] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full border ${active ? "border-[oklch(0.72_0.22_245/0.9)] text-white bg-[oklch(0.72_0.22_245/0.25)]" : done ? "border-[oklch(0.72_0.22_245/0.5)] text-white/80" : "border-white/15 text-white/40"}`}>{n}</span>
              <span className={active ? "text-white" : done ? "text-white/70" : "text-white/40"}>{label}</span>
              {n < 4 && <span className="text-white/20">→</span>}
            </li>
          );
        })}
      </ol>

      <section className="rounded-3xl border border-[oklch(0.72_0.22_245/0.4)] bg-gradient-to-br from-card to-background p-4 sm:p-6 shadow-[0_0_80px_oklch(0.72_0.22_245/0.1)] backdrop-blur-xl">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">What is the letter about?</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ISSUES.map((t) => (
                  <Pill key={t} active={form.issue === t} onClick={() => set("issue", t)}>{t}</Pill>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Be specific (one line)</Label>
              <Input
                value={form.subIssue}
                onChange={(e) => set("subIssue", e.target.value)}
                placeholder="e.g. Faulty laptop bought 3 weeks ago — refund refused"
                maxLength={120}
                className="mt-1 bg-background/60"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Format</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FORMATS.map((t) => (
                    <Pill key={t} active={form.format === t} onClick={() => set("format", t)}>{t}</Pill>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Tone</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <Pill key={t} active={form.tone === t} onClick={() => set("tone", t)}>{t}</Pill>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Audience</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {AUDIENCES.map((t) => (
                    <Pill key={t} active={form.audience === t} onClick={() => set("audience", t)}>{t}</Pill>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button disabled={!canStep2} onClick={() => setStep(2)} className="btn-glass-blue uppercase tracking-[0.2em] font-black">
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your full name</Label>
                <Input value={form.senderName} onChange={(e) => set("senderName", e.target.value)} maxLength={120} className="mt-1 bg-background/60" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your contact (email / phone)</Label>
                <Input value={form.senderContact} onChange={(e) => set("senderContact", e.target.value)} maxLength={160} className="mt-1 bg-background/60" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your address</Label>
                <Textarea value={form.senderAddress} onChange={(e) => set("senderAddress", e.target.value)} maxLength={400} className="mt-1 bg-background/60 min-h-[64px]" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Recipient name</Label>
                <Input value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} placeholder="e.g. Customer Services Manager" maxLength={120} className="mt-1 bg-background/60" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Recipient organisation</Label>
                <Input value={form.recipientOrg} onChange={(e) => set("recipientOrg", e.target.value)} placeholder="e.g. Acme Ltd" maxLength={160} className="mt-1 bg-background/60" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Recipient address</Label>
                <Textarea value={form.recipientAddress} onChange={(e) => set("recipientAddress", e.target.value)} maxLength={400} className="mt-1 bg-background/60 min-h-[64px]" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Subject line (optional)</Label>
                <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Re: Refund request — Order #12345" maxLength={160} className="mt-1 bg-background/60" />
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Context — what happened? (be specific)</Label>
              <Textarea
                value={form.context}
                onChange={(e) => set("context", e.target.value)}
                placeholder="Dates, amounts, references, prior contact, anything the recipient needs to know."
                maxLength={2000}
                className="mt-1 bg-background/60 min-h-[140px] font-mono text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{form.context.length} / 2000</p>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Desired outcome</Label>
              <Textarea
                value={form.outcome}
                onChange={(e) => set("outcome", e.target.value)}
                placeholder="What do you want the recipient to do? e.g. full refund within 14 days."
                maxLength={600}
                className="mt-1 bg-background/60 min-h-[80px]"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="uppercase tracking-[0.2em] font-black">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button disabled={!canStep3 || loading} onClick={() => { setStep(3); void goClarify(); }} className="btn-glass-blue uppercase tracking-[0.2em] font-black">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Get clarifying questions
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
            Asking the LetterHUB agent for clarifying questions…
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            {!letter && (
              <>
                <p className="text-sm text-muted-foreground">
                  The agent needs a few more details to nail the wording. Answer what you can — leave blank if not applicable.
                </p>
                <div className="space-y-4">
                  {questions.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No questions returned. You can generate the letter directly.</p>
                  )}
                  {questions.map((q, i) => (
                    <div key={i}>
                      <Label className="text-xs font-bold text-white/90">{i + 1}. {q}</Label>
                      <Textarea
                        value={answers[i] || ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                        maxLength={500}
                        className="mt-1 bg-background/60 min-h-[64px]"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="uppercase tracking-[0.2em] font-black">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">
                      Balance: <span className="text-white font-bold tabular-nums">{profile?.credits ?? 0}</span> credits · costs <span className="text-white font-bold">3</span>
                    </span>
                    <Button disabled={loading} onClick={goGenerate} className="btn-glass-blue uppercase tracking-[0.2em] font-black">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Generate letter
                    </Button>
                  </div>
                </div>
              </>
            )}

            {letter && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black uppercase tracking-[0.2em]">Draft Letter</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={reset} className="uppercase tracking-[0.2em] font-black text-xs">
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New
                    </Button>
                    <Button onClick={downloadPdf} className="btn-glass-blue uppercase tracking-[0.2em] font-black">
                      <FileDown className="h-4 w-4 mr-2" /> Download PDF
                    </Button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed bg-background/60 border border-border rounded-xl p-4 max-h-[60vh] overflow-y-auto">
                  {letter}
                </pre>
                <p className="text-[11px] text-muted-foreground">
                  Review carefully and add any final personal touches before sending.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <CreditWallet className="mt-10" />

      <VaultLockedDialog open={locked} onOpenChange={setLocked} itemName="LetterHUB" isAuthenticated={!!user} />
    </main>
  );
}