import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Crown, Loader2, Plus, RotateCcw, Save, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getLexicon, setLexiconCategory, resetLexiconCategory } from "@/lib/lexicon.functions";

export const Route = createFileRoute("/boss/lexicon")({
  head: () => ({
    meta: [
      { title: "Swear Lexicon · Boss Portal" },
      { name: "description", content: "Edit the HEAVY/MID/SOFT swear lists, refusal patterns, openers and fillers without touching code." },
    ],
  }),
  component: LexiconPage,
});

type Cat = "heavy" | "mid" | "soft" | "refusal_patterns" | "brutal_openers" | "fillers_heavy" | "fillers_mid";

const CATS: Array<{
  key: Cat;
  label: string;
  blurb: string;
  tint: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { key: "heavy", label: "HEAVY swears", blurb: "Counted in CHAOTIC mode (need ≥6 per reply). Single words.", tint: "#ff2e55", placeholder: "fuck" },
  { key: "mid", label: "MID swears", blurb: "Counted in MEDIUM mode (need ≥3 per reply). Single words.", tint: "#ff7a1a", placeholder: "shit" },
  { key: "soft", label: "SOFT swears", blurb: "Counted in MILD mode (need ≥1 per reply). Single words.", tint: "#ffd166", placeholder: "bloody" },
  { key: "refusal_patterns", label: "Refusal patterns (regex)", blurb: "JavaScript-style regexes. Matched case-insensitive and globally; matched sentences are stripped from the model's output.", tint: "#a78bfa", placeholder: "\\bi can'?t\\b[^.!?]*[.!?]", multiline: true },
  { key: "brutal_openers", label: "Brutal openers", blurb: "Used in CHAOTIC mode if the reply doesn't already start with a heavy swear.", tint: "#ff5acd", placeholder: "Right, you absolute melt —", multiline: true },
  { key: "fillers_heavy", label: "Fillers — heavy", blurb: "Injected into sentences to hit the CHAOTIC heavy-swear quota.", tint: "#ff2e55", placeholder: "no fucking arguments,", multiline: true },
  { key: "fillers_mid", label: "Fillers — mid", blurb: "Injected into sentences to hit the MEDIUM mid-swear quota.", tint: "#ff7a1a", placeholder: "stop being a prick,", multiline: true },
];

type Lex = Record<Cat, string[]>;

function LexiconPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const isBoss = profile?.rank === "boss" || isAdmin;

  const fetchLex = useServerFn(getLexicon);
  const saveCat = useServerFn(setLexiconCategory);
  const resetCat = useServerFn(resetLexiconCategory);

  const [lex, setLex] = useState<Lex | null>(null);
  const [defaults, setDefaults] = useState<Lex | null>(null);
  const [dirty, setDirty] = useState<Record<Cat, boolean>>({} as any);
  const [busy, setBusy] = useState<Cat | null>(null);
  const [drafts, setDrafts] = useState<Record<Cat, string>>({} as any);

  useEffect(() => {
    if (loading) return;
    if (!user || !isBoss) { navigate({ to: "/" }); return; }
    (async () => {
      try {
        const r = await fetchLex();
        setLex(r.lexicon as Lex);
        setDefaults(r.defaults as Lex);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load lexicon");
      }
    })();
  }, [loading, user, isBoss, navigate, fetchLex]);

  const updateItems = (cat: Cat, items: string[]) => {
    setLex((prev) => (prev ? { ...prev, [cat]: items } : prev));
    setDirty((d) => ({ ...d, [cat]: true }));
  };

  const addItem = (cat: Cat) => {
    const draft = (drafts[cat] ?? "").trim();
    if (!draft) return;
    if (cat === "refusal_patterns") {
      try { new RegExp(draft, "gi"); }
      catch { toast.error("Invalid regex"); return; }
    }
    const current = lex?.[cat] ?? [];
    if (current.includes(draft)) { toast.message("Already in the list"); return; }
    updateItems(cat, [...current, draft]);
    setDrafts((d) => ({ ...d, [cat]: "" }));
  };

  const removeItem = (cat: Cat, idx: number) => {
    const current = lex?.[cat] ?? [];
    updateItems(cat, current.filter((_, i) => i !== idx));
  };

  const save = async (cat: Cat) => {
    if (!lex) return;
    setBusy(cat);
    try {
      const r = await saveCat({ data: { category: cat, items: lex[cat] } });
      setLex((prev) => (prev ? { ...prev, [cat]: r.items } : prev));
      setDirty((d) => ({ ...d, [cat]: false }));
      toast.success(`${cat} saved (${r.items.length} item${r.items.length === 1 ? "" : "s"})`);
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const reset = async (cat: Cat) => {
    if (!confirm(`Reset "${cat}" to the built-in defaults?`)) return;
    setBusy(cat);
    try {
      const r = await resetCat({ data: { category: cat } });
      setLex((prev) => (prev ? { ...prev, [cat]: r.items } : prev));
      setDirty((d) => ({ ...d, [cat]: false }));
      toast.success(`${cat} reset to defaults`);
    } catch (e: any) {
      toast.error(e?.message ?? "Reset failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading || !isBoss) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-6 pb-28 md:pb-12 space-y-6">
      <Link to="/boss" className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Boss portal
      </Link>

      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <div className="flex items-center gap-3">
          <Crown className="h-6 w-6" style={{ color: "#ffd166" }} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
              0G · Swear Lexicon
            </p>
            <h1 className="syndicate-header text-2xl md:text-3xl text-white/95">Profanity Rules Editor</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/65 max-w-2xl">
          Edit the HEAVY / MID / SOFT swear lists, refusal patterns, brutal openers and inline fillers
          used by the priority swearing override. Changes apply to every chat surface immediately —
          no code deploy required.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-amber-200/80">
          <ShieldAlert className="h-3.5 w-3.5" />
          Boss / admin only · changes are instant and global
        </div>
      </header>

      {!lex ? (
        <p className="py-10 text-center text-sm text-white/55">Loading lexicon…</p>
      ) : (
        <div className="grid gap-4">
          {CATS.map((c) => {
            const items = lex[c.key] ?? [];
            const def = defaults?.[c.key] ?? [];
            const isDirty = !!dirty[c.key];
            return (
              <section key={c.key} className="glass-obsidian-cmd rounded-3xl p-5 md:p-6" style={{ borderColor: `${c.tint}55` }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="syndicate-header text-lg" style={{ color: c.tint }}>{c.label}</h2>
                    <p className="mt-1 text-[12px] text-white/60 max-w-xl">{c.blurb}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/40">
                      {items.length} item{items.length === 1 ? "" : "s"} · default {def.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => reset(c.key)}
                      disabled={busy === c.key}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] font-bold text-white/80 hover:border-white/40 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </button>
                    <button
                      onClick={() => save(c.key)}
                      disabled={!isDirty || busy === c.key}
                      className="inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] font-bold disabled:opacity-50"
                      style={{
                        borderColor: isDirty ? c.tint : "rgba(255,255,255,0.15)",
                        color: isDirty ? c.tint : "rgba(255,255,255,0.6)",
                        background: isDirty ? `${c.tint}1a` : "transparent",
                      }}
                    >
                      {busy === c.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {isDirty ? "Save changes" : "Saved"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {items.length === 0 ? (
                    <p className="text-[12px] text-white/40 italic">List is empty — falls back to built-in defaults at runtime.</p>
                  ) : items.map((item, i) => (
                    <span
                      key={`${c.key}-${i}`}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                      style={{
                        borderColor: `${c.tint}66`,
                        background: `${c.tint}14`,
                        color: "rgba(255,255,255,0.9)",
                        fontFamily: c.key === "refusal_patterns" ? "ui-monospace, monospace" : undefined,
                      }}
                    >
                      <span className="max-w-[420px] truncate" title={item}>{item}</span>
                      <button
                        onClick={() => removeItem(c.key, i)}
                        aria-label={`Remove ${item}`}
                        className="opacity-60 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-stretch gap-2">
                  {c.multiline ? (
                    <textarea
                      value={drafts[c.key] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [c.key]: e.target.value }))}
                      placeholder={c.placeholder}
                      rows={2}
                      className="flex-1 min-w-[240px] rounded-md bg-black/50 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
                      style={{ fontFamily: c.key === "refusal_patterns" ? "ui-monospace, monospace" : undefined }}
                    />
                  ) : (
                    <input
                      value={drafts[c.key] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [c.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(c.key); } }}
                      placeholder={c.placeholder}
                      className="flex-1 min-w-[200px] rounded-md bg-black/50 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
                    />
                  )}
                  <button
                    onClick={() => addItem(c.key)}
                    className="inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-2 text-[11px] uppercase tracking-[0.2em] font-bold"
                    style={{ borderColor: c.tint, color: c.tint, background: `${c.tint}14` }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}