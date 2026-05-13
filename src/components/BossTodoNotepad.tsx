import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ListChecks, Plus, Loader2, Check, ArrowUpRight, X, CalendarClock,
  RefreshCw, Sheet as SheetIcon, Link2, DownloadCloud,
} from "lucide-react";
import {
  gsheetsStatus, gsheetsConnect, gsheetsPush, gsheetsPull,
  gsheetsUpsertOne, gsheetsRemoveOne,
} from "@/lib/boss-gsheets.functions";

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
  // Inline edit state — `editingId` is the row currently in edit mode and
  // `editDraft` is the working title. Single-row at a time keeps the UX
  // simple and avoids juggling a map of drafts.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Google Sheets sync state. `syncState` drives the status pill colour:
  //   idle   — connected and quiet
  //   busy   — push or pull in flight
  //   error  — last operation failed (hover for details via toast)
  //   off    — not yet linked to a sheet
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetConnected, setSheetConnected] = useState(false);
  const [syncState, setSyncState] = useState<"off" | "idle" | "busy" | "error">("off");
  const [lastPullAt, setLastPullAt] = useState<string | null>(null);
  const [lastPushAt, setLastPushAt] = useState<string | null>(null);
  const [lastPullInserted, setLastPullInserted] = useState(0);
  const [lastPullUpdated, setLastPullUpdated] = useState(0);
  const [lastPushCount, setLastPushCount] = useState(0);
  const [pendingPush, setPendingPush] = useState(0);
  const statusFn = useServerFn(gsheetsStatus);
  const connectFn = useServerFn(gsheetsConnect);
  const pushFn = useServerFn(gsheetsPush);
  const pullFn = useServerFn(gsheetsPull);
  const upsertOneFn = useServerFn(gsheetsUpsertOne);
  const removeOneFn = useServerFn(gsheetsRemoveOne);
  // Debounce pushes so a burst of edits collapses into one Sheets write.
  const pushTimer = useRef<number | null>(null);

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

  // Initial sync probe: see if a sheet is already linked, then pull once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await statusFn();
        if (cancelled) return;
        setSheetUrl(s.sheetUrl ?? null);
        setSheetConnected(s.connected);
        setLastPullAt(s.lastPullAt ?? null);
        setLastPushAt((s as any).lastPushAt ?? null);
        setLastPullInserted((s as any).lastPullInserted ?? 0);
        setLastPullUpdated((s as any).lastPullUpdated ?? 0);
        setLastPushCount((s as any).lastPushCount ?? 0);
        setPendingPush((s as any).pendingPush ?? 0);
        setSyncState(s.connected ? (s.healthy ? "idle" : "error") : "off");
        if (s.connected && s.healthy) {
          await pullFn();
          // Refresh metrics after the initial pull
          const s2: any = await statusFn();
          setLastPullAt(s2.lastPullAt ?? null);
          setLastPushAt(s2.lastPushAt ?? null);
          setLastPullInserted(s2.lastPullInserted ?? 0);
          setLastPullUpdated(s2.lastPullUpdated ?? 0);
          setLastPushCount(s2.lastPushCount ?? 0);
          setPendingPush(s2.pendingPush ?? 0);
          await load();
        }
      } catch {
        if (!cancelled) setSyncState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background pull every 60s while the notepad is mounted. Skipped when a
  // sheet isn't linked or another op is in flight.
  useEffect(() => {
    if (!sheetConnected) return;
    const id = window.setInterval(async () => {
      if (syncState === "busy") return;
      try {
        setSyncState("busy");
        const r = await pullFn();
        setLastPullAt(r.lastPullAt);
        setLastPullInserted(r.inserted ?? 0);
        setLastPullUpdated(r.updated ?? 0);
        setSyncState("idle");
        if (r.updated > 0 || r.inserted > 0) await load();
        // Refresh pending-push count after reconcile
        try {
          const s3: any = await statusFn();
          setPendingPush(s3.pendingPush ?? 0);
        } catch { /* ignore */ }
      } catch {
        setSyncState("error");
      }
    }, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetConnected]);

  /** Push a single affected row to the sheet (incremental). Falls back to
   *  silent no-op when sheet isn't linked yet. */
  const pushRow = useCallback(async (id: string) => {
    if (!sheetConnected) return;
    try {
      setSyncState("busy");
      const r: any = await upsertOneFn({ data: { id } });
      setLastPushAt(r?.lastPushAt ?? new Date().toISOString());
      setLastPushCount(1);
      setPendingPush(0);
      setSyncState("idle");
    } catch {
      setSyncState("error");
    }
  }, [sheetConnected, upsertOneFn]);

  const removeRow = useCallback(async (id: string) => {
    if (!sheetConnected) return;
    try {
      setSyncState("busy");
      const r: any = await removeOneFn({ data: { id } });
      setLastPushAt(r?.lastPushAt ?? new Date().toISOString());
      setLastPushCount(r?.removed ? 1 : 0);
      setPendingPush(0);
      setSyncState("idle");
    } catch {
      setSyncState("error");
    }
  }, [sheetConnected, removeOneFn]);

  // Keep the legacy debounce timer cleanup so we don't leak on unmount.
  useEffect(() => () => { if (pushTimer.current) window.clearTimeout(pushTimer.current); }, []);

  async function connectSheet() {
    try {
      setSyncState("busy");
      const r = await connectFn();
      setSheetUrl(r.sheetUrl ?? null);
      setSheetConnected(true);
      // Seed the sheet with the current notepad.
      await pushFn();
      setSyncState("idle");
      toast.success("Notepad linked to Google Sheets");
    } catch (e: any) {
      setSyncState("error");
      toast.error("Could not link sheet", { description: e?.message });
    }
  }

  async function syncNow() {
    try {
      setSyncState("busy");
      const p: any = await pushFn();
      setLastPushAt(p?.lastPushAt ?? new Date().toISOString());
      setLastPushCount(p?.pushed ?? 0);
      setPendingPush(0);
      const r = await pullFn();
      setLastPullAt(r.lastPullAt);
      setLastPullInserted(r.inserted ?? 0);
      setLastPullUpdated(r.updated ?? 0);
      setSyncState("idle");
      await load();
      toast.success("Synced with Google Sheets");
    } catch (e: any) {
      setSyncState("error");
      toast.error("Sync failed", { description: e?.message });
    }
  }

  // Lightweight: re-read the sync status row from the server without
  // triggering a push or a pull. Used by the manual "Refresh status"
  // button in the header so the boss can confirm the latest pull/push
  // metrics + pending-push count on demand.
  async function refreshStatus() {
    try {
      setSyncState("busy");
      const s: any = await statusFn();
      setSheetUrl(s.sheetUrl ?? null);
      setSheetConnected(s.connected);
      setLastPullAt(s.lastPullAt ?? null);
      setLastPushAt(s.lastPushAt ?? null);
      setLastPullInserted(s.lastPullInserted ?? 0);
      setLastPullUpdated(s.lastPullUpdated ?? 0);
      setLastPushCount(s.lastPushCount ?? 0);
      setPendingPush(s.pendingPush ?? 0);
      setSyncState(s.connected ? (s.healthy ? "idle" : "error") : "off");
      toast.success("Sync status refreshed");
    } catch (e: any) {
      setSyncState("error");
      toast.error("Could not refresh status", { description: e?.message });
    }
  }

  // Manual pull — forces an immediate read from the sheet and reconciles
  // into the DB. Distinct from `refreshStatus` (metrics-only) and
  // `syncNow` (push + pull). Used by the "Pull now" button so the boss
  // can force-fetch the latest sheet edits without waiting for the 60s
  // background poll.
  async function pullNow() {
    if (!sheetConnected) return;
    try {
      setSyncState("busy");
      const r: any = await pullFn();
      setLastPullAt(r.lastPullAt);
      setLastPullInserted(r.inserted ?? 0);
      setLastPullUpdated(r.updated ?? 0);
      // Refresh pending-push count after reconcile.
      try {
        const s: any = await statusFn();
        setPendingPush(s.pendingPush ?? 0);
      } catch { /* ignore */ }
      setSyncState("idle");
      await load();
      const changed = (r.inserted ?? 0) + (r.updated ?? 0);
      toast.success(
        changed > 0
          ? `Pulled ${r.inserted ?? 0} new · ${r.updated ?? 0} updated`
          : "Pulled — no changes",
      );
    } catch (e: any) {
      setSyncState("error");
      toast.error("Pull failed", { description: e?.message });
    }
  }

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
    const { data: inserted, error } = await supabase
      .from("boss_todos")
      .insert({
        title,
        priority: "P2",
        category: draftCategory,
        status: "todo",
        position: nextPos,
        due_at: dueIso,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error("Could not add", { description: error.message });
      return;
    }
    setDraft("");
    setDraftDue("");
    void load();
    if (inserted?.id) void pushRow(inserted.id as string);
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
      return;
    }
    void removeRow(id);
  }

  async function remove(id: string) {
    const prev = items;
    setItems((cur) => cur.filter((t) => t.id !== id));
    const { error } = await supabase.from("boss_todos").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("Could not delete", { description: error.message });
      return;
    }
    void removeRow(id);
  }

  function startEdit(t: Todo) {
    setEditingId(t.id);
    setEditDraft(t.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(id: string) {
    const next = editDraft.trim();
    const current = items.find((t) => t.id === id);
    if (!current) return cancelEdit();
    if (!next || next === current.title) return cancelEdit();
    setEditSaving(true);
    // Optimistic — revert the title on error.
    const prev = items;
    setItems((cur) => cur.map((t) => (t.id === id ? { ...t, title: next } : t)));
    const { error } = await supabase
      .from("boss_todos")
      .update({ title: next })
      .eq("id", id);
    setEditSaving(false);
    cancelEdit();
    if (error) {
      setItems(prev);
      toast.error("Could not rename", { description: error.message });
      return;
    }
    void pushRow(id);
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
          <SyncPill
            state={syncState}
            connected={sheetConnected}
            sheetUrl={sheetUrl}
            lastPullAt={lastPullAt}
            lastPushAt={lastPushAt}
            lastPullInserted={lastPullInserted}
            lastPullUpdated={lastPullUpdated}
            lastPushCount={lastPushCount}
            pendingPush={pendingPush}
            onConnect={connectSheet}
            onSync={syncNow}
          />
          <Link
            to="/boss/todo"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/60 hover:text-white"
          >
            Full board <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Sync metrics — last pull/push timestamps + breakdown */}
        {sheetConnected && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-3 py-1.5 text-[9px] uppercase tracking-wider text-white/55">
            <span title={lastPullAt ? new Date(lastPullAt).toLocaleString() : "Never"}>
              <span className="text-white/35">Pull</span>{" "}
              <span className="text-emerald-300/90">
                {lastPullAt ? relTime(lastPullAt) : "never"}
              </span>
              <span className="ml-1 text-white/40">
                · +{lastPullInserted} new · ↻{lastPullUpdated} upd
              </span>
            </span>
            <span className="text-white/20">|</span>
            <span title={lastPushAt ? new Date(lastPushAt).toLocaleString() : "Never"}>
              <span className="text-white/35">Push</span>{" "}
              <span className="text-cyan-300/90">
                {lastPushAt ? relTime(lastPushAt) : "never"}
              </span>
              <span className="ml-1 text-white/40">· {lastPushCount} rows</span>
            </span>
            <span className="text-white/20">|</span>
            <span
              className={pendingPush > 0 ? "text-amber-300" : "text-white/45"}
              title="Local edits not yet pushed to the sheet"
            >
              {pendingPush > 0 ? `↑ ${pendingPush} pending push` : "in sync"}
            </span>
            <button
              type="button"
              onClick={refreshStatus}
              disabled={syncState === "busy"}
              title="Force an immediate pull/push state update"
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${syncState === "busy" ? "animate-spin" : ""}`} />
              Refresh status
            </button>
            <button
              type="button"
              onClick={pullNow}
              disabled={syncState === "busy" || !sheetConnected}
              title="Force an immediate pull of the latest sheet data"
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-300/20 hover:text-emerald-100 disabled:opacity-50"
            >
              <DownloadCloud className={`h-3 w-3 ${syncState === "busy" ? "animate-pulse" : ""}`} />
              Pull now
            </button>
          </div>
        )}

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
                {editingId === t.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={() => void saveEdit(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveEdit(t.id);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    disabled={editSaving}
                    maxLength={200}
                    aria-label="Edit title"
                    className="min-w-0 flex-1 rounded border border-[oklch(0.72_0.22_245/0.6)] bg-black/60 px-1.5 py-0.5 text-sm text-white focus:outline-none focus:border-[oklch(0.72_0.22_245)]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    title="Click to rename"
                    className="min-w-0 flex-1 truncate text-left text-sm text-white/90 hover:text-white focus:outline-none focus-visible:underline focus-visible:decoration-dotted"
                  >
                    {t.title}
                  </button>
                )}
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

/**
 * Compact pill that surfaces the Google Sheets sync state.
 *
 * Shape:
 *   [icon] [label]  [↗ link to sheet]   [⟳ sync now button]
 *
 * States:
 *   off    — no sheet linked → shows a single "Link Sheet" button.
 *   idle   — green dot, last-pull timestamp on hover.
 *   busy   — spinning refresh icon.
 *   error  — red dot, click ⟳ to retry.
 */
function SyncPill({
  state,
  connected,
  sheetUrl,
  lastPullAt,
  lastPushAt,
  pendingPush,
  onConnect,
  onSync,
}: {
  state: "off" | "idle" | "busy" | "error";
  connected: boolean;
  sheetUrl: string | null;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastPullInserted?: number;
  lastPullUpdated?: number;
  lastPushCount?: number;
  pendingPush?: number;
  onConnect: () => void;
  onSync: () => void;
}) {
  if (!connected || state === "off") {
    return (
      <button
        type="button"
        onClick={onConnect}
        title="Create a Google Sheet mirror of this notepad"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-400/20"
      >
        <SheetIcon className="h-3 w-3" /> Link sheet
      </button>
    );
  }

  const dot =
    state === "busy"
      ? "#fbbf24"
      : state === "error"
        ? "#ef4444"
        : "#34d399";

  const label =
    state === "busy"
      ? "syncing"
      : state === "error"
        ? "sync error"
        : (pendingPush ?? 0) > 0
          ? `${pendingPush} to push`
          : lastPullAt
            ? `synced ${relTime(lastPullAt)}`
            : "synced";

  const tipParts: string[] = [];
  if (lastPullAt) tipParts.push(`Last pull: ${new Date(lastPullAt).toLocaleString()}`);
  if (lastPushAt) tipParts.push(`Last push: ${new Date(lastPushAt).toLocaleString()}`);
  const tip = tipParts.join("\n") || "Linked to Google Sheets";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70"
        title={tip}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${state === "busy" ? "animate-pulse" : ""}`}
          style={{ background: dot }}
        />
        {label}
      </span>
      {sheetUrl && (
        <a
          href={sheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open Google Sheet"
          className="inline-flex h-5 w-5 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
        >
          <Link2 className="h-3 w-3" />
        </a>
      )}
      <button
        type="button"
        onClick={onSync}
        disabled={state === "busy"}
        aria-label="Sync now"
        title="Sync now"
        className="inline-flex h-5 w-5 items-center justify-center rounded text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
      >
        <RefreshCw className={`h-3 w-3 ${state === "busy" ? "animate-spin" : ""}`} />
      </button>
    </span>
  );
}

/** Tiny relative-time helper: "12s ago", "5m ago", "2h ago", "3d ago". */
function relTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

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