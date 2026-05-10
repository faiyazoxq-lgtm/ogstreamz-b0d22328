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

function canonicalize(loc: string) {
  // Absolute URL, lowercase host, strip trailing slash (except root), drop fragments/query.
  try {
    const u = new URL(loc);
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.toLowerCase();
    let path = u.pathname.replace(/\/+$/g, "");
    if (path === "") path = "/";
    u.pathname = path;
    return u.toString();
  } catch {
    return loc;
  }
}

function toIsoLastmod(value?: string | null) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  // W3C Datetime / ISO 8601 — accepted by Google for <lastmod>.
  return d.toISOString();
}

function urlNode(loc: string, lastmod?: string | null, priority = "0.6") {
  const canonical = canonicalize(loc);
  const iso = toIsoLastmod(lastmod);
  return `  <url>
    <loc>${xmlEscape(canonical)}</loc>
    <xhtml:link rel="canonical" href="${xmlEscape(canonical)}" />${iso ? `\n    <lastmod>${iso}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const [portals, battles, calculators] = await Promise.all([
          supabase.from("portals").select("slug, kind, updated_at").limit(2000),
          supabase.from("battles").select("slug, updated_at, public").eq("public", true).limit(1000),
          supabase.from("calculators").select("slug, updated_at, published").eq("published", true).limit(1000),
        ]);

        // Use the most recent dynamic update as the lastmod for static pages so
        // crawlers re-check landing pages whenever fresh content lands.
        const allTimes = [
          ...((portals.data ?? []) as Array<{ updated_at: string | null }>).map((r) => r.updated_at),
          ...((battles.data ?? []) as Array<{ updated_at: string | null }>).map((r) => r.updated_at),
          ...((calculators.data ?? []) as Array<{ updated_at: string | null }>).map((r) => r.updated_at),
        ]
          .filter((v): v is string => !!v)
          .map((v) => new Date(v).getTime())
          .filter((n) => !Number.isNaN(n));
        const latest = allTimes.length ? new Date(Math.max(...allTimes)).toISOString() : new Date().toISOString();

        const lines: string[] = [];
        for (const p of STATIC_PATHS) {
          lines.push(urlNode(`${SITE_URL}${p}`, latest, p === "/" ? "1.0" : "0.8"));
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
        for (const row of (calculators.data ?? []) as Array<{ slug: string; updated_at: string | null }>) {
          lines.push(urlNode(`${SITE_URL}/t/${row.slug}`, row.updated_at ?? undefined));
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
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
