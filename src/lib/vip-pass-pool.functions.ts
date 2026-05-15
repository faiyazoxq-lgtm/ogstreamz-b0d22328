import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type VipPassRevealResult =
  | {
      available: true;
      label: string;
      code: string;
      username?: string | null;
      password?: string | null;
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
  username: string;
  password: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const listVipPassPool = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async ({ context }): Promise<VipPassPoolRow[]> => {
    const { data, error } = await supabaseAdmin.rpc("boss_list_vip_pass_pool");
    if (error) throw new Error(error.message);
    return (data ?? []) as VipPassPoolRow[];
  });

export const upsertVipPassPool = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: {
    id?: string | null;
    label?: string;
    code?: string;
    username?: string;
    password?: string;
    active?: boolean;
    sort_order?: number;
  }) => ({
    id: d.id ? String(d.id) : null,
    label: (d.label ?? "").trim().slice(0, 80),
    code: String(d.code ?? "").trim().slice(0, 200),
    username: String(d.username ?? "").trim().slice(0, 200),
    password: String(d.password ?? "").trim().slice(0, 400),
    active: d.active === undefined ? true : !!d.active,
    sort_order: Math.max(0, Math.trunc(Number(d.sort_order ?? 0))),
  }))
  .handler(async ({ data, context }) => {
    const hasCode = !!data.code;
    const hasCred = !!data.username && !!data.password;
    if (!hasCode && !hasCred) {
      throw new Error("Provide a code OR a username and password");
    }
    const { data: id, error } = await supabaseAdmin.rpc("boss_upsert_vip_pass_pool", {
      _id: data.id,
      _label: data.label,
      _code: data.code,
      _active: data.active,
      _sort_order: data.sort_order,
      _username: data.username || null,
      _password: data.password || null,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const deleteVipPassPool = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.rpc("boss_delete_vip_pass_pool", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });