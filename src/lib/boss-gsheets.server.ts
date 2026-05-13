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
export async function readSheetRows(sheetId: string): Promise<SheetRow[]> {
  const data = await gw(`/spreadsheets/${sheetId}/values/${SHEET_RANGE}`);
  const values = (data.values ?? []) as string[][];
  if (values.length <= 1) return [];
  const rows: SheetRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const id = r[0]?.trim();
    if (!id) continue;
    rows.push({
      id,
      title: r[1] ?? "",
      category: r[2] ?? "ops",
      priority: r[3] ?? "P2",
      status: r[4] ?? "todo",
      due_at: r[5] ? r[5] : null,
      position: Number(r[6] ?? 0) || 0,
      updated_at: r[7] ?? new Date(0).toISOString(),
    });
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
): Promise<void> {
  // Clear existing data (keep the header).
  await gw(
    `/spreadsheets/${sheetId}/values/${SHEET_TAB}!A2:H10000:clear`,
    { method: "POST", body: {} },
  );
  if (rows.length === 0) return;
  const values = rows.map((r) => [
    r.id,
    r.title,
    r.category,
    r.priority,
    r.status,
    r.due_at ?? "",
    String(r.position),
    r.updated_at,
  ]);
  await gw(
    `/spreadsheets/${sheetId}/values/${SHEET_TAB}!A2?valueInputOption=RAW`,
    {
      method: "PUT",
      body: { range: `${SHEET_TAB}!A2`, values },
    },
  );
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