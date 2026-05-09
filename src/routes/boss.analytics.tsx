import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, ArrowLeft, RefreshCw, Eye, Users, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BOT_UA_RE = /bot|crawler|spider|crawling|slurp|bingpreview|mediapartners|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|skypeuripreview|pinterest|embedly|quora|outbrain|vkshare|w3c_validator|redditbot|applebot|duckduckbot|yandex|baiduspider|sogou|petalbot|ahrefs|semrush|mj12bot|dotbot|seznambot|ia_archiver|archive\.org_bot|gptbot|claudebot|anthropic|chatgpt-user|perplexitybot|ccbot|google-inspectiontool|google-extended|bytespider|amazonbot|headlesschrome|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|chrome-lighthouse|node-fetch|axios|python-requests|curl|wget|httpclient|okhttp|go-http-client|java\/|libwww-perl|scrapy|nutch|cypress|prerender|prerendercloud|http-client|monitor|uptimerobot|pingdom|statuscake|newrelic|datadog/i;

function isBotEvent(e: { user_agent: string | null }): boolean {
  const ua = (e.user_agent || "").toLowerCase();
  if (!ua) return true; // no UA = almost certainly a script
  return BOT_UA_RE.test(ua);
}

export const Route = createFileRoute("/boss/analytics")({
  head: () => ({
    meta: [
      { title: "Public View Analytics · Boss" },
      { name: "description", content: "Anonymous public view counts for every portal and battle." },
    ],
  }),
  component: AnalyticsPage,
});

type Event = {
  id: string;
  kind: "portal" | "battle";
  slug: string;
  visitor_id: string | null;
  referrer: string | null;
  user_agent: string | null;
  created_at: string;
};

type Row = {
  kind: "portal" | "battle";
  slug: string;
  name: string;
  total: number;
  unique: number;
  last7: number;
  last24: number;
  topReferrer: string;
  lastSeen: string | null;
};

function hostnameOf(ref: string | null): string {
  if (!ref) return "direct";
  try { return new URL(ref).hostname || "direct"; } catch { return "direct"; }
}

function AnalyticsPage() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const isBoss = profile?.rank === "boss" || isAdmin;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState("");
  const [days, setDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isBoss) navigate({ to: "/" });
  }, [user, isBoss, authLoading, navigate]);

  const load = async () => {
    setRefreshing(true);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const [{ data: evs }, { data: portals }, { data: battles }] = await Promise.all([
      supabase
        .from("portal_view_events")
        .select("id, kind, slug, visitor_id, referrer, user_agent, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("portals").select("slug, name"),
      supabase.from("battles").select("slug, name"),
    ]);

    const eventList = (evs as Event[]) ?? [];
    const humanList = eventList.filter((e) => !isBotEvent(e));
    setEvents(humanList);

    const nameMap = new Map<string, string>();
    (portals ?? []).forEach((p: any) => nameMap.set(`portal:${p.slug}`, p.name));
    (battles ?? []).forEach((b: any) => nameMap.set(`battle:${b.slug}`, b.name));

    const now = Date.now();
    const buckets = new Map<string, Event[]>();
    for (const e of eventList) {
      const k = `${e.kind}:${e.slug}`;
      const arr = buckets.get(k) ?? [];
      arr.push(e);
      buckets.set(k, arr);
    }

    const rowList: Row[] = [];
    for (const [key, list] of buckets) {
      const [kind, slug] = key.split(":") as ["portal" | "battle", string];
      const visitors = new Set<string>();
      const refCounts = new Map<string, number>();
      let last7 = 0, last24 = 0;
      let lastSeen: string | null = null;
      for (const e of list) {
        if (e.visitor_id) visitors.add(e.visitor_id);
        const host = hostnameOf(e.referrer);
        refCounts.set(host, (refCounts.get(host) ?? 0) + 1);
        const t = new Date(e.created_at).getTime();
        if (now - t <= 7 * 86400_000) last7++;
        if (now - t <= 86400_000) last24++;
        if (!lastSeen || e.created_at > lastSeen) lastSeen = e.created_at;
      }
      const top = Array.from(refCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      rowList.push({
        kind, slug,
        name: nameMap.get(key) ?? slug,
        total: list.length,
        unique: visitors.size,
        last7, last24,
        topReferrer: top ? `${top[0]} (${top[1]})` : "—",
        lastSeen,
      });
    }
    rowList.sort((a, b) => b.total - a.total);
    setRows(rowList);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { if (isBoss) load(); /* eslint-disable-next-line */ }, [isBoss, days]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.slug.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.kind.includes(q));
  }, [rows, filter]);

  const totals = useMemo(() => {
    const visitors = new Set<string>();
    events.forEach((e) => e.visitor_id && visitors.add(e.visitor_id));
    const refCounts = new Map<string, number>();
    events.forEach((e) => {
      const h = hostnameOf(e.referrer);
      refCounts.set(h, (refCounts.get(h) ?? 0) + 1);
    });
    const topRefs = Array.from(refCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { events: events.length, visitors: visitors.size, topRefs };
  }, [events]);

  if (authLoading || !isBoss) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-6 pb-28 md:pb-12 space-y-6">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6" style={{ color: "#3ad6ff" }} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#3ad6ff" }}>0G · Public View Analytics</p>
              <h1 className="syndicate-header text-2xl md:text-3xl text-white/95">Anonymous Visits</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/boss" className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Boss
            </Link>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/65 max-w-2xl">
          Every public visit to a portal or battle is logged anonymously (no account required). Visitors are deduplicated per browser via a local id.
        </p>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={`Events (last ${days}d)`} value={totals.events} icon={<Eye className="h-4 w-4" />} />
          <Stat label="Unique visitors" value={totals.visitors} icon={<Users className="h-4 w-4" />} />
          <Stat label="Tracked pages" value={rows.length} icon={<Globe className="h-4 w-4" />} />
          <Stat label="Top referrer" value={totals.topRefs[0]?.[0] ?? "—"} icon={<Globe className="h-4 w-4" />} />
        </div>
      </header>

      <section className="glass-obsidian-cmd rounded-2xl p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, slug, or kind…" className="max-w-xs" />
          <div className="flex items-center gap-1 ml-auto">
            {[7, 30, 90].map((d) => (
              <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d as 7 | 30 | 90)}>
                {d}d
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={load} disabled={refreshing}>
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public views recorded in this window yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/50 border-b border-white/10">
                  <th className="py-2 pr-3">Page</th>
                  <th className="py-2 px-2">Kind</th>
                  <th className="py-2 px-2 text-right">Total</th>
                  <th className="py-2 px-2 text-right">Unique</th>
                  <th className="py-2 px-2 text-right">7d</th>
                  <th className="py-2 px-2 text-right">24h</th>
                  <th className="py-2 px-2">Top referrer</th>
                  <th className="py-2 px-2">Last seen</th>
                  <th className="py-2 pl-2 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const href = r.kind === "portal" ? `/p/${r.slug}` : `/b/${r.slug}`;
                  return (
                    <tr key={`${r.kind}:${r.slug}`} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-white/90">{r.name}</div>
                        <div className="text-[11px] text-white/40 terminal-mono">/{r.kind === "portal" ? "p" : "b"}/{r.slug}</div>
                      </td>
                      <td className="py-2 px-2">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/15 text-white/70">{r.kind}</span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.total}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.unique}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.last7}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.last24}</td>
                      <td className="py-2 px-2 text-white/70">{r.topReferrer}</td>
                      <td className="py-2 px-2 text-white/50 text-xs">{r.lastSeen ? new Date(r.lastSeen).toLocaleString() : "—"}</td>
                      <td className="py-2 pl-2 text-right">
                        <a href={href} target="_blank" rel="noreferrer" className="text-xs underline text-[color:var(--syndicate-glow)]">open</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totals.topRefs.length > 0 && (
        <section className="glass-obsidian-cmd rounded-2xl p-4 md:p-5">
          <h2 className="syndicate-header text-sm mb-3" style={{ color: "var(--syndicate-glow)" }}>Top referrers (window total)</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {totals.topRefs.map(([host, n]) => (
              <li key={host} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="text-white/80">{host}</span>
                <span className="tabular-nums text-white/60">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
        {icon}{label}
      </div>
      <div className="mt-1 syndicate-header text-xl text-white/95 truncate">{value}</div>
    </div>
  );
}