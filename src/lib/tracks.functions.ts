import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

async function generateSunoPrompt(portal: { name: string; style: string; language: string; vibe: string | null }, title: string): Promise<string> {
  const PERPLEXITY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY) {
    return `[Intro] ${portal.style} · ${portal.language}\n[Hook] ${title}\nInstrumentation: ${portal.vibe ?? portal.style}, ${portal.style} percussion, melodic lead, signature ${portal.language} vocal phrasing.\n[Outro] Fade with ambient ${portal.style} texture.`;
  }
  const prompt = `Write a SUNO V5 music style prompt for a track titled "${title}" in the ${portal.style} genre, language ${portal.language}, vibe: ${portal.vibe ?? "n/a"}.
Format the output EXACTLY like a Suno style prompt with bracketed sections [Intro], [Verse], [Hook], [Bridge], [Outro] and a one-line "Instrumentation:" descriptor referencing genre-specific instruments (e.g. "Heavy Urdu Percussion", "Fat Mama Comedy Funk", "808 trap kit", "qanun + ney + clap").
Keep it under 600 characters. Output ONLY the prompt — no explanation.`;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "You are a Suno V5 prompt engineer. Output bracketed style prompts only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8, max_tokens: 400,
    }),
  });
  if (!res.ok) return `[Intro] ${portal.style}\n[Hook] ${title}\nInstrumentation: ${portal.vibe ?? portal.style}\n[Outro] Fade.`;
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content ?? "").trim() || `[Intro] ${portal.style}\n[Hook] ${title}\n[Outro] Fade.`;
}

export const createTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { portal_slug: string; title: string; preview_path: string; full_path: string; price_cents?: number }) => ({
    portal_slug: String(d.portal_slug || "").trim().slice(0, 80),
    title: String(d.title || "").trim().slice(0, 120),
    preview_path: String(d.preview_path || "").trim().slice(0, 300),
    full_path: String(d.full_path || "").trim().slice(0, 300),
    price_cents: Math.max(50, Math.min(50000, Number(d.price_cents || 200) | 0)),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
    if (!data.title || !data.portal_slug || !data.preview_path || !data.full_path) throw new Error("Missing fields");

    const { data: portal } = await supabase
      .from("portals").select("name, style, language, vibe, kind")
      .eq("slug", data.portal_slug).maybeSingle();
    if (!portal) throw new Error("Portal not found");

    const suno_prompt = await generateSunoPrompt(
      { name: portal.name, style: portal.style ?? "", language: portal.language ?? "English", vibe: portal.vibe },
      data.title,
    );

    const { data: track, error } = await supabase
      .from("tracks").insert({
        portal_slug: data.portal_slug,
        title: data.title,
        preview_path: data.preview_path,
        full_path: data.full_path,
        price_cents: data.price_cents,
        suno_prompt,
        created_by: userId,
      }).select("id, title, suno_prompt").single();
    if (error) throw new Error(error.message);
    return { track };
  });

export const listPortalTracks = createServerFn({ method: "POST" })
  .inputValidator((d: { portal_slug: string }) => ({ portal_slug: String(d.portal_slug || "").trim().slice(0, 80) }))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: tracks, error } = await admin
      .from("tracks").select("id, title, preview_path, price_cents, currency")
      .eq("portal_slug", data.portal_slug).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const items = await Promise.all((tracks ?? []).map(async (t: any) => {
      let preview_url: string | null = null;
      if (t.preview_path) {
        const { data: signed } = await admin.storage.from("tracks").createSignedUrl(t.preview_path, 60 * 60);
        preview_url = signed?.signedUrl ?? null;
      }
      return { id: t.id, title: t.title, price_cents: t.price_cents, currency: t.currency, preview_url };
    }));
    return { tracks: items };
  });

export const getTrackOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackIds: string[] }) => ({ trackIds: (d.trackIds ?? []).slice(0, 100).filter((x) => typeof x === "string") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!data.trackIds.length) return { owned: [] as string[] };
    const { data: rows } = await supabase
      .from("track_purchases").select("track_id").eq("user_id", userId).in("track_id", data.trackIds);
    return { owned: (rows ?? []).map((r: any) => r.track_id) };
  });

export const getTrackDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) => ({ trackId: String(d.trackId || "").trim().slice(0, 64) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: owned } = await supabase
      .from("track_purchases").select("id").eq("user_id", userId).eq("track_id", data.trackId).maybeSingle();
    if (!owned) throw new Error("Not unlocked");

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: track } = await admin.from("tracks").select("full_path, title").eq("id", data.trackId).maybeSingle();
    if (!track?.full_path) throw new Error("Track unavailable");
    const { data: signed, error } = await admin.storage.from("tracks").createSignedUrl(track.full_path, 60 * 10, {
      download: `${track.title.replace(/[^a-z0-9]+/gi, "-")}.mp3`,
    });
    if (error) throw new Error(error.message);
    return { url: signed!.signedUrl };
  });

export const createTrackUnlockCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string; returnUrl: string; environment: StripeEnv; customerEmail?: string }) => ({
    trackId: String(d.trackId || "").trim().slice(0, 64),
    returnUrl: String(d.returnUrl || "").slice(0, 500),
    environment: d.environment,
    customerEmail: d.customerEmail,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: track } = await supabase.from("tracks").select("id, title, price_cents, currency").eq("id", data.trackId).maybeSingle();
    if (!track) throw new Error("Track not found");

    const stripe = createStripeClient(data.environment);

    // Resolve customer w/ userId metadata
    let customerId: string | undefined;
    if (userId) {
      const found = await stripe.customers.search({ query: `metadata['userId']:'${userId}'`, limit: 1 });
      if (found.data.length) customerId = found.data[0].id;
      else {
        const created = await stripe.customers.create({
          ...(data.customerEmail && { email: data.customerEmail }),
          metadata: { userId },
        });
        customerId = created.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: track.currency || "usd",
          unit_amount: track.price_cents,
          product_data: {
            name: `0G Track Unlock — ${track.title}`,
            tax_code: "txcd_10000000",
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      ...(customerId && { customer: customerId }),
      managed_payments: { enabled: true },
      metadata: {
        userId,
        trackId: track.id,
        kind: "track_unlock",
      },
    } as any);
    return session.client_secret;
  });