import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

const KINDS = ["vip_pass", "streams_pass", "digital", "nft"] as const;
type Kind = typeof KINDS[number];

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type StoreProductRow = {
  id: string;
  sku: string;
  kind: Kind;
  title: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  currency: string;
  duration_days: number | null;
  asset_url: string | null;
  metadata: Json;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

async function isBoss(supabase: any) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase.rpc("is_boss", { _uid: uid });
  if (error) return false;
  return !!data;
}

function sanitizeMetadata(input: unknown): Json {
  if (!input) return {};
  if (typeof input === "string") {
    try { return JSON.parse(input) as Json; } catch { throw new Error("Metadata must be valid JSON"); }
  }
  if (typeof input === "object") return input as Json;
  return {};
}

export const listStoreProducts = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { data, error } = await supabase
      .from("store_products")
      .select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { products: (data ?? []) as StoreProductRow[] };
  });

type UpsertInput = {
  id?: string | null;
  sku: string;
  kind: Kind;
  title: string;
  description?: string | null;
  image_url?: string | null;
  price_cents: number;
  currency?: string;
  duration_days?: number | null;
  asset_url?: string | null;
  metadata?: unknown;
  active?: boolean;
  sort_order?: number;
};

export const upsertStoreProduct = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: UpsertInput) => {
    const sku = String(d.sku ?? "").trim().toLowerCase().replace(/[^a-z0-9_\-]/g, "_").slice(0, 64);
    const title = String(d.title ?? "").trim().slice(0, 160);
    if (!sku) throw new Error("SKU is required");
    if (!title) throw new Error("Title is required");
    if (!KINDS.includes(d.kind)) throw new Error("Invalid kind");
    const price = Math.max(0, Math.trunc(Number(d.price_cents)));
    if (!Number.isFinite(price)) throw new Error("Invalid price");
    return {
      id: d.id ? String(d.id) : null,
      sku,
      kind: d.kind,
      title,
      description: d.description ? String(d.description).slice(0, 2000) : null,
      image_url: d.image_url ? String(d.image_url).slice(0, 1000) : null,
      price_cents: price,
      currency: (d.currency ?? "usd").toString().toLowerCase().slice(0, 8),
      duration_days: d.duration_days == null || d.duration_days === undefined
        ? null
        : Math.max(0, Math.trunc(Number(d.duration_days))),
      asset_url: d.asset_url ? String(d.asset_url).slice(0, 1000) : null,
      metadata: sanitizeMetadata(d.metadata),
      active: d.active === undefined ? true : !!d.active,
      sort_order: Math.trunc(Number(d.sort_order ?? 0)) || 0,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const payload: any = {
      sku: data.sku,
      kind: data.kind,
      title: data.title,
      description: data.description,
      image_url: data.image_url,
      price_cents: data.price_cents,
      currency: data.currency,
      duration_days: data.duration_days,
      asset_url: data.asset_url,
      metadata: data.metadata,
      active: data.active,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("store_products")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { product: row as StoreProductRow };
    }
    const { data: row, error } = await supabase
      .from("store_products")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { product: row as StoreProductRow };
  });

export const setStoreProductActive = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { id: string; active: boolean }) => ({
    id: String(d.id),
    active: !!d.active,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { error } = await supabase
      .from("store_products")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStoreProductSort = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { id: string; sort_order: number }) => ({
    id: String(d.id),
    sort_order: Math.trunc(Number(d.sort_order)) || 0,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { error } = await supabase
      .from("store_products")
      .update({ sort_order: data.sort_order })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStoreProduct = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!(await isBoss(supabase))) throw new Error("Boss only");
    const { error } = await supabase.from("store_products").delete().eq("id", data.id);
    if (error) {
      // Likely FK from pass_orders — guide the user
      const msg = /violates foreign key/i.test(error.message)
        ? "Cannot delete: this product has existing orders. Mark it inactive instead."
        : error.message;
      throw new Error(msg);
    }
    return { ok: true };
  });