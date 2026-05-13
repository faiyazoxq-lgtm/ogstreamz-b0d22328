import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListChecks, Plus, Loader2, Check, ArrowUpRight, X } from "lucide-react";

type Todo = {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status: "todo" | "in_progress" | "blocked" | "done";
  position: number;
};

const PRIO_TINT: Record<Todo["priority"], string> = {
  P0: "#ff2e55",
  P1: "#ff7a1a",
  P2: "#ffd166",
  P3: "#94a3b8",
};

const PRIO_ORDER: Record<Todo["priority"], number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

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

  async function load() {
    const { data, error } = await supabase
      .from("boss_todos")
      .select("id,title,priority,status,position")
      .neq("status", "done")
      .order("position", { ascending: true })
      .limit(40);
    if (error) {
      console.warn("[boss-todo-notepad] load failed", error.message);
      setLoading(false);
      return;
    }
    const sorted = (data as Todo[])
      .sort((a, b) => {
        const pa = PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];
        return pa !== 0 ? pa : a.position - b.position;
      })
      .slice(0, 8);
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
    const { error } = await supabase
      .from("boss_todos")
      .insert({ title, priority: "P2", category: "ops", status: "todo", position: nextPos });
    setSaving(false);
    if (error) {
      toast.error("Could not add", { description: error.message });
      return;
    }
    setDraft("");
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
            {loading ? "…" : `${items.length} open`}
          </span>
          <Link
            to="/boss/todo"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/60 hover:text-white"
          >
            Full board <ArrowUpRight className="h-3 w-3" />
          </Link>
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
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />}
        </form>

        {/* List */}
        <ul className="divide-y divide-white/5">
          {loading && (
            <li className="flex items-center justify-center px-3 py-4 text-xs text-white/40">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading…
            </li>
          )}
          {!loading && items.length === 0 && (
            <li className="px-3 py-4 text-center text-xs text-white/40">
              All clear. Add a note above.
            </li>
          )}
          {!loading &&
            items.map((t) => (
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
                <span className="min-w-0 flex-1 truncate text-sm text-white/90">
                  {t.title}
                </span>
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