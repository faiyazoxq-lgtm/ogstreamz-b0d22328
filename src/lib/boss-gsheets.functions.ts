import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { createClient } from "@supabase/supabase-js";
import {
  createNotepadSheet,
  pingSheet,
  readSheetRows,
  writeAllRows,
  upsertSheetRow,
  removeSheetRow,
  generateEncKeyB64,
  type SheetRow,
} from "./boss-gsheets.server";

/**
 * Boss Notepad ⇄ Google Sheets sync.
 *
 * - All endpoints require an authenticated admin (boss).
 * - The settings row in `boss_settings` is a singleton — first call to
 *   `connectSheet` creates a fresh spreadsheet and stores its ID.
 * - Sync is full-table (rewrite the data range, replay the sheet onto the
 *   DB) because the dataset is tiny and avoids row-index drift.
 * - Conflict resolution is last-write-wins by `updated_at`. The DB trigger
 *   already bumps `updated_at` on every change so client edits always win
 *   over a stale sheet snapshot.
 */

function adminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function assertBoss(userId: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — admin role required");
}

async function loadSettings() {
  const admin = adminClient();
  const { data, error } = await admin
    .from("boss_settings")
    .select("id, gsheet_id, gsheet_url, gsheet_enc_key, gsheet_last_pull_at, gsheet_last_push_at, gsheet_last_pull_inserted, gsheet_last_pull_updated, gsheet_last_push_count")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/**
 * Lazily mint the AES-256-GCM key used to encrypt sheet content. Stored on
 * the singleton `boss_settings` row (admin/service-role only) so we never
 * have to expose it as a build secret. Calls are cheap because the row is
 * only updated when the column is null.
 */
async function ensureEncKey(settingsId: string, current: string | null): Promise<string> {
  if (current && current.length > 16) return current;
  const fresh = generateEncKeyB64();
  const admin = adminClient();
  await admin.from("boss_settings").update({ gsheet_enc_key: fresh }).eq("id", settingsId);
  return fresh;
}

function rowFromTodo(t: any): SheetRow {
  return {
    id: t.id,
    title: t.title ?? "",
    category: t.category ?? "ops",
    priority: t.priority ?? "P2",
    status: t.status ?? "todo",
    due_at: t.due_at ?? null,
    position: t.position ?? 0,
    updated_at: t.updated_at ?? new Date().toISOString(),
  };
}

async function fetchTodoRow(id: string): Promise<SheetRow | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("boss_todos")
    .select("id,title,category,priority,status,due_at,position,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowFromTodo(data);
}

/** Status pill data — connected? sheet URL? last pull time? */
export const gsheetsStatus = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.userId);
    const s = await loadSettings();
    if (!s?.gsheet_id) {
      return {
        connected: false, sheetId: null, sheetUrl: null, healthy: false,
        lastPullAt: null, lastPushAt: null,
        lastPullInserted: 0, lastPullUpdated: 0, lastPushCount: 0,
        pendingPush: 0, openCount: 0,
      };
    }
    const healthy = await pingSheet(s.gsheet_id);
    // Compute live "needs push" count: open todos whose updated_at is newer
    // than synced_at (or never synced).
    const admin = adminClient();
    const { data: openRows } = await admin
      .from("boss_todos")
      .select("updated_at, synced_at")
      .neq("status", "done");
    const open = openRows ?? [];
    const pendingPush = open.reduce((n, r: any) => {
      const u = Date.parse(r.updated_at ?? "");
      const s2 = r.synced_at ? Date.parse(r.synced_at) : 0;
      return n + (Number.isFinite(u) && u > s2 ? 1 : 0);
    }, 0);
    return {
      connected: true,
      sheetId: s.gsheet_id,
      sheetUrl: s.gsheet_url,
      healthy,
      lastPullAt: s.gsheet_last_pull_at,
      lastPushAt: (s as any).gsheet_last_push_at ?? null,
      lastPullInserted: (s as any).gsheet_last_pull_inserted ?? 0,
      lastPullUpdated: (s as any).gsheet_last_pull_updated ?? 0,
      lastPushCount: (s as any).gsheet_last_push_count ?? 0,
      pendingPush,
      openCount: open.length,
    };
  });

/** First-time setup: create a fresh "Boss Notepad" spreadsheet. */
export const gsheetsConnect = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.userId);
    const existing = await loadSettings();
    // If we already have a healthy sheet, just return it (idempotent).
    if (existing?.gsheet_id && (await pingSheet(existing.gsheet_id))) {
      return { sheetId: existing.gsheet_id, sheetUrl: existing.gsheet_url };
    }
    const { id, url } = await createNotepadSheet();
    const admin = adminClient();
    if (existing) {
      await admin
        .from("boss_settings")
        .update({ gsheet_id: id, gsheet_url: url, gsheet_last_pull_at: null })
        .eq("id", existing.id);
    } else {
      await admin
        .from("boss_settings")
        .insert({ gsheet_id: id, gsheet_url: url });
    }
    return { sheetId: id, sheetUrl: url };
  });

/**
 * Push the current open boss_todos to the sheet (full overwrite).
 * "Done" items are excluded — the sheet mirrors the live notepad view.
 */
export const gsheetsPush = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.userId);
    const s = await loadSettings();
    if (!s?.gsheet_id) throw new Error("No sheet linked yet — connect first");
    const key = await ensureEncKey(s.id as string, (s as any).gsheet_enc_key ?? null);
    const admin = adminClient();
    const { data: todos, error } = await admin
      .from("boss_todos")
      .select("id,title,category,priority,status,due_at,position,updated_at")
      .neq("status", "done")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (todos ?? []).map(rowFromTodo);
    await writeAllRows(s.gsheet_id, rows, key);
    const now = new Date().toISOString();
    await admin
      .from("boss_todos")
      .update({ synced_at: now })
      .in("id", rows.map((r) => r.id));
    if (s.id) {
      await admin
        .from("boss_settings")
        .update({ gsheet_last_push_at: now, gsheet_last_push_count: rows.length })
        .eq("id", s.id);
    }
    return { pushed: rows.length, syncedAt: now, lastPushAt: now };
  });

/**
 * Incremental upsert — write a single todo row in-place on the sheet.
 * Called by the notepad UI right after add/edit/complete so we no longer
 * rewrite the entire range for every keystroke.
 */
export const gsheetsUpsertOne = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    await assertBoss(context.userId);
    const s = await loadSettings();
    if (!s?.gsheet_id) return { ok: false, reason: "not_connected" as const };
    const row = await fetchTodoRow(data.id);
    if (!row) {
      // Row is gone (deleted between request + handler) — treat as remove.
      await removeSheetRow(s.gsheet_id, data.id).catch(() => {});
      return { ok: true, removed: true };
    }
    // Mirror the "open todos only" rule used by gsheetsPush.
    if (row.status === "done") {
      await removeSheetRow(s.gsheet_id, data.id).catch(() => {});
      const admin = adminClient();
      await admin.from("boss_todos").update({ synced_at: new Date().toISOString() }).eq("id", data.id);
      return { ok: true, removed: true };
    }
    const key = await ensureEncKey(s.id as string, (s as any).gsheet_enc_key ?? null);
    const result = await upsertSheetRow(s.gsheet_id, row, key);
    const now = new Date().toISOString();
    const admin = adminClient();
    await admin.from("boss_todos").update({ synced_at: now }).eq("id", data.id);
    if (s.id) {
      await admin
        .from("boss_settings")
        .update({ gsheet_last_push_at: now, gsheet_last_push_count: 1 })
        .eq("id", s.id);
    }
    return { ok: true, inserted: result.inserted, rowIndex: result.rowIndex, lastPushAt: now };
  });

/** Incremental delete — clear a single row by id (no full rewrite). */
export const gsheetsRemoveOne = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    await assertBoss(context.userId);
    const s = await loadSettings();
    if (!s?.gsheet_id) return { ok: false, reason: "not_connected" as const };
    const removed = await removeSheetRow(s.gsheet_id, data.id);
    const now = new Date().toISOString();
    if (s.id) {
      const admin = adminClient();
      await admin
        .from("boss_settings")
        .update({ gsheet_last_push_at: now, gsheet_last_push_count: removed ? 1 : 0 })
        .eq("id", s.id);
    }
    return { ok: true, removed, lastPushAt: now };
  });

/**
 * Pull rows from the sheet and reconcile. Last-write-wins by `updated_at`:
 * if the sheet's row is newer than the DB row, we patch the DB; otherwise
 * the sheet row is ignored (the next `gsheetsPush` will overwrite it).
 * Rows present only in the sheet are inserted; rows missing from the
 * sheet are NOT deleted from the DB (the DB is the source of truth for
 * deletes — the user uses the in-app trash icon).
 */
export const gsheetsPull = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.userId);
    const s = await loadSettings();
    if (!s?.gsheet_id) throw new Error("No sheet linked yet — connect first");
    const key = await ensureEncKey(s.id as string, (s as any).gsheet_enc_key ?? null);
    const admin = adminClient();
    const sheetRows = await readSheetRows(s.gsheet_id, key);

    // Pull every open todo so we can compare timestamps.
    const { data: existing, error } = await admin
      .from("boss_todos")
      .select("id, updated_at");
    if (error) throw new Error(error.message);
    const existingMap = new Map((existing ?? []).map((r) => [r.id, r.updated_at as string]));

    const VALID_CAT = new Set(["security", "performance", "ux", "seo", "ops", "content"]);
    const VALID_PRIO = new Set(["P0", "P1", "P2", "P3"]);
    const VALID_STATUS = new Set(["todo", "in_progress", "blocked", "done"]);

    let updated = 0;
    let inserted = 0;
    for (const r of sheetRows) {
      // Sanitize — sheet is human-editable, so guard against typos.
      const safe = {
        title: (r.title || "").slice(0, 200),
        category: VALID_CAT.has(r.category) ? r.category : "ops",
        priority: VALID_PRIO.has(r.priority) ? r.priority : "P2",
        status: VALID_STATUS.has(r.status) ? r.status : "todo",
        due_at: r.due_at && /^\d{4}-\d{2}-\d{2}/.test(r.due_at) ? r.due_at : null,
        position: Number.isFinite(r.position) ? r.position : 0,
      };
      if (!safe.title) continue;

      const localUpdatedAt = existingMap.get(r.id);
      if (!localUpdatedAt) {
        // Insert row that only exists in the sheet.
        const { error: insErr } = await admin
          .from("boss_todos")
          .insert({ id: r.id, ...safe, synced_at: new Date().toISOString() });
        if (!insErr) inserted++;
        continue;
      }
      // Compare timestamps; sheet wins only if strictly newer.
      const sheetTs = Date.parse(r.updated_at);
      const localTs = Date.parse(localUpdatedAt);
      if (Number.isFinite(sheetTs) && Number.isFinite(localTs) && sheetTs > localTs) {
        const { error: upErr } = await admin
          .from("boss_todos")
          .update({ ...safe, synced_at: new Date().toISOString() })
          .eq("id", r.id);
        if (!upErr) updated++;
      }
    }

    const now = new Date().toISOString();
    if (s.id) {
      await admin
        .from("boss_settings")
        .update({
          gsheet_last_pull_at: now,
          gsheet_last_pull_inserted: inserted,
          gsheet_last_pull_updated: updated,
        })
        .eq("id", s.id);
    }
    return { read: sheetRows.length, updated, inserted, lastPullAt: now };
  });

/** Manual disconnect — forgets the sheet ID (does not delete the spreadsheet). */
export const gsheetsDisconnect = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.userId);
    const admin = adminClient();
    const s = await loadSettings();
    if (s?.id) {
      await admin
        .from("boss_settings")
        .update({ gsheet_id: null, gsheet_url: null, gsheet_last_pull_at: null })
        .eq("id", s.id);
    }
    return { ok: true };
  });
