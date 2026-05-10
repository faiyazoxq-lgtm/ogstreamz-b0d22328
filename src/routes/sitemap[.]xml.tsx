import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://ogstreamz.co.uk";

const STATIC_PATHS = [
  "/", "/music", "/jokes", "/trade", "/connect", "/tools",
  "/battle", "/battlehub", "/syndicate", "/portals", "/store",
  "/auth", "/forgot-password",
];

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function urlNode(loc: string, lastmod?: string, priority = "0.6") {
  return `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}<priority>${priority}</priority></url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const [portals, battles, calculators] = await Promise.all([
          supabase.from("portals").select("slug, kind, updated_at").limit(2000),
          supabase.from("battles").select("slug, updated_at, public").eq("public", true).limit(1000),
          supabase.from("calculators").select("slug, published").eq("published", true).limit(1000),
        ]);

        const lines: string[] = [];
        for (const p of STATIC_PATHS) {
          lines.push(urlNode(`${SITE_URL}${p}`, undefined, p === "/" ? "1.0" : "0.8"));
        }

        const KIND_PREFIX: Record<string, string> = {
          music: "/m", joke: "/p", trade: "/td", news: "/p",
        };
        for (const row of (portals.data ?? []) as Array<{ slug: string; kind: string; updated_at: string | null }>) {
          const prefix = KIND_PREFIX[row.kind];
          if (!prefix) continue;
          lines.push(urlNode(`${SITE_URL}${prefix}/${row.slug}`, row.updated_at ?? undefined));
        }
        for (const row of (battles.data ?? []) as Array<{ slug: string; updated_at: string | null }>) {
          lines.push(urlNode(`${SITE_URL}/b/${row.slug}`, row.updated_at ?? undefined));
        }
        for (const row of (calculators.data ?? []) as Array<{ slug: string }>) {
          lines.push(urlNode(`${SITE_URL}/t/${row.slug}`));
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines.join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=600, s-maxage=3600",
          },
        });
      },
    },
  },
});
