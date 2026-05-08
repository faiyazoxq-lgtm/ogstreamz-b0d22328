import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateLyrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { vibe: string }) => ({
    vibe: String(data.vibe || "").trim().slice(0, 200),
  }))
  .handler(async ({ data, context }) => {
    if (!data.vibe) throw new Error("Vibe required");
    const { supabase } = context as { supabase: any };

    // Charge 2 credits via RPC
    const { error: spendErr } = await supabase.rpc("spend_credits", {
      _amount: 2,
      _reason: "lyric-assistant",
    });
    if (spendErr) {
      const msg = (spendErr.message || "").toLowerCase();
      if (msg.includes("insufficient")) {
        return { ok: false as const, error: "insufficient", lyrics: "" };
      }
      return { ok: false as const, error: spendErr.message, lyrics: "" };
    }

    const LOVABLE = process.env.LOVABLE_API_KEY;
    if (!LOVABLE) return { ok: false as const, error: "AI offline", lyrics: "" };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: "You write OG-style lyrics — gritty, soulful, street. Two short verses + chorus, max 16 lines total. Output lyrics only, no intro." },
          { role: "user", content: `Vibe: ${data.vibe}` },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `AI ${res.status}`, lyrics: "" };
    const json = await res.json();
    const lyrics: string = json?.choices?.[0]?.message?.content ?? "";
    return { ok: true as const, error: null, lyrics: lyrics.trim() };
  });