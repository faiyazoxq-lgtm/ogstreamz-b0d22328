import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  KeyRound, Plus, Trash2, Save, Loader2, Eye, EyeOff, Power, PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  listVaultCredentials,
  upsertVaultCredential,
  deleteVaultCredential,
  type VaultCredentialRow,
} from "@/lib/vault.functions";

type Draft = {
  id: string | null;
  label: string;
  username: string;
  password: string;
  active: boolean;
  sort_order: number;
};
const empty: Draft = { id: null, label: "", username: "", password: "", active: true, sort_order: 0 };

/** Boss-only: manage the rotating 0G-VAULT credential pool. */
export function VaultCredentialsAdmin() {
  const list = useServerFn(listVaultCredentials);
  const save = useServerFn(upsertVaultCredential);
  const remove = useServerFn(deleteVaultCredential);

  const [rows, setRows] = useState<VaultCredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list();
      setRows(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);

  const submit = async () => {
    if (!draft.username.trim() || !draft.password.trim()) {
      toast.error("Username and password required");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          id: draft.id,
          label: draft.label,
          username: draft.username,
          password: draft.password,
          active: draft.active,
          sort_order: draft.sort_order,
        },
      });
      toast.success(draft.id ? "Credential updated" : "Credential added");
      setDraft(empty);
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: VaultCredentialRow) => {
    try {
      await save({
        data: {
          id: row.id, label: row.label, username: row.username, password: row.password,
          active: !row.active, sort_order: row.sort_order,
        },
      });
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Toggle failed");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this credential? Real OGs in the next window won't see it again.")) return;
    try {
      await remove({ data: { id } });
      toast.success("Deleted");
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  const startEdit = (row: VaultCredentialRow) => {
    setDraft({
      id: row.id,
      label: row.label,
      username: row.username,
      password: row.password,
      active: row.active,
      sort_order: row.sort_order,
    });
  };

  return (
    <section className="rounded-2xl border border-amber-300/40 bg-card p-6">
      <header className="flex items-center gap-3 mb-1 flex-wrap">
        <KeyRound className="h-5 w-5 text-amber-300" />
        <h2 className="font-[Montserrat] font-black text-xl">0G-VAULT credentials pool</h2>
        <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Rotates every 15 min
        </span>
      </header>
      <p className="text-xs text-muted-foreground mb-4">
        Add as many username/password rows as you like. The system picks one based on the current
        15-minute window so every Real OG sees the same drop.
      </p>

      {/* Editor */}
      <div className="rounded-xl border border-border bg-background/40 p-4 grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Label (optional)</label>
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                 placeholder="Drop #1 — admin" disabled={busy} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Username</label>
          <Input value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                 placeholder="vault_user_42" disabled={busy} className="mt-1 font-mono" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Password</label>
          <Input value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                 placeholder="••••••••" disabled={busy} className="mt-1 font-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Sort</label>
          <Input type="number" value={draft.sort_order}
                 onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                 disabled={busy} className="mt-1 w-24" />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} disabled={busy} />
          <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Active</span>
        </div>
        <div className="sm:col-span-3 flex items-center justify-end gap-2">
          {draft.id && (
            <Button variant="outline" onClick={() => setDraft(empty)} disabled={busy}>Cancel</Button>
          )}
          <Button onClick={submit} disabled={busy} className="bg-amber-300 hover:bg-amber-200 text-black">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving</>
                  : draft.id ? <><Save className="h-4 w-4 mr-2" />Update</>
                             : <><Plus className="h-4 w-4 mr-2" />Add credential</>}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="mt-5">
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No credentials yet — add the first one above.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {rows.map((row) => (
              <li key={row.id} className={`p-3 flex flex-wrap items-center gap-3 ${row.active ? "" : "opacity-60"}`}>
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground w-10 tabular-nums">
                  #{row.sort_order}
                </span>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{row.label || "—"}</div>
                  <div className="font-mono text-sm text-foreground truncate">
                    {row.username}
                    <span className="mx-2 text-muted-foreground">·</span>
                    {reveal[row.id] ? row.password : "•".repeat(Math.min(10, row.password.length))}
                    <button
                      type="button"
                      onClick={() => setReveal({ ...reveal, [row.id]: !reveal[row.id] })}
                      className="ml-2 text-amber-200 hover:text-amber-100"
                      aria-label="Toggle password"
                    >
                      {reveal[row.id] ? <EyeOff className="h-3.5 w-3.5 inline" /> : <Eye className="h-3.5 w-3.5 inline" />}
                    </button>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => toggleActive(row)}
                        title={row.active ? "Disable" : "Enable"}>
                  {row.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(row)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => del(row.id)}
                        className="text-rose-400 border-rose-400/40 hover:bg-rose-500/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default VaultCredentialsAdmin;
