import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListChecks, Plus, ArrowUpRight, Loader2, CheckCircle2, Circle, Pause, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/boss/todo")({
  head: () => ({ meta: [{ title: "Boss To-Do · 0G-STREAMZ" }] }),
  component: BossTodoPage,
});

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
};

const PRIO_TINT: Record<Todo["priority"], string> = {
  P0: "#ff2e55", P1: "#ff7a1a", P2: "#ffd166", P3: "#94a3b8",
};
const CAT_TINT: Record<Todo["category"], string> = {
  security: "#ff5577", performance: "#3ad6ff", ux: "#a78bfa",
  seo: "#00e08a", ops: "#ffd166", content: "#ff5acd",
};
const COLUMNS: { id: Todo["status"]; label: string; Icon: typeof Circle }[] = [
  { id: "in_progress", label: "In progress", Icon: PlayCircle },
  { id: "todo",        label: "To-Do",       Icon: Circle },
  { id: "blocked",     label: "Blocked",     Icon: Pause },
  { id: "done",        label: "Done",        Icon: CheckCircle2 },
];

function BossTodoPage() {
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", priority: "P2" as Todo["priority"], category: "ops" as Todo["category"] });
  const [filterPrio, setFilterPrio] = useState<Todo["priority"] | "all">("all");
  const [filterCat, setFilterCat] = useState<Todo["category"] | "all">("all");

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
      priority: draft.priority,
      category: draft.category,
      status: "todo",
      position: maxPos + 10,
    });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    setDraft({ title: "", priority: "P2", category: "ops" });
    toast.success("Added");
  }

  const openP0P1 = items.filter(i => i.status !== "done" && (i.priority === "P0" || i.priority === "P1")).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ListChecks className="h-6 w-6" style={{ color: "#ffd166" }} />
            <div>
              <h1 className="text-2xl font-bold">Boss To-Do</h1>
              <p className="text-sm text-muted-foreground">{openP0P1} open P0/P1 · {items.filter(i => i.status !== "done").length} open total</p>
            </div>
          </div>
          <Link to="/boss/overview" className="text-sm text-muted-foreground hover:text-foreground">← Boss overview</Link>
        </header>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Chip active={filterPrio === "all"} onClick={() => setFilterPrio("all")}>All priority</Chip>
          {(["P0","P1","P2","P3"] as const).map(p => (
            <Chip key={p} active={filterPrio === p} tint={PRIO_TINT[p]} onClick={() => setFilterPrio(p)}>{p}</Chip>
          ))}
          <span className="mx-2 self-center text-muted-foreground">·</span>
          <Chip active={filterCat === "all"} onClick={() => setFilterCat("all")}>All categories</Chip>
          {(Object.keys(CAT_TINT) as Todo["category"][]).map(c => (
            <Chip key={c} active={filterCat === c} tint={CAT_TINT[c]} onClick={() => setFilterCat(c)}>{c}</Chip>
          ))}
        </div>

        {/* Add */}
        <div className="mb-6 rounded-lg border border-border bg-card/40 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="New job…"
              className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }}
            />
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Todo["priority"] })}
                    className="rounded-md border border-border bg-background px-2 py-2 text-sm">
              {(["P0","P1","P2","P3"] as const).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Todo["category"] })}
                    className="rounded-md border border-border bg-background px-2 py-2 text-sm">
              {(Object.keys(CAT_TINT) as Todo["category"][]).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={addTodo} disabled={adding || !draft.title.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map(({ id, label, Icon }) => (
              <section key={id} className="rounded-lg border border-border bg-card/30 p-3">
                <header className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" /> {label}</h2>
                  <span className="text-xs text-muted-foreground">{grouped[id].length}</span>
                </header>
                <ul className="space-y-2">
                  {grouped[id].map(item => (
                    <TodoCard key={item.id} item={item} onStatus={setStatus} />
                  ))}
                  {grouped[id].length === 0 && (
                    <li className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">empty</li>
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ active, tint, onClick, children }: { active?: boolean; tint?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-2.5 py-1 transition ${active ? "border-foreground/60 bg-foreground/10" : "border-border bg-transparent hover:bg-foreground/5"}`}
      style={tint && active ? { color: tint, borderColor: tint } : undefined}>
      {children}
    </button>
  );
}

function TodoCard({ item, onStatus }: { item: Todo; onStatus: (id: string, s: Todo["status"]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-md border border-border bg-background/60 p-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: PRIO_TINT[item.priority] }} aria-label={item.priority} />
        <div className="flex-1 min-w-0">
          <button onClick={() => setOpen(o => !o)} className="block w-full text-left text-sm font-medium leading-snug">
            {item.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide">
            <span className="rounded px-1.5 py-0.5" style={{ background: `${PRIO_TINT[item.priority]}22`, color: PRIO_TINT[item.priority] }}>{item.priority}</span>
            <span className="rounded px-1.5 py-0.5" style={{ background: `${CAT_TINT[item.category]}22`, color: CAT_TINT[item.category] }}>{item.category}</span>
            {item.link && (
              <Link to={item.link} className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
                open <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {open && (
            <div className="mt-2 space-y-2">
              {item.details && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{item.details}</p>}
              <div className="flex flex-wrap gap-1">
                {COLUMNS.filter(c => c.id !== item.status).map(c => (
                  <button key={c.id} onClick={() => onStatus(item.id, c.id)}
                          className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-foreground/10">
                    → {c.label}
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