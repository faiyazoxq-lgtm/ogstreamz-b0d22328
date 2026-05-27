import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { KeyRound, Plus, Eye, EyeOff, Trash2, Save, Loader2, ShieldAlert, ShieldCheck, Copy, Check, Settings2, RotateCcw, Lock, Clock } from "lucide-react";
import {
  listAgentKeys,
  upsertAgentKey,
  deleteAgentKey,
  revealAgentKey,
  listAgentKeyPresets,
  saveAgentKeyPresets,
  getAgentKeyPresetDefaults,
  type AgentKeyPreset,
  type AgentKeyRow,
} from "@/lib/agent-keys.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/boss/api-keys")({
  beforeLoad: exactPathRedirect("/boss/api-keys", () => ({
    to: "/boss/infrastructure",
    hash: "agent-keys",
  })),
  component: () => null,
});

// Preset suggestions and the input placeholder are loaded from the server
// at runtime via `listAgentKeyPresets` so example secret-name strings never
// appear in the client bundle. The server reads optional overrides from
// process.env.AGENT_KEY_PRESETS_JSON / AGENT_KEY_NAME_PLACEHOLDER.
const EMPTY_PRESETS: AgentKeyPreset[] = [];

export function ApiKeysPage() {
  const fetchList = useServerFn(listAgentKeys);
  const upsertFn = useServerFn(upsertAgentKey);
  const deleteFn = useServerFn(deleteAgentKey);
  const revealFn = useServerFn(revealAgentKey);
  const fetchPresets = useServerFn(listAgentKeyPresets);
  const savePresetsFn = useServerFn(saveAgentKeyPresets);
  const fetchDefaultsFn = useServerFn(getAgentKeyPresetDefaults);

  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["agent-keys"],
    queryFn: () => fetchList({ data: {} as never }),
  });
  const {
    data: presetData,
    isLoading: presetsLoading,
    error: presetsError,
    refetch: refetchPresets,
  } = useQuery({
    queryKey: ["agent-key-presets"],
    queryFn: () => fetchPresets(),
    staleTime: 5 * 60_000,
  });
  const presets = presetData?.presets ?? EMPTY_PRESETS;
  const placeholder = presetData?.placeholder ?? "";

  const grouped = useMemo(() => {
    const map = new Map<string, AgentKeyRow[]>();
    for (const k of data?.keys ?? []) {
      const g = k.agent_group || "general";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(k);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const [showAdd, setShowAdd] = useState(false);
  const [showPresetsEditor, setShowPresetsEditor] = useState(false);

  const totalKeys = data?.keys.length ?? 0;
  const groupCount = grouped.length;

  const upsertMut = useMutation({
    mutationFn: (input: { key_name: string; value: string; label?: string; agent_group?: string; description?: string }) =>
      upsertFn({ data: input }),
    onSuccess: () => {
      toast.success("Key saved");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["agent-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (key_name: string) => deleteFn({ data: { key_name } }),
    onSuccess: () => {
      toast.success("Key removed");
      qc.invalidateQueries({ queryKey: ["agent-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40">
            <KeyRound className="h-5 w-5 text-gold" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="syndicate-header text-2xl text-foreground">Agent Key Vault</h1>
            <p className="text-sm text-muted-foreground">
              Encrypted secrets for AI agents and integrations. Boss-only — values stay on the server and are never shipped to members.
            </p>
            {!isLoading && totalKeys > 0 && (
              <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
                {totalKeys} key{totalKeys === 1 ? "" : "s"} · {groupCount} group{groupCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPresetsEditor((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-foreground hover:bg-secondary/80"
          >
            <Settings2 className="h-4 w-4" /> Edit presets
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25"
          >
            <Plus className="h-4 w-4" /> Add key
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100/90">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-300" />
            <span>
              <span className="font-bold text-emerald-200">Encrypted at rest</span> with pgp_sym_encrypt. Values only decrypt when you press <em>Reveal</em>.
            </span>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" />
            <span>
              <span className="font-bold text-amber-200">Replace</span> overwrites the stored value instantly. <span className="font-bold text-amber-200">Delete</span> is permanent — no undo.
            </span>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {(error as Error).message}
        </div>
      )}

      {showPresetsEditor && (
        <PresetsEditor
          initialPresets={presets}
          initialPlaceholder={placeholder}
          onClose={() => setShowPresetsEditor(false)}
          onSave={async (payload) => {
            await savePresetsFn({ data: payload });
            await qc.invalidateQueries({ queryKey: ["agent-key-presets"] });
          }}
          onLoadDefaults={() => fetchDefaultsFn()}
        />
      )}

      {showAdd && (
        <KeyForm
          mode="create"
          submitting={upsertMut.isPending}
          onCancel={() => setShowAdd(false)}
          onSubmit={(v) => upsertMut.mutate(v)}
          presets={presets}
          placeholder={placeholder}
          presetsLoading={presetsLoading}
          presetsError={presetsError as Error | null}
          onRetryPresets={() => refetchPresets()}
        />
      )}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading vault…
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/30 bg-card p-10 text-center">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
            <Lock className="h-5 w-5 text-gold" />
          </span>
          <p className="syndicate-header text-base text-foreground">Vault is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first secret to start powering agents and integrations.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25"
          >
            <Plus className="h-4 w-4" /> Add first key
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([group, rows]) => (
            <div key={group} className="space-y-2">
              <div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
                <h2 className="text-[11px] uppercase tracking-[0.3em] text-gold font-bold">
                  {presets.find((g) => g.id === group)?.label ?? group}
                </h2>
                <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  {rows.length}
                </span>
              </div>
              <ul className="space-y-2">
                {rows.map((k) => (
                  <KeyRow
                    key={k.id}
                    row={k}
                    onReveal={() => revealFn({ data: { key_name: k.key_name } }).then((r) => r.value)}
                    onSave={(value) => upsertMut.mutateAsync({
                      key_name: k.key_name,
                      value,
                      label: k.label,
                      agent_group: k.agent_group,
                      description: k.description,
                    })}
                    onDelete={() => {
                      if (confirm(`Remove ${k.key_name}? This cannot be undone.`)) {
                        deleteMut.mutate(k.key_name);
                      }
                    }}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function KeyForm({
  mode,
  initial,
  submitting,
  onCancel,
  onSubmit,
  presets,
  placeholder,
  presetsLoading,
  presetsError,
  onRetryPresets,
}: {
  mode: "create" | "edit";
  initial?: Partial<AgentKeyRow>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (v: { key_name: string; value: string; label?: string; agent_group?: string; description?: string }) => void;
  presets: AgentKeyPreset[];
  placeholder: string;
  presetsLoading?: boolean;
  presetsError?: Error | null;
  onRetryPresets?: () => void;
}) {
  const [keyName, setKeyName] = useState(initial?.key_name ?? "");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [group, setGroup] = useState(initial?.agent_group ?? "ai");
  const [description, setDescription] = useState(initial?.description ?? "");

  const suggestions = presets.find((g) => g.id === group)?.suggestions ?? [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const normalized = keyName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        onSubmit({
          key_name: normalized,
          value: value.trim(),
          label: label.trim() || normalized,
          agent_group: group,
          description: description.trim(),
        });
      }}
      className="rounded-2xl border border-gold/30 bg-card p-4 sm:p-5 space-y-4"
    >
      {presetsLoading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading presets…
        </div>
      )}
      {presetsError && !presetsLoading && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <span>Couldn’t load presets: {presetsError.message}</span>
          {onRetryPresets && (
            <button
              type="button"
              onClick={onRetryPresets}
              className="rounded border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-rose-100 hover:bg-rose-500/20"
            >
              Retry
            </button>
          )}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Key name (env-style)" hint="UPPER_SNAKE_CASE, A-Z 0-9 _">
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            disabled={mode === "edit"}
            required
            placeholder={placeholder}
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-gold/50"
          />
          {suggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setKeyName(s)}
                  className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Agent group">
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
          >
            {presets.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Display label">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="OpenAI primary"
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
        </Field>
        <Field label="Description (optional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What uses this key?"
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
        </Field>
      </div>

      <Field label="Secret value" hint="Pasted, encrypted on save, never logged.">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          rows={2}
          placeholder="sk-..."
          className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm font-mono outline-none focus:border-gold/50"
        />
      </Field>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {mode === "create" ? "Save key" : "Update value"}
        </button>
      </div>
    </form>
  );
}

function KeyRow({
  row,
  onReveal,
  onSave,
  onDelete,
}: {
  row: AgentKeyRow;
  onReveal: () => Promise<string>;
  onSave: (value: string) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const reveal = async () => {
    if (revealed) { setRevealed(null); return; }
    setRevealing(true);
    try {
      const v = await onReveal();
      setRevealed(v);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevealing(false);
    }
  };

  const copy = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <li
      className={`rounded-xl border bg-card p-4 transition-colors ${
        revealed ? "border-gold/40 ring-1 ring-gold/20" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {/* Identity */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-bold text-foreground">{row.key_name}</p>
            {revealed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-gold">
                <Eye className="h-3 w-3" /> Revealed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-200">
                <Lock className="h-3 w-3" /> Encrypted
              </span>
            )}
          </div>
          {row.label && row.label !== row.key_name && (
            <p className="text-xs text-muted-foreground">{row.label}</p>
          )}
          {row.description && (
            <p className="text-xs text-muted-foreground/80">{row.description}</p>
          )}
        </div>

        {/* Safe actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={reveal}
            disabled={revealing}
            title={revealed ? "Hide value" : "Decrypt and show value"}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground hover:bg-secondary/80"
          >
            {revealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? "Hide" : "Reveal"}
          </button>
          {revealed && (
            <button
              type="button"
              onClick={copy}
              title="Copy to clipboard"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground hover:bg-secondary/80"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            title="Replace stored value"
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] ${
              editing
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-border bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" /> {editing ? "Cancel" : "Replace"}
          </button>
        </div>
      </div>

      {/* Metadata strip */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="rounded border border-border bg-secondary/40 px-1.5 py-0.5 font-mono">
          {revealed ?? row.preview}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> updated {new Date(row.updated_at).toLocaleString()}
        </span>
      </div>

      {editing && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Paste new value"
            className="flex-1 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm font-mono outline-none focus:border-gold/50"
          />
          <button
            type="button"
            disabled={saving || newValue.length === 0}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(newValue);
                setEditing(false);
                setNewValue("");
                setRevealed(null);
              } finally { setSaving(false); }
            }}
            className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      )}
    </li>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-1.5">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground/70">{hint}</span>}
    </label>
  );
}

type PresetsPayload = { presets: AgentKeyPreset[]; placeholder: string };

function PresetsEditor({
  initialPresets,
  initialPlaceholder,
  onClose,
  onSave,
  onLoadDefaults,
}: {
  initialPresets: AgentKeyPreset[];
  initialPlaceholder: string;
  onClose: () => void;
  onSave: (payload: PresetsPayload) => Promise<void>;
  onLoadDefaults: () => Promise<PresetsPayload>;
}) {
  const [text, setText] = useState(() => JSON.stringify(initialPresets, null, 2));
  const [placeholder, setPlaceholder] = useState(initialPlaceholder);
  const [saving, setSaving] = useState(false);
  const [parseErr, setParseErr] = useState<string | null>(null);

  const submit = async () => {
    setParseErr(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setParseErr(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    if (!Array.isArray(parsed)) {
      setParseErr("Top-level value must be an array of preset groups.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ presets: parsed as AgentKeyPreset[], placeholder: placeholder.trim() });
      toast.success("Presets saved");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const loadDefaults = async () => {
    try {
      const d = await onLoadDefaults();
      setText(JSON.stringify(d.presets, null, 2));
      setPlaceholder(d.placeholder);
      toast.message("Loaded defaults — review then Save to persist.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl border border-gold/30 bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Settings2 className="h-4 w-4 text-gold" />
        <h2 className="syndicate-header text-base text-foreground">Edit preset groups</h2>
        <span className="text-xs text-muted-foreground">
          Stored in the database — changes apply instantly, no redeploy.
        </span>
      </div>
      <Field
        label="Presets (JSON array)"
        hint='Each item: { "id": "ai", "label": "AI / LLM", "suggestions": ["MY_API_KEY", ...] }. IDs and suggestions must be UPPER_SNAKE_CASE alphanumerics.'
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          spellCheck={false}
          className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs font-mono outline-none focus:border-gold/50"
        />
      </Field>
      <Field label="Default placeholder" hint="Shown in the key-name input. UPPER_SNAKE_CASE only.">
        <input
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value.toUpperCase())}
          className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm font-mono outline-none focus:border-gold/50"
        />
      </Field>
      {parseErr && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {parseErr}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={loadDefaults}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Load defaults
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save presets
        </button>
      </div>
    </div>
  );
}