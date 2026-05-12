import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, FileDown, Loader2, ArrowRight, ArrowLeft, RotateCcw, Mail, History, Trash2, FileText, Wand2, CheckCircle2, AlertCircle, Eye, Pencil, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { CreditWallet } from "@/components/CreditWallet";
import { VaultLockedDialog } from "@/components/VaultLockedDialog";
import {
  clarifyLetter,
  generateLetter,
  saveLetterHistory,
  listLetterHistory,
  getLetterHistory,
  deleteLetterHistory,
  suggestLetterAnswer,
  type LetterInput,
} from "@/lib/letter.functions";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
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
  const saveHistoryFn = useServerFn(saveLetterHistory);
  const listHistoryFn = useServerFn(listLetterHistory);
  const getHistoryFn = useServerFn(getLetterHistory);
  const deleteHistoryFn = useServerFn(deleteLetterHistory);
  const suggestFn = useServerFn(suggestLetterAnswer);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<LetterInput>(EMPTY);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState("");
  const [locked, setLocked] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; title: string; created_at: string; updated_at: string; preview: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [suggestingIdx, setSuggestingIdx] = useState<number | null>(null);
  const [touched, setTouched] = useState<Record<number, boolean>>({});
  const [previewMode, setPreviewMode] = useState<"preview" | "edit" | "split">("preview");

  // When reopening a saved letter, the local autosaved draft for that slot
  // may differ from what's in the database. Prompt the user to choose.
  type LocalDraft = {
    form?: LetterInput;
    questions?: string[];
    answers?: Record<number, string>;
    letter?: string;
    step?: 1 | 2 | 3 | 4;
    savedAt?: number;
  };
  const [conflict, setConflict] = useState<null | {
    id: string;
    dbRow: any;
    local: LocalDraft;
  }>(null);

  // ---- Autosave (localStorage) ----
  // Keyed by historyId ("new" for unsaved drafts) and user id so multiple
  // accounts on the same browser don't clobber each other. We also persist
  // the active historyId in a sibling key so a refresh restores the user
  // back to the same letter they were editing.
  const activeKey = user ? `letterhub:active:${user.id}` : null;
  const autosaveKey = user ? `letterhub:draft:${user.id}:${historyId ?? "new"}` : null;
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // On first mount per user, rehydrate the last-active historyId so the
  // autosave key resolves to the right draft slot.
  useEffect(() => {
    if (!activeKey || typeof window === "undefined") return;
    if (historyId !== null) return;
    try {
      const raw = window.localStorage.getItem(activeKey);
      if (raw) setHistoryId(raw);
    } catch {
      /* ignore */
    }
    // intentionally only runs when activeKey becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  // Persist active historyId whenever it changes
  useEffect(() => {
    if (!activeKey || typeof window === "undefined") return;
    try {
      if (historyId) window.localStorage.setItem(activeKey, historyId);
      else window.localStorage.removeItem(activeKey);
    } catch {
      /* ignore */
    }
  }, [activeKey, historyId]);

  // Restore wizard state on mount / when switching draft slots
  useEffect(() => {
    if (!autosaveKey || typeof window === "undefined") return;
    if (restoredKey === autosaveKey) return;
    try {
      const raw = window.localStorage.getItem(autosaveKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          form?: LetterInput;
          questions?: string[];
          answers?: Record<number, string>;
          letter?: string;
          step?: 1 | 2 | 3 | 4;
          savedAt?: number;
        };
        if (saved.form) setForm((f) => ({ ...f, ...saved.form }));
        if (Array.isArray(saved.questions)) setQuestions(saved.questions);
        if (saved.answers && typeof saved.answers === "object") {
          const ans: Record<number, string> = {};
          Object.entries(saved.answers).forEach(([k, v]) => {
            const i = Number(k);
            if (Number.isFinite(i)) ans[i] = String(v ?? "");
          });
          setAnswers(ans);
        }
        if (typeof saved.letter === "string") setLetter(saved.letter);
        if (saved.step) setStep(saved.step);
        if (saved.savedAt) setLastSavedAt(saved.savedAt);
      }
    } catch {
      /* ignore corrupt drafts */
    }
    setRestoredKey(autosaveKey);
  }, [autosaveKey, restoredKey]);

  // Debounced persist on every change
  useEffect(() => {
    if (!autosaveKey || typeof window === "undefined") return;
    if (restoredKey !== autosaveKey) return; // don't overwrite before restore
    const t = window.setTimeout(() => {
      try {
        const payload = {
          form,
          questions,
          answers,
          letter,
          step,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(autosaveKey, JSON.stringify(payload));
        setLastSavedAt(payload.savedAt);
      } catch {
        /* quota or serialization issue — silent */
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [autosaveKey, restoredKey, form, questions, answers, letter, step]);

  const refreshHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const res = await listHistoryFn();
      if (res.ok) setHistory(res.items);
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false);
    }
  }, [user, listHistoryFn]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const set = <K extends keyof LetterInput>(k: K, v: LetterInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    if (autosaveKey && typeof window !== "undefined") {
      try { window.localStorage.removeItem(autosaveKey); } catch { /* ignore */ }
    }
    setForm(EMPTY);
    setQuestions([]);
    setAnswers({});
    setLetter("");
    setStep(1);
    setHistoryId(null);
    setTouched({});
    setLastSavedAt(null);
    setRestoredKey(null);
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
      // auto-save to history
      try {
        const answersMap = Object.fromEntries(Object.entries(answers).map(([k, v]) => [String(k), v ?? ""]));
        const saved = await saveHistoryFn({
          data: {
            inputs: form,
            questions,
            answers: answersMap,
            letter: res.letter,
          },
        });
        if (saved.ok && saved.id) {
          setHistoryId(saved.id);
          void refreshHistory();
        }
      } catch {
        /* non-blocking */
      }
    } catch (e: any) {
      toast.error(e?.message || "AI error");
    } finally {
      setLoading(false);
    }
  };

  const saveCurrent = async () => {
    if (!letter || !user) return;
    setSavingHistory(true);
    try {
      const answersMap = Object.fromEntries(Object.entries(answers).map(([k, v]) => [String(k), v ?? ""]));
      const res = await saveHistoryFn({
        data: {
          id: historyId ?? undefined,
          inputs: form,
          questions,
          answers: answersMap,
          letter,
        },
      });
      if (!res.ok) {
        toast.error(res.error || "Could not save");
        return;
      }
      if (res.id) setHistoryId(res.id);
      toast.success("Saved to history");
      void refreshHistory();
    } finally {
      setSavingHistory(false);
    }
  };

  const openHistory = async (id: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await getHistoryFn({ data: { id } });
      if (!res.ok || !res.row) {
        toast.error(res.error || "Could not load");
        return;
      }
      const r = res.row;
      // Look for a local autosaved draft for this slot and compare.
      let local: LocalDraft | null = null;
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(`letterhub:draft:${user.id}:${id}`);
          if (raw) local = JSON.parse(raw) as LocalDraft;
        } catch {
          local = null;
        }
      }
      if (local && draftDiffersFromRow(local, r)) {
        setConflict({ id: r.id, dbRow: r, local });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      applyDbRow(r);
    } finally {
      setLoading(false);
    }
  };

  const applyDbRow = (r: any) => {
    setForm({ ...EMPTY, ...r.inputs });
    setQuestions(Array.isArray(r.questions) ? r.questions : []);
    const ansObj: Record<number, string> = {};
    Object.entries(r.answers || {}).forEach(([k, v]) => {
      const idx = Number(k);
      if (Number.isFinite(idx)) ansObj[idx] = String(v ?? "");
    });
    setAnswers(ansObj);
    setLetter(r.letter || "");
    setHistoryId(r.id);
    setStep(r.letter ? 4 : 2);
    if (user) setRestoredKey(`letterhub:draft:${user.id}:${r.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applyLocalDraft = (id: string, local: LocalDraft) => {
    if (local.form) setForm({ ...EMPTY, ...local.form });
    setQuestions(Array.isArray(local.questions) ? local.questions : []);
    const ansObj: Record<number, string> = {};
    Object.entries(local.answers || {}).forEach(([k, v]) => {
      const idx = Number(k);
      if (Number.isFinite(idx)) ansObj[idx] = String(v ?? "");
    });
    setAnswers(ansObj);
    setLetter(typeof local.letter === "string" ? local.letter : "");
    setHistoryId(id);
    setStep(local.step ?? (local.letter ? 4 : 2));
    if (local.savedAt) setLastSavedAt(local.savedAt);
    if (user) setRestoredKey(`letterhub:draft:${user.id}:${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const draftDiffersFromRow = (local: LocalDraft, r: any): boolean => {
    const norm = (s: unknown) => String(s ?? "").trim();
    if (norm(local.letter) !== norm(r.letter)) return true;
    const lf = { ...EMPTY, ...(local.form || {}) };
    const rf = { ...EMPTY, ...(r.inputs || {}) };
    for (const k of Object.keys(EMPTY) as (keyof LetterInput)[]) {
      if (norm(lf[k]) !== norm(rf[k])) return true;
    }
    const la = local.answers || {};
    const ra = r.answers || {};
    const keys = new Set([...Object.keys(la), ...Object.keys(ra)]);
    for (const k of keys) {
      if (norm((la as any)[k]) !== norm((ra as any)[k])) return true;
    }
    return false;
  };

  const removeHistory = async (id: string) => {
    if (!confirm("Delete this saved letter?")) return;
    const res = await deleteHistoryFn({ data: { id } });
    if (!res.ok) {
      toast.error(res.error || "Delete failed");
      return;
    }
    if (user && typeof window !== "undefined") {
      try { window.localStorage.removeItem(`letterhub:draft:${user.id}:${id}`); } catch { /* ignore */ }
    }
    if (historyId === id) setHistoryId(null);
    setHistory((h) => h.filter((x) => x.id !== id));
    toast.success("Deleted");
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

  const downloadDocx = async () => {
    if (!letter) return;
    try {
      const paragraphs = letter.split(/\n/).map(
        (line) =>
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 120 },
            children: [new TextRun({ text: line, font: "Times New Roman", size: 22 })],
          }),
      );
      paragraphs.push(
        new Paragraph({
          spacing: { before: 480 },
          children: [
            new TextRun({
              text: "Drafted via LetterHUB · 0G-STREAMZ. Review carefully before sending.",
              italics: true,
              size: 16,
              color: "808080",
              font: "Times New Roman",
            }),
          ],
        }),
      );
      const docx = new Document({
        creator: "LetterHUB",
        title: form.subject || form.issue || "Letter",
        styles: {
          default: { document: { run: { font: "Times New Roman", size: 22 } } },
        },
        sections: [
          {
            properties: {
              page: {
                margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
              },
            },
            children: paragraphs,
          },
        ],
      });
      const blob = await Packer.toBlob(docx);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = (form.subject || form.issue || "letter").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      a.href = url;
      a.download = `letter-${safe}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Could not build DOCX");
    }
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
      {conflict && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="letterhub-conflict-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[oklch(0.72_0.22_245/0.5)] bg-card shadow-[0_0_80px_oklch(0.72_0.22_245/0.25)] p-5">
            <h2 id="letterhub-conflict-title" className="text-base font-black uppercase tracking-[0.2em] text-white">
              Two versions found
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You have unsaved local edits for this letter that differ from the saved version.
              Which one do you want to continue with?
            </p>
            <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Saved version</div>
                <div className="text-white/90">
                  Updated {new Date(conflict.dbRow.updated_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                </div>
                <p className="mt-1 line-clamp-3 text-muted-foreground">
                  {String(conflict.dbRow.letter || "(no letter yet)").slice(0, 200)}
                </p>
              </div>
              <div className="rounded-xl border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.06)] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Local autosave</div>
                <div className="text-white/90">
                  {conflict.local.savedAt
                    ? `Auto-saved ${new Date(conflict.local.savedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`
                    : "On this device"}
                </div>
                <p className="mt-1 line-clamp-3 text-muted-foreground">
                  {String(conflict.local.letter || "(no letter yet)").slice(0, 200)}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  // Discard local, use DB. Clear the local draft so it doesn't
                  // re-trigger the prompt next time.
                  if (user && typeof window !== "undefined") {
                    try { window.localStorage.removeItem(`letterhub:draft:${user.id}:${conflict.id}`); } catch { /* ignore */ }
                  }
                  const dbRow = conflict.dbRow;
                  setConflict(null);
                  applyDbRow(dbRow);
                  toast.success("Loaded saved version");
                }}
                className="uppercase tracking-[0.2em] font-black text-xs"
              >
                Use saved
              </Button>
              <Button
                onClick={() => {
                  const { id, local } = conflict;
                  setConflict(null);
                  applyLocalDraft(id, local);
                  toast.success("Restored local draft");
                }}
                className="btn-glass-blue uppercase tracking-[0.2em] font-black text-xs"
              >
                Use local draft
              </Button>
            </div>
          </div>
        </div>
      )}

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
                  The agent needs a few more details to nail the wording. Required questions are marked with <span className="text-rose-400">*</span> · use <span className="text-white font-semibold">Auto-fill</span> to draft an answer from your context.
                </p>
                {(() => {
                  const required = questions.map((_, i) => i < Math.min(3, questions.length));
                  const answered = required.filter((req, i) => !req || (answers[i] || "").trim().length >= 5).length;
                  const total = required.filter(Boolean).length;
                  return total > 0 ? (
                    <div className="text-[11px] text-muted-foreground">
                      <span className="text-white font-bold tabular-nums">{answered}</span> / {total} required answered
                    </div>
                  ) : null;
                })()}
                <div className="space-y-4">
                  {questions.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No questions returned. You can generate the letter directly.</p>
                  )}
                  {questions.map((q, i) => {
                    const required = i < Math.min(3, questions.length);
                    const val = answers[i] || "";
                    const len = val.trim().length;
                    const tooShort = required && touched[i] && len > 0 && len < 5;
                    const missing = required && touched[i] && len === 0;
                    const valid = required && len >= 5;
                    const errorMsg = missing
                      ? "This question is required."
                      : tooShort
                        ? "Add at least 5 characters or use Auto-fill."
                        : "";
                    const isSuggesting = suggestingIdx === i;
                    const onAutofill = async () => {
                      setSuggestingIdx(i);
                      try {
                        const res = await suggestFn({ data: { question: q, inputs: form } });
                        if (!res.ok || !res.suggestion) {
                          toast.error(res.error || "Could not draft a suggestion.");
                          return;
                        }
                        setAnswers((a) => ({ ...a, [i]: res.suggestion }));
                        setTouched((t) => ({ ...t, [i]: true }));
                      } catch (e: any) {
                        toast.error(e?.message || "AI error");
                      } finally {
                        setSuggestingIdx(null);
                      }
                    };
                    return (
                      <div
                        key={i}
                        className={
                          "rounded-xl border p-3 transition-colors " +
                          (errorMsg
                            ? "border-rose-500/60 bg-rose-500/5"
                            : valid
                              ? "border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.05)]"
                              : "border-border bg-background/40")
                        }
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <Label className="text-xs font-bold text-white/90 leading-snug">
                            {i + 1}. {q}
                            {required && <span className="text-rose-400 ml-1" aria-hidden>*</span>}
                            {!required && <span className="text-muted-foreground/70 ml-1 font-normal text-[10px] uppercase tracking-wider">optional</span>}
                          </Label>
                          <button
                            type="button"
                            onClick={onAutofill}
                            disabled={isSuggesting || loading}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.1)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-white hover:bg-[oklch(0.72_0.22_245/0.2)] disabled:opacity-50"
                            aria-label={`Auto-fill answer for question ${i + 1}`}
                          >
                            {isSuggesting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                            {isSuggesting ? "Drafting…" : "Auto-fill"}
                          </button>
                        </div>
                        <Textarea
                          value={val}
                          onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                          onBlur={() => setTouched((t) => ({ ...t, [i]: true }))}
                          maxLength={500}
                          placeholder={
                            required
                              ? "Be specific — dates, names, amounts. Or hit Auto-fill."
                              : "Optional — add detail if it helps."
                          }
                          aria-invalid={!!errorMsg}
                          aria-describedby={errorMsg ? `q-${i}-err` : undefined}
                          className={
                            "bg-background/60 min-h-[64px] " +
                            (errorMsg ? "border-rose-500/60 focus-visible:ring-rose-500/40" : "")
                          }
                        />
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          {errorMsg ? (
                            <span id={`q-${i}-err`} className="inline-flex items-center gap-1 text-rose-400">
                              <AlertCircle className="h-3 w-3" /> {errorMsg}
                            </span>
                          ) : valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Looks good
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">&nbsp;</span>
                          )}
                          <span className={"tabular-nums " + (len > 450 ? "text-amber-400" : "text-muted-foreground")}>
                            {val.length} / 500
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="uppercase tracking-[0.2em] font-black">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">
                      Balance: <span className="text-white font-bold tabular-nums">{profile?.credits ?? 0}</span> credits · costs <span className="text-white font-bold">3</span>
                    </span>
                    <Button
                      disabled={
                        loading ||
                        questions.some((_, i) => i < Math.min(3, questions.length) && (answers[i] || "").trim().length < 5)
                      }
                      onClick={() => {
                        // mark all required touched so errors surface
                        const t: Record<number, boolean> = {};
                        questions.forEach((_, i) => {
                          if (i < Math.min(3, questions.length)) t[i] = true;
                        });
                        setTouched((prev) => ({ ...prev, ...t }));
                        void goGenerate();
                      }}
                      className="btn-glass-blue uppercase tracking-[0.2em] font-black"
                    >
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
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-black uppercase tracking-[0.2em]">Draft Letter</h2>
                    {lastSavedAt && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Auto-saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={reset} className="uppercase tracking-[0.2em] font-black text-xs">
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New
                    </Button>
                    <Button
                      variant="outline"
                      onClick={saveCurrent}
                      disabled={savingHistory}
                      className="uppercase tracking-[0.2em] font-black text-xs"
                    >
                      {savingHistory ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <History className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {historyId ? "Update saved" : "Save"}
                    </Button>
                    <Button onClick={downloadPdf} className="btn-glass-blue uppercase tracking-[0.2em] font-black">
                      <FileDown className="h-4 w-4 mr-2" /> Download PDF
                    </Button>
                    <Button onClick={downloadDocx} variant="outline" className="uppercase tracking-[0.2em] font-black">
                      <FileDown className="h-4 w-4 mr-2" /> DOCX
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-muted-foreground">
                    Live preview matches the PDF. Edits update instantly and are included in the download.
                  </p>
                  <div role="tablist" aria-label="Letter view" className="inline-flex rounded-lg border border-border bg-background/40 p-0.5 text-[10px] font-black uppercase tracking-[0.2em]">
                    {([
                      ["preview", "Preview", Eye],
                      ["split", "Split", Columns2],
                      ["edit", "Edit", Pencil],
                    ] as const).map(([key, label, Icon]) => (
                      <button
                        key={key}
                        role="tab"
                        aria-selected={previewMode === key}
                        onClick={() => setPreviewMode(key)}
                        className={
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors " +
                          (previewMode === key
                            ? "bg-[oklch(0.72_0.22_245/0.25)] text-white"
                            : "text-muted-foreground hover:text-white")
                        }
                      >
                        <Icon className="h-3 w-3" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className={
                    "grid gap-4 " +
                    (previewMode === "split" ? "lg:grid-cols-2" : "grid-cols-1")
                  }
                >
                  {(previewMode === "edit" || previewMode === "split") && (
                    <div className="flex flex-col">
                      <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Editable draft</Label>
                      <Textarea
                        value={letter}
                        onChange={(e) => setLetter(e.target.value)}
                        maxLength={20000}
                        spellCheck
                        className="bg-background/60 min-h-[60vh] font-mono text-sm leading-relaxed"
                        aria-label="Letter draft editor"
                      />
                      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums text-right">
                        {letter.trim().split(/\s+/).filter(Boolean).length} words · {letter.length} chars
                      </div>
                    </div>
                  )}
                  {(previewMode === "preview" || previewMode === "split") && (
                    <div className="flex flex-col items-center">
                      <Label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1 self-start">PDF preview · A4</Label>
                      <div className="relative w-full max-w-[640px] aspect-[1/1.414] bg-[#f7f3ea] text-[#1a1a1a] rounded-md shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] overflow-hidden border border-black/10">
                        <div className="absolute inset-0 overflow-y-auto px-[8%] py-[7%]">
                          <pre className="whitespace-pre-wrap font-serif text-[11.5px] leading-[1.55] m-0">
                            {letter || "Your generated letter will appear here…"}
                          </pre>
                          <div className="mt-6 pt-3 border-t border-black/10 text-[8px] text-black/50 italic font-serif">
                            Drafted via LetterHUB · 0G-STREAMZ. Review carefully before sending.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <CreditWallet className="mt-10" />

      {user && (
        <section className="mt-10 rounded-3xl border border-border bg-card/40 p-4 sm:p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-[0.25em] flex items-center gap-2">
              <History className="h-4 w-4" /> Saved letters
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {historyLoading ? "Loading…" : `${history.length} saved`}
            </span>
          </div>
          {history.length === 0 && !historyLoading && (
            <p className="text-sm text-muted-foreground italic">
              Letters you generate are auto-saved here so you can reopen, edit inputs, and re-download anytime.
            </p>
          )}
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className={
                  "group flex items-start gap-3 rounded-xl border p-3 transition-colors " +
                  (historyId === h.id
                    ? "border-[oklch(0.72_0.22_245/0.7)] bg-[oklch(0.72_0.22_245/0.08)]"
                    : "border-border bg-background/40 hover:border-[oklch(0.72_0.22_245/0.5)]")
                }
              >
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <button
                  type="button"
                  onClick={() => openHistory(h.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="text-sm font-bold truncate">{h.title || "Untitled letter"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(h.updated_at).toLocaleString()}
                  </div>
                  {h.preview && (
                    <div className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                      {h.preview}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void removeHistory(h.id)}
                  className="opacity-60 hover:opacity-100 hover:text-red-400 transition-all p-1"
                  aria-label="Delete saved letter"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <VaultLockedDialog open={locked} onOpenChange={setLocked} itemName="LetterHUB" isAuthenticated={!!user} />
    </main>
  );
}