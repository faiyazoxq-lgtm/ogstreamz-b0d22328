import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Sparkles, FileDown, Loader2, ArrowRight, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { CreditWallet } from "@/components/CreditWallet";
import { VaultLockedDialog } from "@/components/VaultLockedDialog";
import { clarifyAppeal, generateAppeal, type AppealInput } from "@/lib/appeal.functions";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/appealhub")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "AppealHUB · Draft a Penalty Appeal Letter — 0G-STREAMZ" },
      { name: "description", content: "Pick the penalty type, paste your notice details, answer a few questions, then download a court-ready PDF appeal letter." },
      { property: "og:title", content: "AppealHUB · Penalty Appeal Letter Generator" },
      { property: "og:description", content: "AI-assisted appeal letters for parking, rent, council tax and more." },
    ],
  }),
  component: AppealHubPage,
});

const PENALTY_TYPES = [
  "Parking / PCN",
  "Speeding / NIP",
  "Bus lane / Moving traffic",
  "Council tax",
  "Rent / Section 21",
  "Tenancy deposit",
  "Fare evasion",
  "Noise / nuisance",
  "Civil penalty (HMO, planning, etc.)",
  "Benefits overpayment",
  "Other",
];

const REASON_CATEGORIES = [
  "Signage unclear / missing",
  "Vehicle not present / not mine",
  "Medical emergency",
  "Loading / unloading",
  "Permit valid",
  "Procedural error by issuer",
  "Wrong amount / calculation",
  "Already paid",
  "Statutory defence",
  "Mitigating circumstances",
  "Other",
];

const EMPTY: AppealInput = {
  jurisdiction: "United Kingdom",
  penaltyType: "",
  reasonCategory: "",
  noticeRef: "",
  noticeDate: "",
  deadline: "",
  amount: "",
  issuer: "",
  fullName: "",
  address: "",
  facts: "",
  answers: "",
};

function AppealHubPage() {
  const { user, profile } = useAuth();
  const clarify = useServerFn(clarifyAppeal);
  const generate = useServerFn(generateAppeal);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<AppealInput>(EMPTY);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState("");
  const [locked, setLocked] = useState(false);

  const set = <K extends keyof AppealInput>(k: K, v: AppealInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm(EMPTY);
    setQuestions([]);
    setAnswers({});
    setLetter("");
    setStep(1);
  };

  const canStep2 = form.jurisdiction.trim() && form.penaltyType && form.reasonCategory;
  const canStep3 = form.fullName.trim() && form.address.trim() && form.facts.trim().length > 20;

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
          toast.error("Not enough credits. AppealHUB needs 3 credits per letter.");
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
      "Drafted via AppealHUB · 0G-STREAMZ. Review carefully before sending. Not legal advice.",
      margin,
      pageHeight - 28,
    );
    const safe = (form.noticeRef || form.penaltyType || "appeal").replace(/[^a-z0-9]+/gi, "-");
    doc.save(`appeal-${safe.toLowerCase()}.pdf`);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.12)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--neon-blue-bright)" }}>
          <Megaphone className="h-3.5 w-3.5" /> AppealHUB
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Penalty Appeal Letter Generator</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Pick the penalty type, paste your notice details, answer the AI's clarifying questions and download a court-ready PDF appeal letter. <span className="text-foreground font-bold">3 credits per letter.</span>
        </p>
      </header>

      <ol className="flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-[0.25em]">
        {(["Penalty", "Notice & You", "Clarify", "Letter"] as const).map((label, i) => {
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
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Jurisdiction</Label>
              <Input
                value={form.jurisdiction}
                onChange={(e) => set("jurisdiction", e.target.value)}
                placeholder="e.g. United Kingdom — England & Wales · or California, USA"
                maxLength={120}
                className="mt-1 bg-background/60"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Country, and region/state if relevant. The AI tailors the cited laws.</p>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Type of penalty</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PENALTY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("penaltyType", t)}
                    className={
                      "px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all " +
                      (form.penaltyType === t
                        ? "border-[oklch(0.72_0.22_245/0.9)] bg-[oklch(0.72_0.22_245/0.18)] text-white"
                        : "border-border bg-background/40 text-foreground hover:border-[oklch(0.72_0.22_245/0.6)]")
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Reason / ground of appeal</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REASON_CATEGORIES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("reasonCategory", t)}
                    className={
                      "px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all " +
                      (form.reasonCategory === t
                        ? "border-[oklch(0.72_0.22_245/0.9)] bg-[oklch(0.72_0.22_245/0.18)] text-white"
                        : "border-border bg-background/40 text-foreground hover:border-[oklch(0.72_0.22_245/0.6)]")
                    }
                  >
                    {t}
                  </button>
                ))}
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
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Issuer</Label>
                <Input value={form.issuer} onChange={(e) => set("issuer", e.target.value)} placeholder="e.g. London Borough of Hackney" maxLength={160} className="mt-1 bg-background/60" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Notice reference</Label>
                <Input value={form.noticeRef} onChange={(e) => set("noticeRef", e.target.value)} placeholder="e.g. HK12345678" maxLength={80} className="mt-1 bg-background/60" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Date issued</Label>
                <Input value={form.noticeDate} onChange={(e) => set("noticeDate", e.target.value)} placeholder="e.g. 2026-04-12" maxLength={40} className="mt-1 bg-background/60" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Reply deadline</Label>
                <Input value={form.deadline} onChange={(e) => set("deadline", e.target.value)} placeholder="e.g. 28 days" maxLength={40} className="mt-1 bg-background/60" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Amount demanded</Label>
                <Input value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="e.g. £130" maxLength={40} className="mt-1 bg-background/60" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your full name</Label>
                <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="As it appears on the notice" maxLength={120} className="mt-1 bg-background/60" />
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your postal address</Label>
              <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, City, Postcode" maxLength={400} className="mt-1 bg-background/60 min-h-[80px]" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">What happened? (your facts)</Label>
              <Textarea
                value={form.facts}
                onChange={(e) => set("facts", e.target.value)}
                placeholder="Be specific. Dates, times, who, where, evidence you have."
                maxLength={2000}
                className="mt-1 bg-background/60 min-h-[140px] font-mono text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{form.facts.length} / 2000</p>
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
            Asking the AppealHUB agent for clarifying questions…
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            {!letter && (
              <>
                <p className="text-sm text-muted-foreground">
                  The agent needs a few more details. Answer what you can — leave blank if not applicable.
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
                      Generate appeal letter
                    </Button>
                  </div>
                </div>
              </>
            )}

            {letter && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black uppercase tracking-[0.2em]">Draft Appeal Letter</h2>
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
                  Review carefully and add any supporting evidence references before sending. This is a draft, not legal advice.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <CreditWallet className="mt-10" />

      <VaultLockedDialog open={locked} onOpenChange={setLocked} itemName="AppealHUB" isAuthenticated={!!user} />
    </main>
  );
}