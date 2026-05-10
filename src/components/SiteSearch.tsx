import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Music2, Smile, TrendingUp, Newspaper, Swords, Wrench, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Route literals from the generated route tree — keeps navigate() type-safe.
type HitRoute = "/p/$slug" | "/m/$slug" | "/td/$slug" | "/b/$slug" | "/t/$slug";

type Hit = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  kind: "music" | "joke" | "trade" | "news" | "battle" | "tool";
  to: HitRoute;
};

const KIND_ICON: Record<Hit["kind"], React.ComponentType<{ className?: string }>> = {
  music: Music2, joke: Smile, trade: TrendingUp, news: Newspaper, battle: Swords, tool: Wrench,
};

const KIND_TO_ROUTE: Record<Exclude<Hit["kind"], "battle" | "tool">, HitRoute> = {
  music: "/m/$slug", joke: "/p/$slug", trade: "/td/$slug", news: "/p/$slug",
};

function portalKindToHit(p: { id: string; slug: string; name: string; niche: string | null; kind: string }): Hit | null {
  const kind = (p.kind === "music" || p.kind === "joke" || p.kind === "trade" || p.kind === "news")
    ? (p.kind as "music" | "joke" | "trade" | "news") : null;
  if (!kind) return null;
  return {
    id: p.id, slug: p.slug, name: p.name,
    subtitle: p.niche ?? "Portal",
    kind,
    to: KIND_TO_ROUTE[kind],
  };
}

export function SiteSearch({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  // Click outside closes
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ⌘/Ctrl-K to focus
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

  // Debounced search
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${term.replace(/[%_]/g, "")}%`;
      const [portals, battles, tools] = await Promise.all([
        supabase.from("portals")
          .select("id, slug, name, niche, kind")
          .or(`name.ilike.${like},slug.ilike.${like},niche.ilike.${like}`)
          .limit(8),
        supabase.from("battles")
          .select("id, slug, name, tagline, public")
          .eq("public", true)
          .or(`name.ilike.${like},slug.ilike.${like},tagline.ilike.${like}`)
          .limit(4),
        supabase.from("calculators")
          .select("id, slug, name, description, published")
          .eq("published", true)
          .or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
          .limit(4),
      ]);
      const out: Hit[] = [];
      for (const p of portals.data ?? []) {
        const h = portalKindToHit(p as never);
        if (h) out.push(h);
      }
      for (const b of (battles.data ?? []) as Array<{ id: string; slug: string; name: string; tagline: string | null }>) {
        out.push({ id: b.id, slug: b.slug, name: b.name, subtitle: b.tagline ?? "Battle", kind: "battle", to: "/b/$slug" });
      }
      for (const t of (tools.data ?? []) as Array<{ id: string; slug: string; name: string; description: string | null }>) {
        out.push({ id: t.id, slug: t.slug, name: t.name, subtitle: t.description ?? "Tool", kind: "tool", to: "/t/$slug" });
      }
      setHits(out);
      setHighlight(0);
      setLoading(false);
    }, 220);
    return () => clearTimeout(handle);
  }, [q]);

  const showPanel = open && (q.trim().length > 0);
  const empty = useMemo(() => !loading && hits.length === 0 && q.trim().length > 0, [loading, hits, q]);

  function goHit(h: Hit) {
    setOpen(false);
    setQ("");
    navigate({ to: h.to, params: { slug: h.slug } });
  }
  function goPortals() {
    setOpen(false);
    setQ("");
    navigate({ to: "/portals" });
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
          placeholder="Search portals, battles, tools…"
          aria-label="Search portals"
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
        <div className="absolute right-0 mt-2 w-[min(92vw,420px)] max-h-[70vh] overflow-auto rounded-md border border-border bg-popover shadow-lg z-50">
          {loading && (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {empty && (
            <div className="p-3 text-sm text-muted-foreground">
              No matches for “{q}”. Try a hub name like <span className="text-foreground">trade</span> or a niche.
            </div>
          )}
          {!loading && hits.length > 0 && (
            <ul className="py-1">
              {hits.map((h, i) => {
                const Icon = KIND_ICON[h.kind];
                const active = i === highlight;
                return (
                  <li key={`${h.kind}:${h.id}`}>
                    <a
                      href={`${h.to.replace("$slug", h.slug)}`}
                      onClick={(e) => { e.preventDefault(); goHit(h); }}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex items-start gap-3 px-3 py-2 text-sm outline-none ${active ? "bg-secondary" : "hover:bg-secondary/70"}`}
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-gold/80" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-foreground truncate">{h.name}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          <span className="uppercase tracking-wider mr-1.5">{h.kind}</span>{h.subtitle}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
              <li className="border-t border-border mt-1">
                <a
                  href="/portals"
                  onClick={(e) => { e.preventDefault(); goPortals(); }}
                  className="block px-3 py-2 text-xs text-center text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                >
                  Browse all portals →
                </a>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
