import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Plus, Trash2, Save, Loader2, Eye, EyeOff, Power, PowerOff, KeyRound } from "lucide-react";
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
  active: boolean;
  sort_order: number;
};
const empty: Draft = { id: null, label: "", code: "", active: true, sort_order: 0 };

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
  const [bulk, setBulk] = useState("");

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
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

  const submit = async () => {
    if (!draft.code.trim()) return toast.error("Code required");
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
      // Format: "label | code"  or just "code"
      const [maybeLabel, maybeCode] = line.includes("|") ? line.split("|").map((s) => s.trim()) : ["", line];
      const code = (maybeCode || maybeLabel).trim();
      const label = maybeCode ? maybeLabel : "";
      try {
        await save({ data: { id: null, label, code, active: true, sort_order: 0 } });
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
      await save({ data: { id: r.id, label: r.label, code: r.code, active: !r.active, sort_order: r.sort_order } });
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
            OGs press Reveal on their dashboard to be assigned a random code from this list. Each reveal lasts 15 minutes.
          </p>
        </div>
      </header>

      {/* Add single */}
      <section className="rounded-xl border border-cyan-400/30 bg-card/70 p-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto_auto] sm:items-end">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Label</label>
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Backstage" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Pass Code</label>
          <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="VIP-XXXX-2026" className="font-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Sort</label>
          <Input
            type="number"
            value={draft.sort_order}
            onChange={(e) => setDraft({ ...draft, sort_order: Math.max(0, parseInt(e.target.value || "0", 10)) })}
            className="w-20 font-mono"
          />
        </div>
        <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
          <span className="uppercase tracking-widest text-muted-foreground">Active</span>
          <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
        </label>
        <Button onClick={submit} disabled={busy} className="bg-cyan-400 hover:bg-cyan-300 text-black font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />{draft.id ? "Save" : "Add"}</>}
        </Button>
      </section>

      {/* Bulk paste */}
      <section className="rounded-xl border border-cyan-400/20 bg-card/50 p-4">
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-300 mb-2">
          <KeyRound className="h-3 w-3 inline mr-1" /> Bulk add — one code per line (optional <code>label | code</code>)
        </p>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={4}
          placeholder={"Backstage | VIP-AAA-1111\nFront row | VIP-BBB-2222\nVIP-CCC-3333"}
          className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm font-mono"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={submitBulk} disabled={busy || !bulk.trim()} size="sm" className="bg-cyan-400 hover:bg-cyan-300 text-black font-bold">
            <Plus className="h-4 w-4 mr-1" /> Add all
          </Button>
        </div>
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
                  <th className="text-left px-3 py-2 font-bold">Code</th>
                  <th className="text-right px-3 py-2 font-bold">Sort</th>
                  <th className="text-center px-3 py-2 font-bold">Active</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const visible = !!showCode[r.id];
                  return (
                    <tr key={r.id} className={`border-b border-border/40 ${!r.active ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2 text-white">{r.label || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 font-mono text-cyan-200">
                        <span>{visible ? r.code : "•".repeat(Math.min(16, r.code.length))}</span>
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
                          onClick={() => setDraft({ id: r.id, label: r.label, code: r.code, active: r.active, sort_order: r.sort_order })}
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