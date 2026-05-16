import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Wand2, ArrowRight, Bot, BrainCircuit, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { wizardClarify, wizardFinalize } from "@/lib/tool-wizard.functions";
import type { ToolAudience } from "@/lib/tools.functions";

type QA = { q: string; a: string };
type Step = "brief" | "clarify" | "review";

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

  const apply = () => {
    if (!draft) return;
    onApply(draft);
    toast.success("Brief applied — review below and spawn.");
  };

  const spawn = async () => {
    if (!draft || !onSpawn) return;
    onApply(draft);
    await onSpawn(draft);
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
                <div className="text-xs font-semibold text-foreground mb-2">{item.q}</div>
                <Input
                  value={item.a}
                  onChange={(e) => {
                    const next = qa.slice();
                    next[idx] = { ...next[idx], a: e.target.value };
                    setQa(next);
                  }}
                  placeholder="Your answer (optional)"
                  className="bg-background/60 text-sm"
                  maxLength={600}
                />
              </div>
            ))}
          </div>
          <Button onClick={submitAnswers} disabled={busy} className="w-full bg-gold text-primary-foreground hover:bg-gold/90 font-bold">
            {busy ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Drafting with Gemini…</>) : (<>Continue <ArrowRight className="h-4 w-4 ml-2" /></>)}
          </Button>
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
            <Button onClick={apply} variant="outline" className="flex-1">Apply to Form</Button>
            {onSpawn && (
              <Button onClick={spawn} disabled={busy || !canSpawn} className="flex-1 bg-gold text-primary-foreground hover:bg-gold/90 font-bold">
                {busy ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Spawning…</>) : (<><Wand2 className="h-4 w-4 mr-2" /> Spawn Now</>)}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}