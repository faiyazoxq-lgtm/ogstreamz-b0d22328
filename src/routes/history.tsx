import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, History, ExternalLink, Sparkles, Music, Laugh, TrendingUp, Rocket, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { requireMember } from "@/lib/route-guards";
export const Route = createFileRoute("/history")({
  beforeLoad: requireMember,
  head: () => ({
    meta: [
      { title: "Portal History — 0G-STREAMZ" },
      { name: "description", content: "Review every portal you've spawned across MusicHUB, JokesHUB, TradeHUB, ConnectHUB and ToolHUB." },
    ],
  }),
  component: HistoryPage,
});

type PortalRow = {
  id: string;
  slug: string;
  name: string;
  niche: string;
  vibe: string | null;
  kind: string;
  view_count: number;
  created_at: string;
};

// Use TanStack Router route literals so <Link to> + params={{slug}} stays
// fully type-checked against the generated route tree.
type PortalRoute = "/p/$slug" | "/m/$slug" | "/td/$slug" | "/t/$slug";
type KindMeta = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: PortalRoute;
  accent: string;
};
const KIND_META: Record<string, KindMeta> = {
  jokes:   { label: "JokesHUB",   icon: Laugh,      to: "/p/$slug",  accent: "text-pink-400" },
  music:   { label: "MusicHUB",   icon: Music,      to: "/m/$slug",  accent: "text-violet-400" },
  trade:   { label: "TradeHUB",   icon: TrendingUp, to: "/td/$slug", accent: "text-emerald-400" },
  connect: { label: "ConnectHUB", icon: Rocket,     to: "/p/$slug",  accent: "text-sky-400" },
  tools:   { label: "ToolHUB",    icon: Wrench,     to: "/t/$slug",  accent: "text-amber-400" },
  joke:    { label: "JokesHUB",   icon: Laugh,      to: "/p/$slug",  accent: "text-pink-400" },
};

const KINDS = ["all", "music", "jokes", "trade", "connect", "tools"] as const;
type Filter = (typeof KINDS)[number];

function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<PortalRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancel = false;
    if (authLoading) return;
    if (!user) { setLoading(false); setRows([]); return; }
    setLoading(true);
    supabase
      .from("portals")
      .select("id,slug,name,niche,vibe,kind,view_count,created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancel) return;
        if (error) { console.error(error); setRows([]); }
        else setRows((data ?? []) as PortalRow[]);
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [user, authLoading]);

  const filtered = (rows ?? []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "jokes") return r.kind === "jokes" || r.kind === "joke";
    return r.kind === filter;
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <header className="flex items-center gap-3 mb-2">
          <History className="h-6 w-6 text-gold" />
          <h1 className="font-[Montserrat] font-black text-3xl">Portal History</h1>
        </header>
        <p className="text-sm text-muted-foreground mb-6">
          Every portal you&apos;ve spawned across all hubs, newest first.
        </p>

        {!user && !authLoading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <Link to="/auth" className="underline text-foreground">Sign in</Link> to see your portal history.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs uppercase tracking-[0.2em] border transition-colors",
                    filter === k
                      ? "bg-gold/15 text-gold border-gold/50"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                  ].join(" ")}
                >
                  {k === "all" ? "All" : KIND_META[k]?.label ?? k}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground self-center">
                {rows ? `${filtered.length} of ${rows.length}` : ""}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your portals…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <Sparkles className="h-6 w-6 text-gold mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No portals yet{filter !== "all" ? ` in ${KIND_META[filter]?.label}` : ""}. Spin one up to see it here.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button asChild size="sm" variant="outline"><Link to="/music">MusicHUB</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link to="/jokes">JokesHUB</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link to="/trade">TradeHUB</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link to="/tools">ToolHUB</Link></Button>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {filtered.map((p) => {
                  const meta = KIND_META[p.kind] ?? KIND_META.jokes;
                  const Icon = meta.icon;
                  const date = new Date(p.created_at);
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-start gap-4 hover:border-gold/40 transition-colors"
                    >
                      <div className={`rounded-lg border border-border bg-background/60 p-2 ${meta.accent}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-[Montserrat] font-bold text-base text-foreground truncate">{p.name}</h3>
                          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.niche}</p>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-2">
                          {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {p.view_count} views
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link to={meta.to} params={{ slug: p.slug }}>
                          Open <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
