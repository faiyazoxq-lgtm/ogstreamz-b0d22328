import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";
import { DEFAULT_LEXICON, LEXICON_CATEGORIES, type Lexicon } from "./swear-enforcer.server";

async function ensureBoss(supabase: any, userId: string) {
  const [{ data: prof }, { data: role }] = await Promise.all([
    supabase.from("profiles").select("rank").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  if (prof?.rank !== "boss" && !role) throw new Error("Boss / admin only");
}

export const getLexicon = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureBoss(supabase, userId);
    const { data, error } = await supabase
      .from("swear_lexicon")
      .select("category, items, updated_at");
    if (error) throw new Error(error.message);
    const lex: Lexicon = { ...DEFAULT_LEXICON };
    let updated_at: string | null = null;
    for (const row of (data ?? []) as Array<{ category: string; items: string[]; updated_at: string }>) {
      if (LEXICON_CATEGORIES.includes(row.category as keyof Lexicon)) {
        (lex as any)[row.category] = row.items ?? [];
      }
      if (!updated_at || row.updated_at > updated_at) updated_at = row.updated_at;
    }
    return { lexicon: lex, defaults: DEFAULT_LEXICON, updated_at };
  });

export const setLexiconCategory = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { category: string; items: string[] }) => {
    if (!LEXICON_CATEGORIES.includes(d.category as keyof Lexicon)) {
      throw new Error("Invalid category");
    }
    const items = (Array.isArray(d.items) ? d.items : [])
      .map((s) => String(s ?? "").trim())
      .filter((s) => s.length > 0 && s.length <= 500)
      .slice(0, 200);
    // For refusal_patterns, validate regex syntax up-front so the boss sees the error here.
    if (d.category === "refusal_patterns") {
      for (const p of items) {
        try { new RegExp(p, "gi"); }
        catch { throw new Error(`Invalid regex: ${p.slice(0, 60)}`); }
      }
    }
    return { category: d.category as keyof Lexicon, items };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureBoss(supabase, userId);
    const { error } = await supabase
      .from("swear_lexicon")
      .upsert({
        category: data.category,
        items: data.items,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true, category: data.category, items: data.items };
  });

export const resetLexiconCategory = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((d: { category: string }) => {
    if (!LEXICON_CATEGORIES.includes(d.category as keyof Lexicon)) {
      throw new Error("Invalid category");
    }
    return { category: d.category as keyof Lexicon };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureBoss(supabase, userId);
    const items = DEFAULT_LEXICON[data.category];
    const { error } = await supabase
      .from("swear_lexicon")
      .upsert({
        category: data.category,
        items,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true, category: data.category, items };
  });