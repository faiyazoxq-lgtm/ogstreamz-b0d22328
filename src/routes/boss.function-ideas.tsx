import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lightbulb, Loader2, Plus, Save, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireBoss } from "@/lib/route-guards";
import { toast } from "sonner";

export const Route = createFileRoute("/boss/function-ideas")({
  beforeLoad: requireBoss,
  component: FunctionIdeasPage,
  head: () => ({
    meta: [
      { title: "Function Ideas — Boss" },
      { name: "description", content: "Boss-only backlog of plugin and extra-feature ideas to add to the platform." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Idea = {
  id: string;
  title: string;
  summary: string;
  category: string;
  priority: string;
  status: string;
  notes: string;
  link: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ["plugin","automation","analytics","ops","security","money","engagement","ai","other"] as const;
const PRIORITIES = ["P0","P1","P2","P3"] as const;
const STATUSES = ["idea","planned","in_progress","done","parked"] as const;

const STATUS_TONE: Record<string, string> = {
  idea: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  planned: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  in_progress: "border-purple-500/40 bg-purple-500/10 text-purple-200",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  parked: "border-border bg-secondary/40 text-muted-foreground",
};

function FunctionIdeasPage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ title: "", summary: "", category: "plugin", priority: "P2" });

  const { data, isLoading } = useQuery({
    queryKey: ["boss-function-ideas"],
    queryFn: async (): Promise<Idea[]> => {
      const { data, error } = await supabase
        .from("boss_function_ideas")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("boss_function_ideas").insert({
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        category: draft.category,
        priority: draft.priority,
        position: 1000,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Idea added");
      setDraft({ title: "", summary: "", category: "plugin", priority: "P2" });
      qc.invalidateQueries({ queryKey: ["boss-function-ideas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (input: Partial<Idea> & { id: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from("boss_function_ideas").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boss-function-ideas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boss_function_ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["boss-function-ideas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 ring-1 ring-purple-500/40">
            <Lightbulb className="h-5 w-5 text-purple-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="syndicate-header text-2xl text-foreground">Boss Function Ideas</h1>
            <p className="text-sm text-muted-foreground">
              Living backlog of plug-ins and extra functions you might add. Capture every idea the moment it lands —
              edit priority/status as plans evolve. The agent will keep adding suggestions here over time.
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold" /> Add idea
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Title"
            className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
          <div className="flex gap-2">
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-2 text-xs outline-none focus:border-gold/50"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
              className="rounded-md border border-border bg-secondary/40 px-2 py-2 text-xs outline-none focus:border-gold/50"
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <textarea
          value={draft.summary}
          onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          rows={2}
          placeholder="One-line summary of what this would do"
          className="mt-2 w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate()}
            className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25 disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              onSave={(patch) => update.mutateAsync({ id: idea.id, ...patch })}
              onDelete={() => remove.mutate(idea.id)}
            />
          ))}
          {(data?.length ?? 0) === 0 && (
            <li className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No ideas yet. Drop one above.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function IdeaRow({ idea, onSave, onDelete }: { idea: Idea; onSave: (patch: Partial<Idea>) => Promise<unknown>; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(idea);
  const [saving, setSaving] = useState(false);

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-foreground">{idea.title}</span>
            <span className="rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{idea.category}</span>
            <span className="rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-gold">{idea.priority}</span>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[idea.status] ?? STATUS_TONE.idea}`}>
              {idea.status.replace("_", " ")}
            </span>
          </div>
          {idea.summary && <p className="mt-1 text-xs text-muted-foreground">{idea.summary}</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground hover:bg-secondary/80"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
          <textarea
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={2}
            placeholder="Notes / implementation hints"
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs outline-none focus:border-gold/50"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-xs">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-xs">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-xs">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-rose-200 hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave({ title: draft.title, summary: draft.summary, notes: draft.notes, category: draft.category, priority: draft.priority, status: draft.status });
                  setOpen(false);
                } finally { setSaving(false); }
              }}
              className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
          </div>
        </div>
      )}
    </li>
  );
}