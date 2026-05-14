import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, RefreshCw, Plus, Save, Trash2, X, Crown, Tv, Package, Image as ImageIcon, ArrowUp, ArrowDown, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { coinChip } from "@/lib/coins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listStoreProducts, upsertStoreProduct, setStoreProductActive, setStoreProductSort,
  deleteStoreProduct, type StoreProductRow,
} from "@/lib/store-products.functions";

const KINDS = [
  { v: "vip_pass",     label: "VIP Pass",     icon: Crown,   tint: "text-amber-300 border-amber-700/50 bg-amber-500/10" },
  { v: "streams_pass", label: "Streams Pass", icon: Tv,      tint: "text-cyan-300 border-cyan-700/50 bg-cyan-500/10" },
  { v: "digital",      label: "Digital",      icon: Package, tint: "text-emerald-300 border-emerald-700/50 bg-emerald-500/10" },
  { v: "nft",          label: "NFT",          icon: Crown,   tint: "text-fuchsia-300 border-fuchsia-700/50 bg-fuchsia-500/10" },
] as const;

type KindV = typeof KINDS[number]["v"];

type Draft = {
  id?: string | null;
  sku: string;
  kind: KindV;
  title: string;
  description: string;
  image_url: string;
  price_cents: string;
  currency: string;
  duration_days: string;
  duration_amount: string;
  duration_unit: "n/a" | "days" | "months" | "years" | "lifetime";
  asset_url: string;
  metadata: string;
  active: boolean;
  sort_order: string;
};

function daysToUnit(d: number | null | undefined): { amount: string; unit: Draft["duration_unit"] } {
  if (d == null) return { amount: "", unit: "n/a" };
  if (d === 0) return { amount: "", unit: "lifetime" };
  if (d % 365 === 0) return { amount: String(d / 365), unit: "years" };
  if (d % 30 === 0) return { amount: String(d / 30), unit: "months" };
  return { amount: String(d), unit: "days" };
}

function unitToDays(amount: string, unit: Draft["duration_unit"]): number | null {
  if (unit === "n/a") return null;
  if (unit === "lifetime") return 0;
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "years") return Math.round(n * 365);
  if (unit === "months") return Math.round(n * 30);
  return Math.round(n);
}

function emptyDraft(kind: KindV): Draft {
  return {
    id: null, sku: "", kind, title: "", description: "",
    image_url: "", price_cents: "0", currency: "usd", duration_days: "",
    duration_amount: "", duration_unit: "n/a",
    asset_url: "", metadata: "{}", active: true, sort_order: "0",
  };
}

function rowToDraft(r: StoreProductRow): Draft {
  const du = daysToUnit(r.duration_days);
  return {
    id: r.id,
    sku: r.sku,
    kind: r.kind as KindV,
    title: r.title,
    description: r.description ?? "",
    image_url: r.image_url ?? "",
    price_cents: String(r.price_cents),
    currency: r.currency,
    duration_days: r.duration_days == null ? "" : String(r.duration_days),
    duration_amount: du.amount,
    duration_unit: du.unit,
    asset_url: r.asset_url ?? "",
    metadata: JSON.stringify(r.metadata ?? {}, null, 2),
    active: r.active,
    sort_order: String(r.sort_order),
  };
}

function fmtMoney(cents: number, currency: string) {
  try {
    const base = new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "gbp").toUpperCase() })
      .format((cents ?? 0) / 100);
    return (currency || "gbp").toLowerCase() === "gbp" ? `${base} ${coinChip(cents)}` : base;
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency?.toUpperCase() ?? ""} ${coinChip(cents)}`;
  }
}

export function StoreProductsPanel() {
  const list = useServerFn(listStoreProducts);
  const upsert = useServerFn(upsertStoreProduct);
  const setActive = useServerFn(setStoreProductActive);
  const setSort = useServerFn(setStoreProductSort);
  const delFn = useServerFn(deleteStoreProduct);

  const [rows, setRows] = useState<StoreProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<KindV>("vip_pass");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list();
      setRows(r.products);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const grouped = useMemo(() => {
    const m: Record<KindV, StoreProductRow[]> = { vip_pass: [], streams_pass: [], digital: [], nft: [] };
    rows.forEach((r) => { (m[r.kind as KindV] ?? m.digital).push(r); });
    (Object.keys(m) as KindV[]).forEach((k) => {
      m[k].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    });
    return m;
  }, [rows]);

  const startNew = (k: KindV) => setDraft(emptyDraft(k));
  const startEdit = (r: StoreProductRow) => setDraft(rowToDraft(r));

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await upsert({
        data: {
          id: draft.id ?? null,
          sku: draft.sku,
          kind: draft.kind,
          title: draft.title,
          description: draft.description || null,
          image_url: draft.image_url || null,
          price_cents: Number(draft.price_cents) || 0,
          currency: draft.currency || "usd",
          duration_days: unitToDays(draft.duration_amount, draft.duration_unit),
          asset_url: draft.asset_url || null,
          metadata: draft.metadata.trim() || "{}",
          active: draft.active,
          sort_order: Number(draft.sort_order) || 0,
        },
      });
      toast.success(draft.id ? "Product updated" : "Product created");
      setDraft(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (r: StoreProductRow, on: boolean) => {
    try {
      await setActive({ data: { id: r.id, active: on } });
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, active: on } : x));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to toggle");
    }
  };

  const nudgeSort = async (r: StoreProductRow, dir: -1 | 1) => {
    const next = (r.sort_order ?? 0) + dir * 10;
    try {
      await setSort({ data: { id: r.id, sort_order: next } });
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, sort_order: next } : x));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update sort");
    }
  };

  const remove = async (r: StoreProductRow) => {
    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    try {
      await delFn({ data: { id: r.id } });
      toast.success("Product deleted");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  const meta = (k: string) => KINDS.find((x) => x.v === k) ?? KINDS[2];

  return (
    <div className="rounded-2xl border-2 border-emerald-800/40 bg-black/60 backdrop-blur p-5 sm:p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-cyan-200 flex items-center gap-2">
            <Package className="h-6 w-6" /> Store Products
          </h3>
          <p className="text-sm text-emerald-400/80 mt-1">
            Manage what shows up in the catalog. Toggle active, reorder, edit pricing & images.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={refresh} variant="outline"
            className="h-10 border-emerald-800/50 text-emerald-200 hover:bg-emerald-900/30 uppercase tracking-wider text-xs font-black"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            onClick={() => startNew(tab)}
            className="h-10 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider text-xs"
          >
            <Plus className="h-4 w-4 mr-1" /> New product
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as KindV)}>
        <TabsList className="grid grid-cols-4 bg-black/40 border-2 border-emerald-800/40 p-1 mb-4">
          {KINDS.map(({ v, label, icon: Icon }) => (
            <TabsTrigger
              key={v} value={v}
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200 text-emerald-400/70 font-black uppercase tracking-wider text-xs"
            >
              <Icon className="h-3.5 w-3.5 mr-1.5" />
              {label}
              <span className="ml-1.5 text-[10px] opacity-70">({grouped[v]?.length ?? 0})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {KINDS.map(({ v }) => (
          <TabsContent key={v} value={v} className="mt-0">
            {loading && rows.length === 0 ? (
              <div className="py-12 text-center text-emerald-400/70">
                <Loader2 className="h-6 w-6 animate-spin inline-block" />
              </div>
            ) : (grouped[v]?.length ?? 0) === 0 ? (
              <div className="py-10 text-center text-emerald-500/70 border border-dashed border-emerald-800/40 rounded-xl">
                No {meta(v).label.toLowerCase()} yet.
                <div className="mt-3">
                  <Button onClick={() => startNew(v)} size="sm" variant="outline" className="border-cyan-700/50 text-cyan-200">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add first
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {grouped[v].map((r) => {
                  const m = meta(r.kind);
                  const Icon = m.icon;
                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl border-2 p-3 sm:p-4 flex flex-wrap items-center gap-3 transition-colors ${
                        r.active ? "border-emerald-800/40 bg-emerald-950/30" : "border-zinc-800/60 bg-zinc-950/40 opacity-70"
                      }`}
                    >
                      <div className="h-14 w-14 rounded-lg overflow-hidden bg-black/60 border border-emerald-900/50 grid place-items-center shrink-0">
                        {r.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-emerald-700" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${m.tint} text-[10px] uppercase tracking-[0.3em] font-black`}>
                            <Icon className="h-3 w-3" /> {m.label}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-emerald-300 border-emerald-700/50">
                            #{r.sku}
                          </Badge>
                          {r.duration_days != null && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-cyan-300 border-cyan-700/50">
                              {r.duration_days === 0 ? "Lifetime" : `${r.duration_days}d`}
                            </Badge>
                          )}
                          {!r.active && (
                            <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] uppercase tracking-wider">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-bold text-emerald-100 truncate">{r.title}</div>
                        <div className="text-xs text-emerald-500/80">
                          {fmtMoney(r.price_cents, r.currency)} · sort {r.sort_order}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button onClick={() => nudgeSort(r, -1)} size="icon" variant="ghost" className="h-8 w-8 text-emerald-300 hover:text-cyan-200" title="Move up">
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => nudgeSort(r, 1)} size="icon" variant="ghost" className="h-8 w-8 text-emerald-300 hover:text-cyan-200" title="Move down">
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1.5 px-2">
                          <Switch checked={r.active} onCheckedChange={(on) => toggle(r, on)} />
                          <span className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-bold">Active</span>
                        </div>
                        <Button onClick={() => startEdit(r)} size="sm" variant="outline" className="h-8 border-cyan-700/50 text-cyan-200 hover:bg-cyan-900/30 font-black uppercase tracking-wider text-xs">
                          Edit
                        </Button>
                        <Button onClick={() => remove(r)} size="icon" variant="ghost" className="h-8 w-8 text-red-300 hover:text-red-200 hover:bg-red-950/40" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {draft && (
        <DraftEditor
          draft={draft}
          busy={busy}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function DraftEditor({
  draft, busy, onChange, onClose, onSave,
}: {
  draft: Draft;
  busy: boolean;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickImage = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large (max 8 MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
      const key = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("store-media")
        .upload(key, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("store-media").getPublicUrl(key);
      set("image_url", pub.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-cyan-800/60 bg-black/95 backdrop-blur p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-black uppercase tracking-wider text-cyan-200">
            {draft.id ? "Edit product" : "New product"}
          </h4>
          <button onClick={onClose} className="text-emerald-400 hover:text-cyan-200" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldShell label="Kind">
            <Select value={draft.kind} onValueChange={(v) => set("kind", v as KindV)}>
              <SelectTrigger className="bg-black/70 border-2 border-emerald-800/50 text-emerald-100 font-bold uppercase tracking-wider text-xs h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map(({ v, label }) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldShell>
          <FieldShell label="SKU (unique, lowercase)">
            <Input value={draft.sku} onChange={(e) => set("sku", e.target.value)} placeholder="vip_30d" />
          </FieldShell>
          <FieldShell label="Title" className="sm:col-span-2">
            <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="VIP Pass · 30 days" />
          </FieldShell>
          <FieldShell label="Description" className="sm:col-span-2">
            <textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full rounded-md bg-black/70 border-2 border-emerald-800/50 text-emerald-100 placeholder:text-emerald-700 text-sm p-2"
              placeholder="Short pitch shown on the catalog card"
            />
          </FieldShell>
          <FieldShell label="Image URL" className="sm:col-span-2">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-stretch">
                <Input
                  value={draft.image_url}
                  onChange={(e) => set("image_url", e.target.value)}
                  placeholder="Upload below or paste https://…"
                  className="flex-1"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickImage(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/40 shrink-0"
                >
                  {uploading
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Uploading…</>
                    : <><Upload className="h-4 w-4 mr-1" />Upload from device</>}
                </Button>
                {draft.image_url && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => set("image_url", "")}
                    className="border-rose-700/50 text-rose-200 hover:bg-rose-900/40 shrink-0"
                    title="Clear image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {draft.image_url && (
                <div className="flex items-center gap-3 rounded-md border border-emerald-900/40 bg-black/40 p-2">
                  <img
                    src={draft.image_url}
                    alt="Product preview"
                    className="h-16 w-16 rounded object-cover bg-black/40"
                  />
                  <span className="text-[11px] text-emerald-700 truncate">{draft.image_url}</span>
                </div>
              )}
            </div>
          </FieldShell>
          <FieldShell label="Price (cents)">
            <Input type="number" min={0} value={draft.price_cents} onChange={(e) => set("price_cents", e.target.value)} />
          </FieldShell>
          <FieldShell label="Currency">
            <Input value={draft.currency} onChange={(e) => set("currency", e.target.value)} placeholder="usd" />
          </FieldShell>
          <FieldShell label="Duration" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={draft.duration_amount}
                disabled={draft.duration_unit === "lifetime" || draft.duration_unit === "n/a"}
                onChange={(e) => set("duration_amount", e.target.value)}
                placeholder={draft.duration_unit === "lifetime" ? "Lifetime" : draft.duration_unit === "n/a" ? "N/A" : "e.g. 30"}
                className="flex-1"
              />
              <Select
                value={draft.duration_unit}
                onValueChange={(v) => set("duration_unit", v as Draft["duration_unit"])}
              >
                <SelectTrigger className="w-[160px] bg-black/70 border-2 border-emerald-800/50 text-emerald-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="n/a">N/A</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="months">Months</SelectItem>
                  <SelectItem value="years">Years</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldShell>
          <FieldShell label="Asset URL (digital/nft download or link)" className="sm:col-span-2">
            <Input value={draft.asset_url} onChange={(e) => set("asset_url", e.target.value)} placeholder="https://…" />
          </FieldShell>
          <FieldShell label="Metadata (JSON)" className="sm:col-span-2">
            <textarea
              value={draft.metadata}
              onChange={(e) => set("metadata", e.target.value)}
              rows={4}
              className="w-full rounded-md bg-black/70 border-2 border-emerald-800/50 text-emerald-100 placeholder:text-emerald-700 text-xs p-2 font-mono"
              placeholder='{ "badge": "lifetime" }'
            />
          </FieldShell>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Switch checked={draft.active} onCheckedChange={(on) => set("active", on)} />
            <span className="text-xs uppercase tracking-wider text-emerald-300 font-black">Active in catalog</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button onClick={onClose} variant="outline" className="border-emerald-800/50 text-emerald-200 uppercase tracking-wider text-xs font-black">
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-black uppercase tracking-wider text-xs font-black">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldShell({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-black">{label}</span>
      {children}
    </label>
  );
}