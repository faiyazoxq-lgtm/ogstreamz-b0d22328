import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListChecks, Plus, Loader2, Check, ArrowUpRight, X, CalendarClock } from "lucide-react";

type Todo = {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status: "todo" | "in_progress" | "blocked" | "done";
  position: number;
  category: string | null;
  due_at: string | null;
};

const PRIO_TINT: Record<Todo["priority"], string> = {
  P0: "#ff2e55",
  P1: "#ff7a1a",
  P2: "#ffd166",
  P3: "#94a3b8",
};

const PRIO_ORDER: Record<Todo["priority"], number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

// Quick-add categories. `ops` matches the existing table default so the
// Boss notepad keeps backward-compatible behaviour when nothing is picked.
const CATEGORIES = ["ops", "content", "growth"] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_TINT: Record<Category, string> = {
  ops: "#60a5fa",      // blue — operational / infra
  content: "#a78bfa",  // violet — creative / content
  growth: "#34d399",   // green — growth / acquisition
};

/**
 * Compact boss-only notepad widget for the home page.
 *
 * - Quick-add input (auto-defaults to P2 / ops via the table defaults)
 * - Lists open items (todo + in_progress + blocked) sorted by priority then
 *   position, capped at 8 — the deck at /boss/todo handles the full board
 * - One-tap "done" toggle
 * - Backed by the existing `boss_todos` table; admin-only RLS already gates
 *   reads/writes to bosses
 */
export function BossTodoNotepad() {
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // Category for the next quick-add. Persists across submits so power-user
  // bulk-entry stays fast (pick once, then enter, enter, enter).
  const [draftCategory, setDraftCategory] = useState<Category>("ops");
  // Optional due date for the next quick-add. Stored as a `YYYY-MM-DD`
  // string from <input type="date">; cleared after each successful save so
  // it doesn't silently stick to later notes.
  const [draftDue, setDraftDue] = useState<string>("");
  // List filter — `all` shows every category. Independent of draftCategory
  // so you can be filtering Growth while logging an Ops note.
  const [filter, setFilter] = useState<Category | "all">("all");

  async function load() {
    const { data, error } = await supabase
      .from("boss_todos")
      .select("id,title,priority,status,position,category,due_at")
      .neq("status", "done")
      .order("position", { ascending: true })
      .limit(80);
    if (error) {
      console.warn("[boss-todo-notepad] load failed", error.message);
      setLoading(false);
      return;
    }
    const sorted = (data as Todo[])
      .sort((a, b) => {
        const pa = PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];
        return pa !== 0 ? pa : a.position - b.position;
      });
    setItems(sorted);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title || saving) return;
    setSaving(true);
    const nextPos = (items.at(-1)?.position ?? 0) + 1;
    // Treat a date-only input as end-of-day local so "due today" stays
    // valid until midnight instead of flipping to overdue at 00:00.
    const dueIso = draftDue
      ? new Date(`${draftDue}T23:59:59`).toISOString()
      : null;
    const { error } = await supabase
      .from("boss_todos")
      .insert({
        title,
        priority: "P2",
        category: draftCategory,
        status: "todo",
        position: nextPos,
        due_at: dueIso,
      });
    setSaving(false);
    if (error) {
      toast.error("Could not add", { description: error.message });
      return;
    }
    setDraft("");
    setDraftDue("");
    void load();
  }

  async function complete(id: string) {
    // Optimistic remove; revert on error.
    const prev = items;
    setItems((cur) => cur.filter((t) => t.id !== id));
    const { error } = await supabase
      .from("boss_todos")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("Could not complete", { description: error.message });
    }
  }

  async function remove(id: string) {
    const prev = items;
    setItems((cur) => cur.filter((t) => t.id !== id));
    const { error } = await supabase.from("boss_todos").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("Could not delete", { description: error.message });
    }
  }

  // Apply the active category filter, then cap at 8 (matches old visual
  // density). Filtering happens client-side so toggling chips is instant.
  const visible = (filter === "all"
    ? items
    : items.filter((t) => (t.category ?? "ops") === filter)
  ).slice(0, 8);

  return (
    <section
      aria-label="Boss notepad"
      className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 mt-3"
    >
      <div
        className="overflow-hidden rounded-xl border border-[oklch(0.72_0.22_245/0.35)] shadow-[0_0_30px_-12px_oklch(0.72_0.22_245/0.6)]"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
          <ListChecks className="h-4 w-4" style={{ color: "var(--gold, #f4c869)" }} />
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/85">
            Boss notepad
          </h2>
          <span className="text-[10px] text-white/40">
            {loading ? "…" : `${visible.length}/${items.length} open`}
          </span>
          <Link
            to="/boss/todo"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/60 hover:text-white"
          >
            Full board <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Filter chips — active chip is brighter, others muted. Counts
            include hidden items so you can see how much each bucket holds. */}
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <FilterChip
            label="all"
            active={filter === "all"}
            count={items.length}
            tint="#ffffff"
            onClick={() => setFilter("all")}
          />
          {CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={filter === c}
              count={items.filter((t) => (t.category ?? "ops") === c).length}
              tint={CAT_TINT[c]}
              onClick={() => setFilter(c)}
            />
          ))}
        </div>

        {/* Quick add */}
        <form
          onSubmit={add}
          className="flex items-center gap-2 border-b border-white/10 px-3 py-2"
        >
          <Plus className="h-3.5 w-3.5 text-white/40" />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Quick note… (Enter to save)"
            maxLength={200}
            disabled={saving}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          {/* Optional due date. Native date input keeps the row compact
              and gives free keyboard / picker support across platforms. */}
          <input
            type="date"
            value={draftDue}
            onChange={(e) => setDraftDue(e.target.value)}
            disabled={saving}
            aria-label="Quick add due date"
            className="rounded border border-white/15 bg-black/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70 focus:outline-none [color-scheme:dark]"
          />
          {/* Category for the next quick-add. Plain <select> for keyboard
              + screen-reader support; visually styled to match the row. */}
          <select
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value as Category)}
            disabled={saving}
            aria-label="Quick add category"
            className="rounded border border-white/15 bg-black/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80 focus:outline-none"
            style={{ color: CAT_TINT[draftCategory] }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} style={{ color: "#000" }}>
                {c}
              </option>
            ))}
          </select>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />}
        </form>

        {/* List */}
        <ul className="divide-y divide-white/5">
          {loading && (
            <li className="flex items-center justify-center px-3 py-4 text-xs text-white/40">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading…
            </li>
          )}
          {!loading && visible.length === 0 && (
            <li className="px-3 py-4 text-center text-xs text-white/40">
              {items.length === 0
                ? "All clear. Add a note above."
                : `No open ${filter} items.`}
            </li>
          )}
          {!loading &&
            visible.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-2 px-3 py-2 transition hover:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => complete(t.id)}
                  aria-label={`Mark "${t.title}" done`}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/25 transition hover:border-white hover:bg-white/10"
                >
                  <Check className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                </button>
                <span
                  className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
                  style={{
                    background: `${PRIO_TINT[t.priority]}22`,
                    color: PRIO_TINT[t.priority],
                  }}
                >
                  {t.priority}
                </span>
                {/* Category dot — silent visual cue that scans faster than
                    a text label and keeps the row narrow. */}
                {(() => {
                  const cat = (t.category ?? "ops") as string;
                  const tint = (CAT_TINT as Record<string, string>)[cat] ?? "#64748b";
                  return (
                    <span
                      aria-label={`Category ${cat}`}
                      title={cat}
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: tint }}
                    />
                  );
                })()}
                <span className="min-w-0 flex-1 truncate text-sm text-white/90">
                  {t.title}
                </span>
                {/* Due date pill — overdue items pulse red, "today" amber,
                    everything else muted. Hidden when no due date is set. */}
                {t.due_at && <DueBadge dueIso={t.due_at} />}
                {t.status !== "todo" && (
                  <span className="flex-shrink-0 text-[9px] uppercase tracking-widest text-white/40">
                    {t.status === "in_progress" ? "wip" : t.status}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label={`Delete "${t.title}"`}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-white/30 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}

export default BossTodoNotepad;

function FilterChip({
  label,
  count,
  active,
  tint,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition"
      style={{
        borderColor: active ? `${tint}aa` : "rgba(255,255,255,0.12)",
        background: active ? `${tint}22` : "transparent",
        color: active ? tint : "rgba(255,255,255,0.55)",
      }}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}

/**
 * Compact pill that renders a relative due date and tints itself by urgency:
 * - Overdue → red with a soft pulse
 * - Today   → amber
 * - Future  → muted neutral
 */
function DueBadge({ dueIso }: { dueIso: string }) {
  const due = new Date(dueIso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const dayDiff = Math.round((startOfDue - startOfToday) / 86_400_000);

  const overdue = due.getTime() < now.getTime();
  const today = !overdue && dayDiff === 0;

  const label =
    overdue
      ? dayDiff === 0
        ? "overdue"
        : `${Math.abs(dayDiff)}d late`
      : today
        ? "today"
        : dayDiff === 1
          ? "tomorrow"
          : dayDiff < 7
            ? `${dayDiff}d`
            : due.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const tint = overdue ? "#ff2e55" : today ? "#ffd166" : "#94a3b8";

  return (
    <span
      title={due.toLocaleString()}
      className={`flex-shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${overdue ? "animate-pulse" : ""}`}
      style={{ background: `${tint}22`, color: tint }}
    >
      <CalendarClock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}