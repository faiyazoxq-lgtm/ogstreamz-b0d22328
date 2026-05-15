import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export const scoutUrl = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .inputValidator((data: { url: string }) => {
    try {
      const u = new URL(data.url);
      if (!/^https?:$/.test(u.protocol)) throw new Error("bad");
    } catch {
      throw new Error("Invalid URL");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (!(await isAdmin(supabase, userId))) {
      throw new Error("Admin only");
    }
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: data.url,
        formats: ["markdown", "summary", "links"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Firecrawl ${res.status}: ${text.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const root = json.data ?? json;
    const md: string = root.markdown ?? "";
    // Extract H1/H2/H3 titles from markdown
    const titles = Array.from(md.matchAll(/^#{1,3}\s+(.+)$/gm))
      .map((m) => m[1].trim())
      .filter(Boolean)
      .slice(0, 25);
    return {
      title: root.metadata?.title ?? null,
      summary: root.summary ?? null,
      titles,
      links: (root.links ?? []).slice(0, 30),
      sourceURL: root.metadata?.sourceURL ?? data.url,
    };
  });