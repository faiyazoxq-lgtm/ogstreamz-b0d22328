/**
 * Google Sheets gateway helpers — server-only.
 *
 * All requests go through the Lovable connector gateway so we never see the
 * raw Google OAuth tokens. The connector is workspace-scoped to the boss's
 * own Google account, which is exactly the trust model we want for the
 * single-user Boss Notepad.
 *
 * Sheet shape (single tab "Notepad", row 1 is the header):
 *   A: id            (uuid — primary key, source of truth from boss_todos)
 *   B: title
 *   C: category
 *   D: priority
 *   E: status
 *   F: due_at        (ISO 8601 or empty)
 *   G: position      (integer)
 *   H: updated_at    (ISO 8601 — used for last-write-wins)
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const SHEET_TAB = "Notepad";
export const SHEET_HEADER = [
  "id",
  "title",
  "category",
  "priority",
  "status",
  "due_at",
  "position",
  "updated_at",
] as const;
export const SHEET_RANGE = `${SHEET_TAB}!A1:H10000`;

export type SheetRow = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  due_at: string | null;
  position: number;
  updated_at: string;
};

function authHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const sheetsKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovable) throw new Error("LOVABLE_API_KEY is not configured");
  if (!sheetsKey) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": sheetsKey,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function gw(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: init.method ?? "GET",
    headers: authHeaders(),
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

/* ----------------------------- encryption ------------------------------ */

/**
 * AES-256-GCM encryption for sheet content. The key is held in
 * `boss_settings.gsheet_enc_key` (base64) and never leaves the server. Even
 * if the spreadsheet is shared or leaked, free-text content is unreadable
 * without this key. Format: `enc1:<iv_b64>:<ct_b64>`.
 *
 * Rows still need machine-readable enum/integer columns (category, priority,
 * status, position, updated_at) so sorts + sync logic keep working. We only
 * encrypt the freeform fields: `title` and the literal date in `due_at`.
 * If the key is missing or the value isn't tagged, we pass through plaintext
 * so existing sheets keep working.
 */

const ENC_PREFIX = "enc1:";

async function importKey(b64: string): Promise<CryptoKey | null> {
  try {
    const raw = Buffer.from(b64, "base64");
    if (raw.length !== 32) return null;
    return await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

export async function encryptText(plain: string, keyB64: string | null): Promise<string> {
  if (!plain || !keyB64) return plain ?? "";
  const key = await importKey(keyB64);
  if (!key) return plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    ),
  );
  return `${ENC_PREFIX}${Buffer.from(iv).toString("base64")}:${Buffer.from(ct).toString("base64")}`;
}

export async function decryptText(maybe: string, keyB64: string | null): Promise<string> {
  if (!maybe || !maybe.startsWith(ENC_PREFIX) || !keyB64) return maybe;
  const key = await importKey(keyB64);
  if (!key) return maybe;
  try {
    const [, ivB, ctB] = maybe.split(":");
    const iv = Buffer.from(ivB, "base64");
    const ct = Buffer.from(ctB, "base64");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    return maybe;
  }
}

/** Generate a fresh 32-byte AES key in base64 for first-time setup. */
export function generateEncKeyB64(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(raw).toString("base64");
}

/* ------------------------------ row codec ------------------------------ */

async function rowToValues(row: SheetRow, keyB64: string | null): Promise<string[]> {
  return [
    row.id,
    await encryptText(row.title, keyB64),
    row.category,
    row.priority,
    row.status,
    row.due_at ? await encryptText(row.due_at, keyB64) : "",
    String(row.position),
    row.updated_at,
  ];
}

async function valuesToRow(r: string[], keyB64: string | null): Promise<SheetRow | null> {
  const id = r[0]?.trim();
  if (!id) return null;
  return {
    id,
    title: await decryptText(r[1] ?? "", keyB64),
    category: r[2] ?? "ops",
    priority: r[3] ?? "P2",
    status: r[4] ?? "todo",
    due_at: r[5] ? await decryptText(r[5], keyB64) : null,
    position: Number(r[6] ?? 0) || 0,
    updated_at: r[7] ?? new Date(0).toISOString(),
  };
}

/** Create a fresh "Boss Notepad" spreadsheet with the header row. */
export async function createNotepadSheet(): Promise<{ id: string; url: string }> {
  const created = await gw("/spreadsheets", {
    method: "POST",
    body: {
      properties: { title: "Boss Notepad" },
      sheets: [{ properties: { title: SHEET_TAB } }],
    },
  });
  const id = created.spreadsheetId as string;
  const url = (created.spreadsheetUrl as string) ??
    `https://docs.google.com/spreadsheets/d/${id}/edit`;

  // Seed the header row.
  await gw(
    `/spreadsheets/${id}/values/${SHEET_TAB}!A1:H1?valueInputOption=RAW`,
    {
      method: "PUT",
      body: { range: `${SHEET_TAB}!A1:H1`, values: [[...SHEET_HEADER]] },
    },
  );
  return { id, url };
}

/** Read every data row from the Notepad tab. */
export async function readSheetRows(
  sheetId: string,
  keyB64: string | null = null,
): Promise<SheetRow[]> {
  const data = await gw(`/spreadsheets/${sheetId}/values/${SHEET_RANGE}`);
  const values = (data.values ?? []) as string[][];
  if (values.length <= 1) return [];
  const rows: SheetRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = await valuesToRow(values[i] ?? [], keyB64);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * Replace the entire data range with the supplied rows. Simpler than
 * surgical row updates because the sheet is small and row indices would
 * otherwise drift after deletes.
 */
export async function writeAllRows(
  sheetId: string,
  rows: SheetRow[],
  keyB64: string | null = null,
): Promise<void> {
  // Clear existing data (keep the header).
  await gw(
    `/spreadsheets/${sheetId}/values/${SHEET_TAB}!A2:H10000:clear`,
    { method: "POST", body: {} },
  );
  if (rows.length === 0) return;
  const values: string[][] = [];
  for (const r of rows) values.push(await rowToValues(r, keyB64));
  await gw(
    `/spreadsheets/${sheetId}/values/${SHEET_TAB}!A2?valueInputOption=RAW`,
    {
      method: "PUT",
      body: { range: `${SHEET_TAB}!A2`, values },
    },
  );
}

/* --------------------------- incremental ops --------------------------- */

/** Locate a row in the Notepad tab by primary-key id. Returns 1-based row
 *  index (so e.g. 2 = first data row), or null if absent. */
async function findRowIndexById(sheetId: string, id: string): Promise<number | null> {
  const data = await gw(`/spreadsheets/${sheetId}/values/${SHEET_TAB}!A2:A10000`);
  const values = (data.values ?? []) as string[][];
  for (let i = 0; i < values.length; i++) {
    if ((values[i]?.[0] ?? "").trim() === id) return i + 2; // +1 for header, +1 for 1-based
  }
  return null;
}

/**
 * Upsert a single todo row in-place. If the id already exists we PUT just
 * that row (single Sheets API call); otherwise we append. Avoids rewriting
 * the whole range on every keystroke.
 */
export async function upsertSheetRow(
  sheetId: string,
  row: SheetRow,
  keyB64: string | null = null,
): Promise<{ inserted: boolean; rowIndex: number }> {
  const values = [await rowToValues(row, keyB64)];
  const idx = await findRowIndexById(sheetId, row.id);
  if (idx) {
    await gw(
      `/spreadsheets/${sheetId}/values/${SHEET_TAB}!A${idx}:H${idx}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: { range: `${SHEET_TAB}!A${idx}:H${idx}`, values },
      },
    );
    return { inserted: false, rowIndex: idx };
  }
  const appended = await gw(
    `/spreadsheets/${sheetId}/values/${SHEET_TAB}!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: { values } },
  );
  // Best-effort row index from the append response (e.g. "Notepad!A12:H12").
  const rng = appended?.updates?.updatedRange ?? "";
  const m = /![A-Z]+(\d+):/.exec(rng);
  return { inserted: true, rowIndex: m ? Number(m[1]) : -1 };
}

/** Clear a single row's cells in-place (keeps row geometry, like a soft
 *  delete). Safer than deleteDimension for an id-keyed sheet. */
export async function removeSheetRow(sheetId: string, id: string): Promise<boolean> {
  const idx = await findRowIndexById(sheetId, id);
  if (!idx) return false;
  await gw(
    `/spreadsheets/${sheetId}/values/${SHEET_TAB}!A${idx}:H${idx}:clear`,
    { method: "POST", body: {} },
  );
  return true;
}

/** Cheap reachability + permission check used by the status pill. */
export async function pingSheet(sheetId: string): Promise<boolean> {
  try {
    await gw(`/spreadsheets/${sheetId}?fields=spreadsheetId`);
    return true;
  } catch {
    return false;
  }
}