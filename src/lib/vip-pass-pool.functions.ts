import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VipPassRevealResult =
  | {
      available: true;
      label: string;
      code: string;
      revealed_at: string;
      expires_at: string;
      expires_in: number;
      pool_size: number;
    }
  | { available: false; reason: string; pool_size: number };

export const revealVipPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VipPassRevealResult> => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase.rpc("reveal_vip_pass");
    if (error) throw new Error(error.message);
    return data as VipPassRevealResult;
  });

export type VipPassPoolRow = {
  id: string;
  label: string;
  code: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const listVipPassPool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VipPassPoolRow[]> => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("vip_pass_pool")
      .select("id,label,code,active,sort_order,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as VipPassPoolRow[];
  });

export const upsertVipPassPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string | null;
    label?: string;
    code: string;
    active?: boolean;
    sort_order?: number;
  }) => ({
    id: d.id ? String(d.id) : null,
    label: (d.label ?? "").trim().slice(0, 80),
    code: String(d.code ?? "").trim().slice(0, 200),
    active: d.active === undefined ? true : !!d.active,
    sort_order: Math.max(0, Math.trunc(Number(d.sort_order ?? 0))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    if (!data.code) throw new Error("Code required");
    const { data: id, error } = await supabase.rpc("boss_upsert_vip_pass_pool", {
      _id: data.id,
      _label: data.label,
      _code: data.code,
      _active: data.active,
      _sort_order: data.sort_order,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const deleteVipPassPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase.rpc("boss_delete_vip_pass_pool", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });