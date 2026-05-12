import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Plus, Trash2, Save, Loader2, Eye, EyeOff, Power, PowerOff, KeyRound, Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  listVipPassPool,
  upsertVipPassPool,
  deleteVipPassPool,
  type VipPassPoolRow,
} from "@/lib/vip-pass-pool.functions";

type Draft = {
  id: string | null;
  label: string;
  code: string;
  username: string;
  password: string;
  active: boolean;
  sort_order: number;
};
const empty: Draft = { id: null, label: "", code: "", username: "", password: "", active: true, sort_order: 0 };

type CsvRow = {
  label: string;
  username: string;
  password: string;
  code: string;
  active: boolean;
  sort_order: number;
  _line: number;
  _error?: string;
  _duplicate?: string;
};

/** Tiny CSV parser. Handles quoted fields, escaped quotes, comma OR semicolon. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  // auto-detect delimiter from the first non-quoted line
  const sample = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const delim = (sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else { cur += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((v) => v.trim().length > 0)) rows.push(row);
      row = [];
    } else { cur += c; }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((v) => v.trim().length > 0)) rows.push(row);
  }
  return rows;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Map CSV table to typed rows. Detects header row by known column names. */
function mapCsvRows(rows: string[][]): CsvRow[] {
  if (rows.length === 0) return [];
  const KNOWN: Record<string, "label" | "username" | "password" | "code" | "active" | "sort_order"> = {
    label: "label", name: "label", title: "label",
    username: "username", user: "username", login: "username", email: "username",
    password: "password", pass: "password", pwd: "password", secret: "password",
    code: "code", passcode: "code",
    active: "active", enabled: "active", on: "active",
    sort: "sort_order", sortorder: "sort_order", order: "sort_order",
  };
  const first = rows[0].map((c) => norm(c));
  const isHeader = first.some((c) => c in KNOWN);
  let columnMap: Record<number, string>;
  let dataRows: string[][];
  if (isHeader) {
    columnMap = {};
    first.forEach((h, idx) => { if (KNOWN[h]) columnMap[idx] = KNOWN[h]; });
    dataRows = rows.slice(1);
  } else {
    // Positional fallback: label, username, password, code
    columnMap = { 0: "label", 1: "username", 2: "password", 3: "code" };
    dataRows = rows;
  }
  return dataRows.map((cells, i) => {
    const out: CsvRow = {
      label: "", username: "", password: "", code: "",
      active: true, sort_order: 0, _line: i + (isHeader ? 2 : 1),
    };
    Object.entries(columnMap).forEach(([idxStr, key]) => {
      const idx = Number(idxStr);
      const v = (cells[idx] ?? "").trim();
      if (key === "active") out.active = !["false", "0", "no", "off", ""].includes(v.toLowerCase());
      else if (key === "sort_order") out.sort_order = Math.max(0, parseInt(v || "0", 10) || 0);
      else (out as any)[key] = v;
    });
    const hasCred = !!out.username && !!out.password;
    const hasCode = !!out.code;
    if (!hasCred && !hasCode) out._error = "Need code OR username + password";
    return out;
  });
}

/** Annotate rows that collide with existing pool rows or earlier CSV rows. */
function annotateDuplicates(csv: CsvRow[], existing: VipPassPoolRow[]): CsvRow[] {
  const existingUsers = new Set(existing.filter((r) => r.username).map((r) => r.username.toLowerCase()));
  const existingCodes = new Set(existing.filter((r) => r.code).map((r) => r.code.toLowerCase()));
  const seenUsers = new Set<string>();
  const seenCodes = new Set<string>();
  return csv.map((r) => {
    const next: CsvRow = { ...r, _duplicate: undefined };
    if (next._error) return next;
    const u = next.username.toLowerCase();
    const c = next.code.toLowerCase();
    if (u && existingUsers.has(u)) next._duplicate = `Username "${next.username}" exists`;
    else if (c && existingCodes.has(c)) next._duplicate = `Code already in pool`;
    else if (u && seenUsers.has(u)) next._duplicate = `Duplicate username in CSV`;
    else if (c && seenCodes.has(c)) next._duplicate = `Duplicate code in CSV`;
    if (u) seenUsers.add(u);
    if (c) seenCodes.add(c);
    return next;
  });
}

/** Boss-only: manage the VIP Pass Pool that gets randomly served to OGs. */
export function VipPassPoolAdmin() {
  const list = useServerFn(listVipPassPool);
  const save = useServerFn(upsertVipPassPool);
  const remove = useServerFn(deleteVipPassPool);

  const [rows, setRows] = useState<VipPassPoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState<Record<string, boolean>>({});
  const [showSecret, setShowSecret] = useState(false);
  const [bulk, setBulk] = useState("");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await list();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load pool");
    } finally {
      setLoading(false);
    }
  };

  const onCsvFile = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("CSV too large (max 2MB)");
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const mapped = mapCsvRows(parsed);
      if (mapped.length === 0) return toast.error("No rows found in CSV");
      setCsvRows(mapped);
      setCsvFileName(file.name);
      const valid = mapped.filter((r) => !r._error).length;
      toast.success(`Parsed ${mapped.length} row${mapped.length === 1 ? "" : "s"} · ${valid} ready`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to read CSV");
    }
  };

  const importCsv = async () => {
    const valid = csvRows.filter((r) => !r._error);
    if (valid.length === 0) return toast.error("No valid rows to import");
    setBusy(true);
    setImportProgress({ done: 0, total: valid.length });
    let added = 0, failed = 0;
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        await save({
          data: {
            id: null,
            label: r.label,
            code: r.code,
            username: r.username,
            password: r.password,
            active: r.active,
            sort_order: r.sort_order,
          },
        });
        added++;
      } catch {
        failed++;
      }
      setImportProgress({ done: i + 1, total: valid.length });
    }
    setBusy(false);
    setImportProgress(null);
    setCsvRows([]);
    setCsvFileName("");
    await refresh();
    toast.success(`Imported ${added}${failed ? ` · ${failed} failed` : ""}`);
  };

  const downloadTemplate = () => {
    const csv = "label,username,password,code,active,sort_order\nStream A · 4K,streamuser01,s3cret-pass,,true,0\nStream B,streamuser02,another-pass,,true,0\nLegacy code,,,VIP-AAA-1111,true,0\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vip-passes-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

  const submit = async () => {
    const hasCode = !!draft.code.trim();
    const hasCred = !!draft.username.trim() && !!draft.password.trim();
    if (!hasCode && !hasCred) {
      return toast.error("Provide a code OR a username and password");
    }
    setBusy(true);
    try {
      await save({ data: draft });
      toast.success(draft.id ? "Pass updated" : "Pass added");
      setDraft(empty);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitBulk = async () => {
    const lines = bulk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return toast.error("Paste at least one code");
    setBusy(true);
    let added = 0, failed = 0;
    for (const line of lines) {
      // Accepted formats per line:
      //   "label | username | password"
      //   "username | password"
      //   "label | code"   (legacy single-code)
      //   "code"           (legacy single-code)
      const parts = line.split("|").map((s) => s.trim()).filter((s) => s.length > 0);
      let payload: { label: string; code: string; username: string; password: string } = {
        label: "", code: "", username: "", password: "",
      };
      if (parts.length >= 3) {
        payload = { label: parts[0], username: parts[1], password: parts[2], code: "" };
      } else if (parts.length === 2) {
        payload = { label: "", username: parts[0], password: parts[1], code: "" };
      } else if (parts.length === 1) {
        payload = { label: "", code: parts[0], username: "", password: "" };
      } else {
        failed++; continue;
      }
      try {
        await save({ data: { id: null, ...payload, active: true, sort_order: 0 } });
        added++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    setBulk("");
    await refresh();
    toast.success(`Added ${added}${failed ? ` · ${failed} failed` : ""}`);
  };

  const toggleActive = async (r: VipPassPoolRow) => {
    try {
      await save({ data: { id: r.id, label: r.label, code: r.code, username: r.username, password: r.password, active: !r.active, sort_order: r.sort_order } });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this pass code?")) return;
    try {
      await remove({ data: { id } });
      await refresh();
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Crown className="h-5 w-5 text-cyan-300" />
        <div>
          <h2 className="font-[Montserrat] font-black text-xl text-foreground">VIP Pass Pool</h2>
          <p className="text-xs text-muted-foreground">
            OGs press Reveal on their dashboard to be assigned a random pass — either a code, or a username + password — from this list. Each reveal lasts 15 minutes.
          </p>
        </div>
      </header>

      {/* Add single */}
      <section className="rounded-xl border border-cyan-400/30 bg-card/70 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Label</label>
            <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Stream A · 4K" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Pass Code (optional)</label>
            <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="VIP-XXXX-2026" className="font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Username</label>
            <Input value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} placeholder="streamuser01" className="font-mono" autoComplete="off" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center justify-between">
              <span>Password</span>
              <button type="button" onClick={() => setShowSecret((s) => !s)} className="text-muted-foreground hover:text-white">
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </label>
            <Input
              type={showSecret ? "text" : "password"}
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              placeholder="••••••••"
              className="font-mono"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Sort</label>
            <Input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Math.max(0, parseInt(e.target.value || "0", 10)) })}
              className="w-24 font-mono"
            />
          </div>
          <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
            <span className="uppercase tracking-widest text-muted-foreground">Active</span>
            <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
          </label>
          <div className="flex-1" />
          {draft.id && (
            <Button variant="ghost" onClick={() => setDraft(empty)} className="text-muted-foreground">Cancel edit</Button>
          )}
          <Button onClick={submit} disabled={busy} className="bg-cyan-400 hover:bg-cyan-300 text-black font-bold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />{draft.id ? "Save" : "Add pass"}</>}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Provide a username + password (recommended), or just a code, or both. Credentials are encrypted at rest.
        </p>
      </section>

      {/* Bulk paste */}
      <section className="rounded-xl border border-cyan-400/20 bg-card/50 p-4">
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-300 mb-2">
          <KeyRound className="h-3 w-3 inline mr-1" /> Bulk add — one per line. Formats: <code>label | username | password</code>, <code>username | password</code>, or <code>code</code>
        </p>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={5}
          placeholder={"Stream A | streamuser01 | s3cret-pass\nstreamuser02 | another-pass\nVIP-AAA-1111"}
          className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm font-mono"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={submitBulk} disabled={busy || !bulk.trim()} size="sm" className="bg-cyan-400 hover:bg-cyan-300 text-black font-bold">
            <Plus className="h-4 w-4 mr-1" /> Add all
          </Button>
        </div>
      </section>

      {/* CSV import */}
      <section className="rounded-xl border border-cyan-400/30 bg-card/60 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-300">
              <FileSpreadsheet className="h-3 w-3 inline mr-1" /> CSV import
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Columns: <code>label, username, password, code, active, sort_order</code>. Header row optional. Comma or semicolon delimiter.
            </p>
          </div>
          <Button onClick={downloadTemplate} variant="ghost" size="sm" className="text-cyan-200 hover:text-white">
            Download template
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 rounded-md border border-cyan-400/40 bg-background/40 px-3 py-2 text-xs uppercase tracking-widest text-cyan-100 cursor-pointer hover:bg-cyan-400/10">
            <Upload className="h-3.5 w-3.5" /> Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onCsvFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {csvFileName && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <FileSpreadsheet className="h-3 w-3" /> {csvFileName}
              <button
                type="button"
                onClick={() => { setCsvRows([]); setCsvFileName(""); }}
                className="text-muted-foreground hover:text-white"
                aria-label="Clear CSV"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        {csvRows.length > 0 && (() => {
          const valid = csvRows.filter((r) => !r._error).length;
          const invalid = csvRows.length - valid;
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
                <p className="text-muted-foreground">
                  <strong className="text-emerald-300">{valid}</strong> ready
                  {invalid > 0 && <> · <strong className="text-rose-300">{invalid}</strong> with errors</>}
                  {" "}· total {csvRows.length}
                </p>
                {importProgress && (
                  <p className="text-cyan-200 font-mono">
                    Importing {importProgress.done} / {importProgress.total}…
                  </p>
                )}
              </div>
              <div className="max-h-64 overflow-auto rounded-md border border-border bg-background/40">
                <table className="w-full text-xs min-w-[640px]">
                  <thead className="sticky top-0 bg-card/95 backdrop-blur">
                    <tr className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
                      <th className="px-2 py-1.5 text-left">#</th>
                      <th className="px-2 py-1.5 text-left">Label</th>
                      <th className="px-2 py-1.5 text-left">Username</th>
                      <th className="px-2 py-1.5 text-left">Password</th>
                      <th className="px-2 py-1.5 text-left">Code</th>
                      <th className="px-2 py-1.5 text-center">Active</th>
                      <th className="px-2 py-1.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 200).map((r, i) => (
                      <tr key={i} className={`border-b border-border/40 ${r._error ? "bg-rose-500/5" : ""}`}>
                        <td className="px-2 py-1 text-muted-foreground tabular-nums">{r._line}</td>
                        <td className="px-2 py-1 text-white">{r.label || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1 font-mono text-cyan-200">{r.username || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1 font-mono text-cyan-200">{r.password ? "•".repeat(Math.min(10, r.password.length)) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1 font-mono text-cyan-200">{r.code || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1 text-center">{r.active ? "✓" : "—"}</td>
                        <td className="px-2 py-1">
                          {r._error
                            ? <span className="text-rose-300">{r._error}</span>
                            : <span className="text-emerald-300">Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 200 && (
                  <p className="text-center py-2 text-[10px] text-muted-foreground">…showing first 200 rows of {csvRows.length}</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setCsvRows([]); setCsvFileName(""); }}
                  disabled={busy}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={importCsv}
                  disabled={busy || valid === 0}
                  className="bg-cyan-400 hover:bg-cyan-300 text-black font-bold"
                >
                  {busy
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing…</>
                    : <><Plus className="h-4 w-4 mr-1" /> Import {valid} pass{valid === 1 ? "" : "es"}</>}
                </Button>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Existing list */}
      <section className="rounded-xl border border-border bg-card/60 overflow-hidden">
        {loading ? (
          <p className="text-center py-10 text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin mr-2" />Loading pool…</p>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">No pass codes yet — add some above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-2 font-bold">Label</th>
                  <th className="text-left px-3 py-2 font-bold">Credential</th>
                  <th className="text-right px-3 py-2 font-bold">Sort</th>
                  <th className="text-center px-3 py-2 font-bold">Active</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const visible = !!showCode[r.id];
                  const hasCred = !!r.username && !!r.password;
                  const display = hasCred
                    ? (visible ? `${r.username} / ${r.password}` : `${r.username} / ${"•".repeat(Math.min(10, r.password.length || 8))}`)
                    : (visible ? r.code : "•".repeat(Math.min(16, r.code.length)));
                  return (
                    <tr key={r.id} className={`border-b border-border/40 ${!r.active ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2 text-white">{r.label || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 font-mono text-cyan-200">
                        <span className="break-all">{display || <span className="text-muted-foreground">—</span>}</span>
                        <button
                          type="button"
                          onClick={() => setShowCode((s) => ({ ...s, [r.id]: !s[r.id] }))}
                          className="ml-2 text-muted-foreground hover:text-white"
                        >
                          {visible ? <EyeOff className="h-3.5 w-3.5 inline" /> : <Eye className="h-3.5 w-3.5 inline" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.sort_order}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleActive(r)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
                            r.active ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40" : "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                          }`}
                        >
                          {r.active ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                          {r.active ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDraft({ id: r.id, label: r.label, code: r.code, username: r.username, password: r.password, active: r.active, sort_order: r.sort_order })}
                          className="text-cyan-200 hover:text-white"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => del(r.id)}
                          className="text-rose-300 hover:text-white"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default VipPassPoolAdmin;