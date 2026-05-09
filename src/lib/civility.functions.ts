import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Tbl = "portals" | "battles" | "custom_hubs";
const TABLES: Tbl[] = ["portals", "battles", "custom_hubs"];

async function ensureBoss(supabase: any, userId: string) {
  const [{ data: prof }, { data: role }] = await Promise.all([
    supabase.from("profiles").select("rank").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  if (prof?.rank !== "boss" && !role) throw new Error("Boss / admin only");
}

export const getCivility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("civility_settings")
      .select("swear_default, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { swear_default: !!data?.swear_default, updated_at: data?.updated_at ?? null };
  });

export const setCivilityDefault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean; applyToAll?: boolean }) => ({
    enabled: !!d.enabled,
    applyToAll: !!d.applyToAll,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await ensureBoss(supabase, userId);

    const { error } = await supabase
      .from("civility_settings")
      .upsert({ id: 1, swear_default: data.enabled, updated_at: new Date().toISOString(), updated_by: userId });
    if (error) throw new Error(error.message);

    let updated = 0;
    if (data.applyToAll) {
      for (const t of TABLES) {
        const { count, error: e } = await supabase
          .from(t)
          .update({ swear_chat_enabled: data.enabled }, { count: "exact" })
          .neq("swear_chat_enabled", data.enabled);
        if (e) throw new Error(e.message);
        updated += count ?? 0;
      }
    }
    return { ok: true, swear_default: data.enabled, updated };
  });

type Item = {
  table: Tbl; id: string; name: string; subtitle: string;
  swear_chat_enabled: boolean; created_at: string;
};

export const listSwearItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await ensureBoss(supabase, userId);

    const [portals, battles, hubs] = await Promise.all([
      supabase.from("portals")
        .select("id, name, niche, kind, swear_chat_enabled, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("battles")
        .select("id, name, tagline, swear_chat_enabled, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("custom_hubs")
        .select("id, title, tagline, swear_chat_enabled, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (portals.error) throw new Error(portals.error.message);
    if (battles.error) throw new Error(battles.error.message);
    if (hubs.error)    throw new Error(hubs.error.message);

    const items: Item[] = [
      ...(portals.data ?? []).map((r: any) => ({
        table: "portals" as Tbl, id: r.id, name: r.name,
        subtitle: `${r.kind ?? "portal"} · ${r.niche ?? ""}`.trim(),
        swear_chat_enabled: !!r.swear_chat_enabled, created_at: r.created_at,
      })),
      ...(battles.data ?? []).map((r: any) => ({
        table: "battles" as Tbl, id: r.id, name: r.name,
        subtitle: r.tagline || "battle",
        swear_chat_enabled: !!r.swear_chat_enabled, created_at: r.created_at,
      })),
      ...(hubs.data ?? []).map((r: any) => ({
        table: "custom_hubs" as Tbl, id: r.id, name: r.title,
        subtitle: r.tagline || "custom hub",
        swear_chat_enabled: !!r.swear_chat_enabled, created_at: r.created_at,
      })),
    ];
    return { items };
  });