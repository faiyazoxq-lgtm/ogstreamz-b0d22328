import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Music2, Smile, Wrench, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TrackHit = { kind: "track"; id: string; title: string; portal_slug: string };
type JokeHit = { kind: "joke"; id: string; content: string; keyword: string | null };
type ToolHit = { kind: "tool"; id: string; slug: string; name: string; description: string | null };
type Hit = TrackHit | JokeHit | ToolHit;

const KIND_ICON = { track: Music2, joke: Smile, tool: Wrench } as const;
const TOOL_PAGE_SIZE = 8;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (!t || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(t)})`, "ig"));
  const lower = t.toLowerCase();
  return (
    <>
      {parts.map((p, i) =>
        p && p.toLowerCase() === lower ? (
          <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function BossSearch({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [topHits, setTopHits] = useState<Hit[]>([]); // tracks + jokes
  const [toolHits, setToolHits] = useState<ToolHit[]>([]);
  const [toolPage, setToolPage] = useState(0);
  const [toolsHasMore, setToolsHasMore] = useState(false);
  const [toolsLoadingMore, setToolsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const reqIdRef = useRef(0);
  const navigate = useNavigate();

  const hits = useMemo<Hit[]>(() => [...topHits, ...toolHits], [topHits, toolHits]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setTopHits([]); setToolHits([]); setToolPage(0); setToolsHasMore(false); setLoading(false);
      return;
    }
    setLoading(true);
    const reqId = ++reqIdRef.current;
    const handle = setTimeout(async () => {
      const like = `%${term.replace(/[%_]/g, "")}%`;
      const [tracks, jokes, tools] = await Promise.all([
        supabase.from("tracks")
          .select("id, title, portal_slug")
          .or(`title.ilike.${like},portal_slug.ilike.${like}`)
          .limit(6),
        supabase.from("jokes")
          .select("id, content, keyword")
          .or(`content.ilike.${like},keyword.ilike.${like}`)
          .limit(6),
        supabase.from("calculators")
          .select("id, slug, name, description")
          .or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
          .range(0, TOOL_PAGE_SIZE),
      ]);
      if (reqId !== reqIdRef.current) return; // stale
      const top: Hit[] = [];
      for (const t of (tracks.data ?? []) as Array<{ id: string; title: string; portal_slug: string }>) {
        top.push({ kind: "track", id: t.id, title: t.title, portal_slug: t.portal_slug });
      }
      for (const j of (jokes.data ?? []) as Array<{ id: string; content: string; keyword: string | null }>) {
        top.push({ kind: "joke", id: j.id, content: j.content, keyword: j.keyword });
      }
      const toolRows = (tools.data ?? []) as Array<{ id: string; slug: string; name: string; description: string | null }>;
      const toolsPage0: ToolHit[] = toolRows.slice(0, TOOL_PAGE_SIZE).map((c) => ({
        kind: "tool", id: c.id, slug: c.slug, name: c.name, description: c.description,
      }));
      setTopHits(top);
      setToolHits(toolsPage0);
      setToolPage(0);
      setToolsHasMore(toolRows.length > TOOL_PAGE_SIZE);
      setHighlight(0);
      setLoading(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  const loadMoreTools = useCallback(async () => {
    const term = q.trim();
    if (!term || toolsLoadingMore || !toolsHasMore) return;
    setToolsLoadingMore(true);
    const reqId = reqIdRef.current;
    const nextPage = toolPage + 1;
    const from = nextPage * TOOL_PAGE_SIZE;
    const to = from + TOOL_PAGE_SIZE; // request one extra to detect more
    const like = `%${term.replace(/[%_]/g, "")}%`;
    const { data } = await supabase.from("calculators")
      .select("id, slug, name, description")
      .or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
      .range(from, to);
    if (reqId !== reqIdRef.current) { setToolsLoadingMore(false); return; }
    const rows = (data ?? []) as Array<{ id: string; slug: string; name: string; description: string | null }>;
    const pageRows: ToolHit[] = rows.slice(0, TOOL_PAGE_SIZE).map((c) => ({
      kind: "tool", id: c.id, slug: c.slug, name: c.name, description: c.description,
    }));
    setToolHits((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...pageRows.filter((r) => !seen.has(r.id))];
    });
    setToolPage(nextPage);
    setToolsHasMore(rows.length > TOOL_PAGE_SIZE);
    setToolsLoadingMore(false);
  }, [q, toolPage, toolsHasMore, toolsLoadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !toolsHasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMoreTools();
    }, { root: el.closest("[data-search-panel]"), rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [toolsHasMore, loadMoreTools, toolHits.length]);

  const showPanel = open && q.trim().length > 0;
  const empty = useMemo(() => !loading && hits.length === 0 && q.trim().length > 0, [loading, hits, q]);
  const firstToolIndex = topHits.length;

  function goHit(h: Hit) {
    if (h.kind === "tool") {
      setOpen(false); setQ("");
      navigate({ to: "/t/$slug", params: { slug: h.slug } });
    } else if (h.kind === "track" && h.portal_slug) {
      setOpen(false); setQ("");
      navigate({ to: "/m/$slug", params: { slug: h.portal_slug } });
    }
    // jokes: keep panel open, no destination
  }

  function labelFor(h: Hit) {
    if (h.kind === "track") return { title: h.title, sub: h.portal_slug ? `Portal: ${h.portal_slug}` : "Track" };
    if (h.kind === "joke") return { title: h.content, sub: h.keyword ?? "Joke" };
    return { title: h.name, sub: h.description ?? "Tool" };
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(hits.length - 1, h + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
            else if (e.key === "Enter" && hits[highlight]) { e.preventDefault(); goHit(hits[highlight]); }
          }}
          placeholder="Search tracks, jokes, tools…"
          aria-label="Search Boss content"
          className="w-full pl-8 pr-8 py-2 h-9 text-sm rounded-md bg-secondary/60 border border-border focus:border-primary focus:bg-background outline-none transition-colors"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showPanel && (
        <div data-search-panel className="absolute left-0 right-0 mt-2 w-[min(92vw,420px)] max-h-[70vh] overflow-auto rounded-md border border-border bg-popover shadow-lg z-50">
          {loading && (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {empty && (
            <div className="p-3 text-sm text-muted-foreground">
              No matches for “{q}”.
            </div>
          )}
          {!loading && hits.length > 0 && (
            <ul className="py-1">
              {hits.map((h, i) => {
                const Icon = KIND_ICON[h.kind];
                const active = i === highlight;
                const { title, sub } = labelFor(h);
                const clickable = h.kind === "tool" || (h.kind === "track" && !!h.portal_slug);
                return (
                  <li key={`${h.kind}:${h.id}`}>
                    {h.kind === "tool" && i === firstToolIndex && firstToolIndex > 0 && (
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Tools</div>
                    )}
                    <button
                      type="button"
                      onClick={() => goHit(h)}
                      onMouseEnter={() => setHighlight(i)}
                      disabled={!clickable}
                      className={`w-full text-left flex items-start gap-3 px-3 py-2 text-sm outline-none ${active ? "bg-secondary" : "hover:bg-secondary/70"} ${clickable ? "" : "cursor-default"}`}
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-gold/80 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-foreground line-clamp-2">
                          <Highlight text={title} term={q} />
                        </span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          <span className="uppercase tracking-wider mr-1.5">{h.kind}</span>
                          <Highlight text={sub} term={q} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && toolHits.length > 0 && (toolsHasMore || toolsLoadingMore) && (
            <div ref={sentinelRef} className="flex items-center justify-center gap-2 p-2 text-[11px] text-muted-foreground">
              {toolsLoadingMore ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Loading more tools…</>
              ) : (
                <button
                  type="button"
                  onClick={loadMoreTools}
                  className="rounded border border-border px-2 py-1 hover:bg-secondary"
                >
                  Load more tools
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
