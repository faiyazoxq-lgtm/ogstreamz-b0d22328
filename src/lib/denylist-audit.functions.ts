import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireStrictAuth } from "@/lib/strict-auth";
import { shouldPromoteToBoss, normalizeEmail } from "./boss-policy";

export type AuditHit = {
  source: "db" | "page" | "redirect";
  location: string;     // e.g. table.column row=<id> or URL
  domain: string;       // matched denylist domain
  snippet: string;      // ~120 char excerpt
};

export type AuditReport = {
  ranAt: string;
  blockedDomains: string[];
  hits: AuditHit[];
  scanned: { dbColumns: number; pages: number };
  errors: string[];
};

function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeDomain(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

function buildRegex(domains: string[]): RegExp | null {
  const safe = domains
    .map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean);
  if (!safe.length) return null;
  return new RegExp(
    `(?:https?:\\/\\/)?(?:www\\.)?(?<host>(?:[a-z0-9-]+\\.)*?(?:${safe.join("|")}))(?::\\d+)?(?:\\/[^\\s<"'>]*)?`,
    "gi",
  );
}

function snippetAround(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + len + 50);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
}

/** Columns to scan. Keep this list narrow to URL/text fields. */
const DB_TARGETS: { table: string; columns: string[]; idCol?: string }[] = [
  { table: "store_settings",      columns: ["stream_portal_url"], idCol: "id" },
  { table: "bot_factory",         columns: ["webhook_url", "channel_chat_id"] },
  { table: "custom_hubs",         columns: ["href", "tagline"] },
  { table: "portals",             columns: ["audio_url", "bg_video_url", "audio_snippet_url", "seo_image_url", "seo_description", "seo_title"] },
  { table: "portal_marketing",    columns: ["email_body", "email_subject", "telegram_caption", "expanded_pitch", "seo_description", "seo_title"] },
  { table: "battles",             columns: ["custom_prompt", "scenario", "name"] },
  { table: "ai_logs",             columns: ["message"] },
  { table: "boss_chat_messages",  columns: ["content"] },
  { table: "boss_notes",          columns: ["title", "body"] },
  { table: "jokes",               columns: ["content"] },
  { table: "connect_leads",       columns: ["email_body", "email_subject", "linkedin_url", "news_snippet"] },
  { table: "connect_campaigns",   columns: ["target_url", "scout_summary", "offer"] },
  { table: "agent_api_keys",      columns: ["description", "label"] },
];

/** Public routes to crawl on the live site. */
const PAGE_PATHS = [
  "/",
  "/trade",
  "/music",
  "/jokes",
  "/tools",
  "/vip",
  "/syndicate",
  "/auth",
  "/signin",
  "/connect-telegram",
  "/profile",
];

export const runDenylistAudit = createServerFn({ method: "POST" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }): Promise<AuditReport> => {
    const userEmail = normalizeEmail(context.claims?.email as string | undefined);
    const bossEmail = normalizeEmail(process.env.BOSS_EMAIL);
    if (!shouldPromoteToBoss(userEmail, bossEmail)) {
      throw new Response("Forbidden", { status: 403 });
    }

    const admin = adminClient();
    const errors: string[] = [];
    const hits: AuditHit[] = [];

    // 1. Load denylist
    const { data: denyRows, error: denyErr } = await admin
      .from("domain_denylist")
      .select("domain");
    if (denyErr) {
      return {
        ranAt: new Date().toISOString(),
        blockedDomains: [],
        hits: [],
        scanned: { dbColumns: 0, pages: 0 },
        errors: [`Failed to load denylist: ${denyErr.message}`],
      };
    }
    const blockedDomains = (denyRows ?? []).map((r) => normalizeDomain(r.domain)).filter(Boolean);
    const regex = buildRegex(blockedDomains);
    if (!regex) {
      return {
        ranAt: new Date().toISOString(),
        blockedDomains: [],
        hits: [],
        scanned: { dbColumns: 0, pages: 0 },
        errors: ["Denylist is empty — nothing to audit."],
      };
    }

    // 2. Scan DB columns
    let dbColumnsScanned = 0;
    for (const target of DB_TARGETS) {
      const idCol = target.idCol ?? "id";
      const cols = [idCol, ...target.columns].join(", ");
      try {
        const { data, error } = await (admin.from(target.table) as any).select(cols).limit(2000);
        if (error) {
          errors.push(`${target.table}: ${error.message}`);
          continue;
        }
        dbColumnsScanned += target.columns.length;
        for (const row of ((data ?? []) as unknown as Record<string, unknown>[])) {
          const rowId = String(row[idCol] ?? "?");
          for (const col of target.columns) {
            const raw = row[col];
            if (typeof raw !== "string" || !raw) continue;
            regex.lastIndex = 0;
            let m: RegExpExecArray | null;
            const seen = new Set<string>();
            while ((m = regex.exec(raw)) !== null) {
              const host = normalizeDomain(m.groups?.host ?? m[0]);
              const dedupeKey = `${col}|${host}`;
              if (seen.has(dedupeKey)) continue;
              seen.add(dedupeKey);
              hits.push({
                source: "db",
                location: `${target.table}.${col} · row ${rowId}`,
                domain: host,
                snippet: snippetAround(raw, m.index, m[0].length),
              });
              if (m[0].length === 0) regex.lastIndex++;
            }
          }
        }
      } catch (e) {
        errors.push(`${target.table}: ${(e as Error).message}`);
      }
    }

    // 3. Crawl public pages on this same deployment
    const proto = (process.env.LOVABLE_PUBLIC_PROTO as string | undefined) ?? "https";
    const host =
      (process.env.LOVABLE_PUBLIC_HOST as string | undefined) ??
      "ogstreamz.lovable.app";
    const base = `${proto}://${host}`;
    let pagesScanned = 0;

    await Promise.all(
      PAGE_PATHS.map(async (path) => {
        const url = `${base}${path}`;
        try {
          // First, follow redirects manually to surface them
          const r = await fetch(url, { redirect: "manual", headers: { "user-agent": "OGStreamz-DenylistAudit/1.0" } });
          if (r.status >= 300 && r.status < 400) {
            const loc = r.headers.get("location") ?? "";
            regex.lastIndex = 0;
            const m = regex.exec(loc);
            if (m) {
              hits.push({
                source: "redirect",
                location: `${path} → ${loc}`,
                domain: normalizeDomain(m.groups?.host ?? m[0]),
                snippet: loc.slice(0, 200),
              });
            }
          }
          // Now fetch the body (auto-follow this time)
          const body = await fetch(url, { redirect: "follow", headers: { "user-agent": "OGStreamz-DenylistAudit/1.0" } });
          pagesScanned += 1;
          if (!body.ok) return;
          const text = await body.text();
          regex.lastIndex = 0;
          const seen = new Set<string>();
          let m: RegExpExecArray | null;
          while ((m = regex.exec(text)) !== null) {
            const dom = normalizeDomain(m.groups?.host ?? m[0]);
            if (seen.has(dom)) continue;
            seen.add(dom);
            hits.push({
              source: "page",
              location: url,
              domain: dom,
              snippet: snippetAround(text, m.index, m[0].length),
            });
            if (m[0].length === 0) regex.lastIndex++;
          }
        } catch (e) {
          errors.push(`${path}: ${(e as Error).message}`);
        }
      }),
    );

    return {
      ranAt: new Date().toISOString(),
      blockedDomains,
      hits,
      scanned: { dbColumns: dbColumnsScanned, pages: pagesScanned },
      errors,
    };
  });