import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type VaultRevealResult =
  | {
      available: true;
      label: string;
      username: string;
      password: string;
      window_start: string;
      rotates_at: string;
      rotates_in: number;
      pool_size: number;
    }
  | { available: false; reason: string; rotates_in: number };

export const revealVaultCredential = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }): Promise<VaultRevealResult> => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase.rpc("reveal_vault_credential");
    if (error) throw new Error(error.message);
    return data as VaultRevealResult;
  });

export type VaultCredentialRow = {
  id: string;
  label: string;
  username: string;
  password: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const listVaultCredentials = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async ({ context }): Promise<VaultCredentialRow[]> => {
    // Plain-text username/password are no longer stored — fetch via the
    // Boss-only RPC that decrypts on the server. Admin client used because
    // boss_* functions revoke EXECUTE from authenticated.
    const { data, error } = await supabaseAdmin.rpc("boss_list_vault_credentials");
    if (error) throw new Error(error.message);
    return (data ?? []) as VaultCredentialRow[];
  });

export const upsertVaultCredential = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: {
    id?: string | null;
    label?: string;
    username: string;
    password: string;
    active?: boolean;
    sort_order?: number;
  }) => ({
    id: d.id ? String(d.id) : null,
    label: (d.label ?? "").trim().slice(0, 80),
    username: String(d.username ?? "").trim().slice(0, 120),
    password: String(d.password ?? "").trim().slice(0, 120),
    active: d.active === undefined ? true : !!d.active,
    sort_order: Math.max(0, Math.trunc(Number(d.sort_order ?? 0))),
  }))
  .handler(async ({ data, context }) => {
    if (!data.username || !data.password) throw new Error("Username and password required");
    const { data: id, error } = await (supabaseAdmin as any).rpc("boss_upsert_vault_credential", {
      _id: data.id,
      _label: data.label,
      _username: data.username,
      _password: data.password,
      _active: data.active,
      _sort_order: data.sort_order,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const deleteVaultCredential = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.rpc("boss_delete_vault_credential", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
