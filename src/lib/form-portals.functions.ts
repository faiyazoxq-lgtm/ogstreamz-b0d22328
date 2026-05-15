/**
 * FormHUB server functions.
 *
 * - generateFormSchema (boss): one-shot AI design of fields from a prompt.
 * - createFormPortal (boss): persists a form portal in `public.portals` with
 *   kind='form', schema in `brief`, telegram chat in `telegram_config`.
 * - listMyFormPortals (boss): everything I've spawned.
 * - togglePublishFormPortal (boss): publish / unpublish.
 * - listFormSubmissions (boss): inbox view, optionally scoped to one portal.
 * - submitFormPortal (PUBLIC): anonymous submission. Validates the portal is
 *   published + kind='form', sanitises the payload against the saved schema,
 *   stores a row, and forwards a HTML message to the configured Telegram
 *   chat if one exists.
 * - getFormPortal (PUBLIC): returns the published schema for `/f/$slug`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireStrictAuth } from "@/lib/strict-auth";
import { requireBoss } from "@/integrations/supabase/boss-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  generateFormSchemaAI,
  formatSubmissionForTelegram,
  sendSubmissionToTelegram,
  type FormSchema,
} from "./form-portals.server";

function slugify(name: string): string {
  const base = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "form";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

const GenerateInput = z.object({
  formType: z.enum(["contact", "survey"]),
  name: z.string().trim().min(2).max(80),
  prompt: z.string().trim().min(10).max(800),
});

export const generateFormSchema = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data }) => {
    const schema = await generateFormSchemaAI(data.formType, data.name, data.prompt);
    return { schema };
  });

const CreateInput = z.object({
  name: z.string().trim().min(2).max(80),
  formType: z.enum(["contact", "survey"]),
  schema: z.object({
    formType: z.enum(["contact", "survey"]),
    fields: z.array(z.object({
      name: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
      label: z.string().min(1).max(120),
      type: z.enum(["text", "email", "textarea", "select", "radio", "checkbox", "rating"]),
      required: z.boolean(),
      placeholder: z.string().max(120).optional(),
      options: z.array(z.string().max(60)).max(8).optional(),
      max: z.number().int().min(3).max(10).optional(),
    })).min(1).max(8),
    submitLabel: z.string().min(1).max(30),
    thankYou: z.string().min(1).max(200),
  }),
  telegramChatId: z.string().trim().max(40).optional(),
});

export const createFormPortal = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const slug = slugify(data.name);
    const { data: row, error } = await supabase.from("portals").insert({
      slug,
      name: data.name,
      niche: data.formType === "contact" ? "Contact form" : "Survey",
      kind: "form",
      theme: "street",
      jokes: [],
      brief: { form_schema: data.schema },
      telegram_config: data.telegramChatId ? { chat_id: data.telegramChatId } : {},
      published: false,
      created_by: userId,
    }).select("id, slug, name, published, created_at").single();
    if (error) throw new Error(error.message);
    return { portal: row };
  });

export const listMyFormPortals = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("portals")
      .select("id, slug, name, published, created_at, brief, telegram_config")
      .eq("kind", "form")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { portals: data ?? [] };
  });

export const togglePublishFormPortal = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    published: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("portals")
      .update({ published: data.published })
      .eq("id", data.id)
      .eq("kind", "form");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFormSubmissions = createServerFn({ method: "POST" })
  .middleware([requireBoss])
  .inputValidator((d: unknown) => z.object({
    portalId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    let q = supabase
      .from("form_submissions")
      .select("id, portal_id, payload, submitter_email, telegram_sent, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.portalId) q = q.eq("portal_id", data.portalId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { submissions: rows ?? [] };
  });

// PUBLIC — anyone can fetch a published form portal's schema by slug.
export const getFormPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().trim().min(1).max(80),
  }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("portals")
      .select("id, slug, name, brief, published, kind")
      .eq("slug", data.slug)
      .eq("kind", "form")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.published) return { portal: null as any };
    const schema = (row.brief as any)?.form_schema as FormSchema | undefined;
    if (!schema) return { portal: null as any };
    return {
      portal: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        schema,
      },
    };
  });

// PUBLIC — anyone can submit. Server validates against the saved schema.
const PrimitiveSubmissionValue = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(200)).max(20),
]);

export const submitFormPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().trim().min(1).max(80),
    payload: z.record(z.string().max(40), PrimitiveSubmissionValue),
  }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("portals")
      .select("id, name, brief, telegram_config, published, kind")
      .eq("slug", data.slug)
      .eq("kind", "form")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.published) throw new Error("Form not found");

    const schema = (row.brief as any)?.form_schema as FormSchema | undefined;
    if (!schema) throw new Error("Form is misconfigured");

    // Sanitise payload: only keep declared fields, enforce required + length.
    const cleaned: Record<string, unknown> = {};
    for (const f of schema.fields) {
      const raw = (data.payload as any)[f.name];
      const present = !(raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0));
      if (!present) {
        if (f.required) throw new Error(`Missing field: ${f.label}`);
        continue;
      }
      if (f.type === "checkbox" && Array.isArray(raw)) {
        cleaned[f.name] = raw.map((v) => String(v).slice(0, 200)).slice(0, 20);
      } else if (f.type === "rating") {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new Error(`Invalid rating: ${f.label}`);
        cleaned[f.name] = Math.max(0, Math.min(f.max ?? 5, Math.round(n)));
      } else if (f.type === "email") {
        const s = String(raw).trim().slice(0, 200);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) throw new Error(`Invalid email: ${f.label}`);
        cleaned[f.name] = s;
      } else {
        cleaned[f.name] = String(raw).slice(0, 2000);
      }
    }

    // Pull a contact email if any field looks like one.
    let submitterEmail: string | null = null;
    for (const f of schema.fields) {
      if (f.type === "email" && typeof cleaned[f.name] === "string") {
        submitterEmail = cleaned[f.name] as string;
        break;
      }
    }

    // Telegram first so we can record telegram_sent on the row.
    const chatId = (row.telegram_config as any)?.chat_id as string | undefined;
    let telegramSent = false;
    if (chatId) {
      const text = formatSubmissionForTelegram(row.name, cleaned, schema.fields);
      telegramSent = await sendSubmissionToTelegram(chatId, text);
    }

    const { error: insErr } = await supabaseAdmin.from("form_submissions").insert({
      portal_id: row.id,
      payload: cleaned as any,
      submitter_email: submitterEmail,
      telegram_sent: telegramSent,
    });
    if (insErr) throw new Error(insErr.message);

    return { ok: true, thankYou: schema.thankYou };
  });
