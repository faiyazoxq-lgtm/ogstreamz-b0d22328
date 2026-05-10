import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Tags, Coins, Power, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listStoreProducts,
  upsertStoreProduct,
  setStoreProductActive,
  deleteStoreProduct,
  type StoreProductRow,
} from "@/lib/store-products.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/boss/pricing")({
  head: () => ({ meta: [{ title: "Pricing — Boss" }] }),
  component: PricingPage,
});

const KINDS = [
  { value: "vip_pass", label: "VIP Pass" },
  { value: "streams_pass", label: "Streams Pass" },
  { value: "digital", label: "Digital" },
  { value: "nft", label: "NFT" },
] as const;

type Kind = typeof KINDS[number]["value"];

type Draft = {
  id: string | null;
  sku: string;
  kind: Kind;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  duration_days: string;
  active: boolean;
  sort_order: number;
};

const blank: Draft = {
  id: null,
  sku: "",
  kind: "vip_pass",
  title: "",
  description: "",
  price_cents: 0,
  currency: "usd",
  duration_days: "",
  active: true,
  sort_order: 0,
};

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() })
      .format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function PricingPage() {
  const list = useServerFn(listStoreProducts);
  const upsert = useServerFn(upsertStoreProduct);
  const toggle = useServerFn(setStoreProductActive);
  const del = useServerFn(deleteStoreProduct);

  const [rows, setRows] = useState<StoreProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(blank);
  const [saving, setSaving] = useState(false);

  const [creditsPerSong, setCreditsPerSong] = useState<number>(5);
  const [savingCredits, setSavingCredits] = useState(false);

  const [streamUrl, setStreamUrl] = useState<string>("https://ogstreamz.co.uk");
  const [savingStream, setSavingStream] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await list();
      setRows(r.products);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    supabase
      .from("store_settings")
      .select("credits_per_song, stream_portal_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.credits_per_song) setCreditsPerSong(data.credits_per_song);
        const u = (data as { stream_portal_url?: string } | null)?.stream_portal_url;
        if (u) setStreamUrl(u);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, StoreProductRow[]>();
    for (const r of rows) {
      const arr = m.get(r.kind) ?? [];
      arr.push(r);
      m.set(r.kind, arr);
    }
    return m;
  }, [rows]);

  function startEdit(row: StoreProductRow) {
    setDraft({
      id: row.id,
      sku: row.sku,
      kind: row.kind as Kind,
      title: row.title,
      description: row.description ?? "",
      price_cents: row.price_cents,
      currency: row.currency,
      duration_days: row.duration_days?.toString() ?? "",
      active: row.active,
      sort_order: row.sort_order,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSave() {
    if (!draft.sku.trim() || !draft.title.trim()) {
      toast.error("SKU and title are required");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: draft.id,
          sku: draft.sku,
          kind: draft.kind,
          title: draft.title,
          description: draft.description || null,
          price_cents: draft.price_cents,
          currency: draft.currency,
          duration_days: draft.duration_days ? Number(draft.duration_days) : null,
          active: draft.active,
          sort_order: draft.sort_order,
        },
      });
      toast.success(draft.id ? "Updated" : "Created");
      setDraft(blank);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(row: StoreProductRow) {
    try {
      await toggle({ data: { id: row.id, active: !row.active } });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function onDelete(row: StoreProductRow) {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    try {
      await del({ data: { id: row.id } });
      toast.success("Deleted");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  async function saveCreditsPerSong() {
    const n = Math.max(1, Math.trunc(Number(creditsPerSong)) || 1);
    setSavingCredits(true);
    const { error } = await supabase
      .from("store_settings")
      .update({ credits_per_song: n })
      .eq("id", 1);
    setSavingCredits(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCreditsPerSong(n);
    toast.success("Saved");
  }

  async function saveStreamUrl() {
    const raw = streamUrl.trim();
    let normalized = raw;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      const u = new URL(normalized);
      if (!/^https?:$/.test(u.protocol)) throw new Error("bad protocol");
      normalized = u.origin + (u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, ""));
    } catch {
      toast.error("Enter a valid URL (e.g. https://ogstreamz.co.uk)");
      return;
    }
    setSavingStream(true);
    const { error } = await supabase
      .from("store_settings")
      .update({ stream_portal_url: normalized })
      .eq("id", 1);
    setSavingStream(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStreamUrl(normalized);
    toast.success("Stream portal updated");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
          <Tags className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricing</h1>
          <p className="text-sm text-muted-foreground">
            Manage store products, prices, and credit-spend rates.
          </p>
        </div>
      </header>

      {/* Settings card */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Coins className="h-4 w-4" />
          Credit-spend rates
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="cps">Credits per song</Label>
            <Input
              id="cps"
              type="number"
              min={1}
              value={creditsPerSong}
              onChange={(e) => setCreditsPerSong(Number(e.target.value))}
            />
          </div>
          <Button onClick={saveCreditsPerSong} disabled={savingCredits}>
            {savingCredits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </section>

      {/* Stream portal domain card */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Tv className="h-4 w-4" />
          0G STREAMZ portal domain
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Where the “0G STREAMZ Profile” card on /welcome sends people to sign in.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Label htmlFor="streamurl">Stream portal URL</Label>
            <Input
              id="streamurl"
              type="url"
              inputMode="url"
              placeholder="https://ogstreamz.co.uk"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
            />
          </div>
          <Button onClick={saveStreamUrl} disabled={savingStream}>
            {savingStream ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </section>

      {/* Editor */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {draft.id ? "Edit product" : "New product"}
          </h2>
          {draft.id && (
            <Button variant="ghost" size="sm" onClick={() => setDraft(blank)}>
              Cancel
            </Button>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={draft.sku}
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
              placeholder="e.g. vip_30d"
            />
          </div>
          <div>
            <Label htmlFor="kind">Kind</Label>
            <Select value={draft.kind} onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as Kind }))}>
              <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="price">Price (cents)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              value={draft.price_cents}
              onChange={(e) => setDraft((d) => ({ ...d, price_cents: Math.max(0, Number(e.target.value) || 0) }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {fmt(draft.price_cents, draft.currency)}
            </p>
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={draft.currency}
              onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toLowerCase() }))}
              maxLength={8}
            />
          </div>
          <div>
            <Label htmlFor="dur">Duration (days)</Label>
            <Input
              id="dur"
              type="number"
              min={0}
              value={draft.duration_days}
              onChange={(e) => setDraft((d) => ({ ...d, duration_days: e.target.value }))}
              placeholder="optional"
            />
          </div>
          <div>
            <Label htmlFor="sort">Sort order</Label>
            <Input
              id="sort"
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft((d) => ({ ...d, sort_order: Math.trunc(Number(e.target.value)) || 0 }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 sm:col-span-2">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Inactive products are hidden from the store.</div>
            </div>
            <Switch checked={draft.active} onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {draft.id ? "Save changes" : "Create product"}
          </Button>
        </div>
      </section>

      {/* List */}
      <section className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading products…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No products yet. Create one above.
          </div>
        ) : (
          KINDS.filter((k) => grouped.has(k.value)).map((k) => (
            <div key={k.value} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{k.label}</span>
                <span>{grouped.get(k.value)!.length} item(s)</span>
              </div>
              <ul className="divide-y divide-border">
                {grouped.get(k.value)!.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.title}</span>
                        {!row.active && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.sku} · {fmt(row.price_cents, row.currency)}
                        {row.duration_days ? ` · ${row.duration_days}d` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onToggle(row)} title={row.active ? "Disable" : "Enable"}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(row)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}