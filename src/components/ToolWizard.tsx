import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Wand2, ArrowRight, Bot, BrainCircuit, RotateCcw, ShieldCheck, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { wizardClarify, wizardFinalize } from "@/lib/tool-wizard.functions";
import type { ToolAudience } from "@/lib/tools.functions";

type QA = { q: string; a: string };
type Step = "brief" | "clarify" | "review" | "confirm";

export type WizardResult = {
  name: string;
  audience: ToolAudience;
  vibe: string;
  logic: string;
};

export function ToolWizard({
  onApply,
  onSpawn,
  canSpawn,
}: {
  onApply: (r: WizardResult) => void;
  onSpawn?: (r: WizardResult) => void | Promise<void>;
  canSpawn?: boolean;
}) {
  const clarifyFn = useServerFn(wizardClarify);
  const finalizeFn = useServerFn(wizardFinalize);

  const [step, setStep] = useState<Step>("brief");
  const [brief, setBrief] = useState("");
  const [qa, setQa] = useState<QA[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<WizardResult | null>(null);
  const [editingQ, setEditingQ] = useState<number | null>(null);
  const [editQDraft, setEditQDraft] = useState("");

  const reset = () => {
    setStep("brief");
    setBrief("");
    setQa([]);
    setDraft(null);
  };

  const askClaude = async (nextQa: QA[]) => {
    setBusy(true);
    try {
      const r = await clarifyFn({ data: { brief: brief.trim(), qa: nextQa } });
      if (r.error) toast.error(r.error);
      if (r.ready || r.questions.length === 0) {
        await runFinalize(nextQa);
      } else {
        setQa([...nextQa, ...r.questions.map((q) => ({ q, a: "" }))]);
        setStep("clarify");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Claude unreachable");
    } finally {
      setBusy(false);
    }
  };

  const runFinalize = async (finalQa: QA[]) => {
    setBusy(true);
    try {
      const r = await finalizeFn({ data: { brief: brief.trim(), qa: finalQa } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const result: WizardResult = { name: r.name, audience: r.audience, vibe: r.vibe, logic: r.logic };
      setDraft(result);
      setStep("review");
    } catch (e: any) {
      toast.error(e?.message ?? "Gemini unreachable");
    } finally {
      setBusy(false);
    }
  };

  const startClarify = async () => {
    if (brief.trim().length < 5) return toast.error("Describe what you want, even briefly.");
    await askClaude([]);
  };

  const submitAnswers = async () => {
    await askClaude(qa);
  };

  const redraftOnly = async () => {
    await runFinalize(qa);
  };

  const apply = () => {
    if (!draft) return;
    onApply(draft);
    toast.success("Brief applied — review below and spawn.");
  };

  const spawn = async () => {
    if (!draft || !onSpawn) return;
    onApply(draft);
    await onSpawn(draft);
    reset();
  };

  return (
    <section className="rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/5 via-background to-background p-5 sm:p-6 shadow-[0_0_60px_-25px_oklch(0.82_0.16_88_/_0.6)]">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gold">Tool Wizard</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <Bot className="h-3 w-3" /> Claude
          <span className="opacity-50">+</span>
          <BrainCircuit className="h-3 w-3" /> Gemini
          {step !== "brief" && (
            <button onClick={reset} className="ml-2 hover:text-foreground inline-flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Restart
            </button>
          )}
        </div>
      </header>

      {step === "brief" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Type what you want — rough is fine. Claude will ask anything that's unclear, then Gemini drafts the full brief.
          </p>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. A tool that helps me work out paint coverage for a room based on wall area and number of coats."
            className="min-h-32 bg-background/60 text-sm"
            maxLength={1000}
          />
          <Button onClick={startClarify} disabled={busy} className="w-full bg-gold text-primary-foreground hover:bg-gold/90 font-bold">
            {busy ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Asking Claude…</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Start Wizard</>)}
          </Button>
        </div>
      )}

      {step === "clarify" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-gold" /> Claude needs a quick clarification — skip any you don't care about.
          </p>
          <div className="space-y-3">
            {qa.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-background/40 p-3">
                {editingQ === idx ? (
                  <div className="flex items-start gap-2 mb-2">
                    <Textarea
                      value={editQDraft}
                      onChange={(e) => setEditQDraft(e.target.value)}
                      className="bg-background/60 text-xs min-h-16 flex-1"
                      maxLength={400}
                      autoFocus
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          const next = qa.slice();
                          next[idx] = { ...next[idx], q: editQDraft.trim() || next[idx].q };
                          setQa(next);
                          setEditingQ(null);
                        }}
                      >
                        <Check className="h-3.5 w-3.5 text-gold" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingQ(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-xs font-semibold text-foreground flex-1">{item.q}</div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingQ(idx);
                          setEditQDraft(item.q);
                        }}
                        title="Edit question"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => setQa(qa.filter((_, i) => i !== idx))}
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <Textarea
                  value={item.a}
                  onChange={(e) => {
                    const next = qa.slice();
                    next[idx] = { ...next[idx], a: e.target.value };
                    setQa(next);
                  }}
                  placeholder="Your answer (optional)"
                  className="bg-background/60 text-sm min-h-20"
                  maxLength={600}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => setQa([...qa, { q: "Custom note for Gemini", a: "" }])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add a note
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {draft && (
              <Button onClick={redraftOnly} disabled={busy} variant="outline" className="flex-1">
                {busy ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Re-drafting…</>) : (<><BrainCircuit className="h-4 w-4 mr-2" /> Re-draft with Gemini</>)}
              </Button>
            )}
            <Button onClick={submitAnswers} disabled={busy} className="flex-1 bg-gold text-primary-foreground hover:bg-gold/90 font-bold">
              {busy ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Asking Claude…</>) : (<>{draft ? "Ask Claude Again" : "Continue"} <ArrowRight className="h-4 w-4 ml-2" /></>)}
            </Button>
          </div>
        </div>
      )}

      {step === "review" && draft && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <BrainCircuit className="h-3.5 w-3.5 text-gold" /> Gemini's draft — apply it to the form, or spawn straight away.
          </p>
          <div className="rounded-xl border border-gold/30 bg-background/60 p-4 space-y-2 text-sm">
            <div><span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Name</span><div className="font-bold">{draft.name}</div></div>
            <div className="flex gap-4 text-xs">
              <div><span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Audience</span><div>{draft.audience}</div></div>
              <div className="flex-1"><span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Vibe</span><div className="truncate">{draft.vibe}</div></div>
            </div>
            <div><span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Logic</span><div className="text-muted-foreground whitespace-pre-wrap">{draft.logic}</div></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {qa.length > 0 && (
              <Button onClick={() => setStep("clarify")} variant="outline" className="flex-1">
                <Pencil className="h-4 w-4 mr-2" /> Edit Answers
              </Button>
            )}
            <Button onClick={apply} variant="outline" className="flex-1">Apply to Form</Button>
            {onSpawn && (
              <Button onClick={() => setStep("confirm")} disabled={busy || !canSpawn} className="flex-1 bg-gold text-primary-foreground hover:bg-gold/90 font-bold">
                <Wand2 className="h-4 w-4 mr-2" /> Preview & Spawn
              </Button>
            )}
          </div>
        </div>
      )}

      {step === "confirm" && draft && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Final preview — confirm to spawn this portal. This cannot be undone.
          </p>
          <div className="rounded-xl border border-gold/40 bg-background/70 p-4 space-y-3 text-sm">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Name</span>
              <div className="font-black text-base text-gold">{draft.name}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Audience</span>
                <div className="font-semibold">{draft.audience}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Vibe</span>
                <div className="font-semibold">{draft.vibe}</div>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Logic</span>
              <div className="text-foreground whitespace-pre-wrap mt-1">{draft.logic}</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setStep("review")} variant="outline" disabled={busy} className="flex-1">
              Back to Edit
            </Button>
            <Button onClick={spawn} disabled={busy || !canSpawn} className="flex-1 bg-gold text-primary-foreground hover:bg-gold/90 font-bold">
              {busy ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Spawning…</>) : (<><ShieldCheck className="h-4 w-4 mr-2" /> Confirm & Spawn</>)}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}