import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ListChecks, Plus, ArrowUpRight, Loader2, CheckCircle2, Circle, Pause, PlayCircle,
  Shield, Zap, Palette, Search, Wrench, PenLine, Clock, Calendar, AlertTriangle,
  ArrowRight, Trash2, NotebookPen, Filter, X, ChevronDown, ChevronUp,
} from "lucide-react";

type Todo = {
  id: string;
  title: string;
  details: string | null;
  category: "security" | "performance" | "ux" | "seo" | "ops" | "content";
  priority: "P0" | "P1" | "P2" | "P3";
  status: "todo" | "in_progress" | "blocked" | "done";
  link: string | null;
  position: number;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

const PRIO_TINT: Record<Todo["priority"], string> = {
  P0: "#ff2e55", P1: "#ff7a1a", P2: "#ffd166", P3: "#94a3b8",
};

const CAT_META: Record<Todo["category"], { tint: string; Icon: typeof Shield; label: string }> = {
  security:    { tint: "#ff5577", Icon: Shield, label: "Security" },
  performance: { tint: "#3ad6ff", Icon: Zap, label: "Performance" },
  ux:          { tint: "#a78bfa", Icon: Palette, label: "UX" },
  seo:         { tint: "#00e08a", Icon: Search, label: "SEO" },
  ops:         { tint: "#ffd166", Icon: Wrench, label: "Ops" },
  content:     { tint: "#ff5acd", Icon: PenLine, label: "Content" },
};

const COLUMNS: { id: Todo["status"]; label: string; Icon: typeof Circle; tint: string }[] = [
  { id: "in_progress", label: "In Progress", Icon: PlayCircle, tint: "#3ad6ff" },
  { id: "todo",        label: "To-Do",       Icon: Circle, tint: "#94a3b8" },
  { id: "blocked",     label: "Blocked",     Icon: Pause, tint: "#ff5577" },
  { id: "done",        label: "Done",        Icon: CheckCircle2, tint: "#00e08a" },
];

export function BossTodoPage() {
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", priority: "P2" as Todo["priority"], category: "ops" as Todo["category"], details: "" });
  const [filterPrio, setFilterPrio] = useState<Todo["priority"] | "all">("all");
  const [filterCat, setFilterCat] = useState<Todo["category"] | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("boss_todos")
      .select("*")
      .order("status", { ascending: true })
      .order("priority", { ascending: true })
      .order("position", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Todo[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("boss_todos")
      .on("postgres_changes", { event: "*", schema: "public", table: "boss_todos" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => items.filter(i =>
    (filterPrio === "all" || i.priority === filterPrio) &&
    (filterCat === "all" || i.category === filterCat)
  ), [items, filterPrio, filterCat]);

  const grouped = useMemo(() => {
    const m: Record<Todo["status"], Todo[]> = { in_progress: [], todo: [], blocked: [], done: [] };
    filtered.forEach(i => m[i.status].push(i));
    return m;
  }, [filtered]);

  async function setStatus(id: string, status: Todo["status"]) {
    const patch: Partial<Todo> = { status };
    if (status === "done") patch.done_at = new Date().toISOString();
    const { error } = await supabase.from("boss_todos").update(patch).eq("id", id);
    if (error) toast.error(error.message); else toast.success(`Moved to ${status.replace("_", " ")}`);
  }

  async function addTodo() {
    if (!draft.title.trim()) return;
    setAdding(true);
    const maxPos = Math.max(0, ...items.map(i => i.position));
    const { error } = await supabase.from("boss_todos").insert({
      title: draft.title.trim(),
      details: draft.details.trim() || null,
      priority: draft.priority,
      category: draft.category,
      status: "todo",
      position: maxPos + 10,
    });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    setDraft({ title: "", priority: "P2", category: "ops", details: "" });
    toast.success("Note added");
  }

  const openCount = items.filter(i => i.status !== "done").length;
  const openP0P1 = items.filter(i => i.status !== "done" && (i.priority === "P0" || i.priority === "P1")).length;
  const hasFilters = filterPrio !== "all" || filterCat !== "all";

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-obsidian-cmd rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-300 grid place-items-center text-black shadow-lg ring-4 ring-amber-500/20">
            <NotebookPen className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <span className="inline-block text-[10px] uppercase tracking-[0.4em] font-black px-2 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-700/40 mb-1">
              Operational Memory
            </span>
            <h2 className="syndicate-header text-lg text-white/95">Boss Notes</h2>
            <p className="text-xs text-white/55 leading-relaxed max-w-xl">
              A living board for follow-ups, blockers, and operational reminders.
              Items sync in real time across all boss sessions.
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap gap-3 pt-3 border-t border-white/5">
          <StatPill icon={ListChecks} label={`${openCount} open`} tint="#94a3b8" />
          {openP0P1 > 0 && (
            <StatPill icon={AlertTriangle} label={`${openP0P1} urgent (P0/P1)`} tint="#ff2e55" />
          )}
          <StatPill icon={CheckCircle2} label={`${items.filter(i => i.status === "done").length} done`} tint="#00e08a" />
          <StatPill icon={Pause} label={`${items.filter(i => i.status === "blocked").length} blocked`} tint="#ff5577" />
        </div>
      </div>

      {/* Add form */}
      <div className="glass-obsidian-cmd rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-amber-400" />
          <h3 className="text-xs uppercase tracking-[0.3em] font-black text-white/80">Add a Note</h3>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="What needs doing?"
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:border-amber-500/50"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTodo(); } }}
            />
            <select
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value as Todo["priority"] })}
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-2.5 text-sm text-white focus-visible:outline-none focus-visible:border-amber-500/50"
            >
              {(["P0","P1","P2","P3"] as const).map(p => (
                <option key={p} value={p} style={{ color: PRIO_TINT[p] }}>{p} — {p === "P0" ? "Critical" : p === "P1" ? "High" : p === "P2" ? "Normal" : "Low"}</option>
              ))}
            </select>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as Todo["category"] })}
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-2.5 text-sm text-white focus-visible:outline-none focus-visible:border-amber-500/50"
            >
              {(Object.keys(CAT_META) as Todo["category"][]).map(c => (
                <option key={c} value={c}>{CAT_META[c].label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={draft.details}
            onChange={(e) => setDraft({ ...draft, details: e.target.value })}
            placeholder="Optional details, context, or links…"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:border-amber-500/50 resize-y"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-white/40">
              Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/60 font-mono text-[10px]">Enter</kbd> from the title field to quick-add.
            </span>
            <button
              onClick={addTodo}
              disabled={adding || !draft.title.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 px-4 py-2 text-sm font-bold text-black transition-colors"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Note
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterOpen(o => !o)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${filterOpen || hasFilters ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {hasFilters && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black">!</span>}
          {filterOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {hasFilters && (
          <button
            onClick={() => { setFilterPrio("all"); setFilterCat("all"); }}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 transition"
          >
            <X className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {filterOpen && (
        <div className="glass-obsidian-cmd rounded-2xl p-4 space-y-3">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Priority</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={filterPrio === "all"} onClick={() => setFilterPrio("all")}>All</FilterChip>
              {(["P0","P1","P2","P3"] as const).map(p => (
                <FilterChip key={p} active={filterPrio === p} tint={PRIO_TINT[p]} onClick={() => setFilterPrio(p)}>
                  {p}
                </FilterChip>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Category</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={filterCat === "all"} onClick={() => setFilterCat("all")}>All</FilterChip>
              {(Object.keys(CAT_META) as Todo["category"][]).map(c => {
                const { Icon, tint, label } = CAT_META[c];
                return (
                  <FilterChip key={c} active={filterCat === c} tint={tint} onClick={() => setFilterCat(c)}>
                    <Icon className="h-3 w-3" /> {label}
                  </FilterChip>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-white/50 py-12">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(({ id, label, Icon, tint }) => (
            <section key={id} className="glass-obsidian-cmd rounded-2xl p-4 flex flex-col min-h-[240px]">
              <header className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: tint }} />
                  <h3 className="text-xs uppercase tracking-[0.2em] font-black text-white/80">{label}</h3>
                </div>
                <span
                  className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black"
                  style={{ background: `${tint}22`, color: tint }}
                >
                  {grouped[id].length}
                </span>
              </header>
              <ul className="space-y-2.5 flex-1">
                {grouped[id].map(item => (
                  <TodoCard key={item.id} item={item} onStatus={setStatus} fmtDate={fmtDate} />
                ))}
                {grouped[id].length === 0 && (
                  <li className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-8 text-center">
                    <Icon className="h-5 w-5 text-white/20" />
                    <span className="text-xs text-white/30 font-medium">Nothing here</span>
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, tint, onClick, children }: { active?: boolean; tint?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${active ? "border-foreground/40 bg-foreground/10" : "border-white/10 bg-transparent hover:bg-white/5"}`}
      style={tint && active ? { color: tint, borderColor: `${tint}66`, background: `${tint}15` } : undefined}>
      {children}
    </button>
  );
}

function TodoCard({ item, onStatus, fmtDate }: { item: Todo; onStatus: (id: string, s: Todo["status"]) => void; fmtDate: (iso: string | null) => string }) {
  const [open, setOpen] = useState(false);
  const { Icon: CatIcon, tint: catTint } = CAT_META[item.category];
  const nextStatuses = COLUMNS.filter(c => c.id !== item.status);

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.05]">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: PRIO_TINT[item.priority] }}
          title={`Priority ${item.priority}`}
        />
        <div className="flex-1 min-w-0 space-y-1.5">
          <button onClick={() => setOpen(o => !o)} className="block w-full text-left">
            <p className="text-sm font-medium text-white/90 leading-snug">{item.title}</p>
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ borderColor: `${PRIO_TINT[item.priority]}44`, color: PRIO_TINT[item.priority], background: `${PRIO_TINT[item.priority]}12` }}
            >
              {item.priority}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ borderColor: `${catTint}44`, color: catTint, background: `${catTint}12` }}
            >
              <CatIcon className="h-2.5 w-2.5" /> {CAT_META[item.category].label}
            </span>
            {item.link && (
              <Link to={item.link} className="inline-flex items-center gap-0.5 text-[10px] text-white/40 hover:text-white/70 transition">
                open <ArrowUpRight className="h-2.5 w-2.5" />
              </Link>
            )}
          </div>

          {open && (
            <div className="space-y-2 pt-1">
              {item.details && (
                <p className="whitespace-pre-wrap text-xs text-white/50 leading-relaxed bg-black/20 rounded-lg p-2.5">
                  {item.details}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-white/30 inline-flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  {fmtDate(item.created_at)}
                </span>
                {item.done_at && (
                  <span className="text-[10px] text-emerald-400/60 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {fmtDate(item.done_at)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {nextStatuses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onStatus(item.id, c.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white/90 transition"
                  >
                    <ArrowRight className="h-2.5 w-2.5" />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** Inline stat pill for the header strip. */
function StatPill({ icon: Icon, label, tint }: { icon: any; label: string; tint: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
      style={{ borderColor: `${tint}55`, color: tint, background: `${tint}1a` }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
