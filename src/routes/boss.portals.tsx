import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Pencil, Trash2, ArrowUpRight, Loader2, Eye, ArrowUpDown, ImageIcon, Power, PowerOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CostTierControl } from "@/components/CostTierControl";
import { summarizeCosts, TIER_RANK } from "@/lib/cost-registry";

type Portal = {
  id: string; slug: string; name: string; kind: string;
  niche: string; vibe: string | null; language: string;
  theme: string; vip: boolean; view_count: number;
  created_at: string; created_by: string | null;
  paid_services: Record<string, boolean>;
  published: boolean;
};

const KIND_PATH: Record<string, (s: string) => string> = {
  music: (s) => `/m/${s}`,
  trade: (s) => `/td/${s}`,
};
function viewPath(p: Portal) {
  return (KIND_PATH[p.kind] ?? ((s: string) => `/p/${s}`))(p.slug);
}

// Friendly hub labels for built-in kinds. Unknown kinds fall back to title-case + "HUB".
const HUB_LABELS: Record<string, string> = {
  music: "MusicHUB",
  joke: "JokesHUB",
  jokes: "JokesHUB",
  trade: "TradeHUB",
  connect: "ConnectHUB",
  battle: "BattleHUB",
  tools: "ToolHUB",
  tool: "ToolHUB",
};
function hubLabel(kind: string) {
  return HUB_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1) + "HUB";
}

export const Route = createFileRoute("/boss/portals")({
  component: PortalsManager,
});

function PortalsManager() {
  const [rows, setRows] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [hub, setHub] = useState<string>("all");
  const [costSort, setCostSort] = useState<"none" | "asc" | "desc">("none");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Portal>>({});
  const [genId, setGenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("portals")
      .select("id,slug,name,kind,niche,vibe,language,theme,vip,view_count,created_at,created_by,paid_services,published")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as any[]).map((r) => ({ ...r, paid_services: r.paid_services ?? {} })) as Portal[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const hubBuckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([kind, count]) => ({ kind, label: hubLabel(kind), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (hub !== "all" && r.kind !== hub) return false;
      if (!needle) return true;
      return r.name.toLowerCase().includes(needle) || r.slug.toLowerCase().includes(needle) || (r.niche ?? "").toLowerCase().includes(needle);
    });
    if (costSort !== "none") {
      out.sort((a, b) => {
        const ra = TIER_RANK[summarizeCosts(a.paid_services).tier];
        const rb = TIER_RANK[summarizeCosts(b.paid_services).tier];
        return costSort === "asc" ? ra - rb : rb - ra;
      });
    }
    return out;
  }, [rows, q, hub, costSort]);

  async function setPortalServices(p: Portal, next: Record<string, boolean>) {
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, paid_services: next } : r)));
    const { error } = await supabase.from("portals").update({ paid_services: next }).eq("id", p.id);
    if (error) { toast.error(error.message); load(); }
  }

  async function save(id: string) {
    const { error } = await supabase.from("portals").update({
      name: draft.name, niche: draft.niche, vibe: draft.vibe,
      language: draft.language, theme: draft.theme, vip: draft.vip,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setEditing(null); setDraft({}); load();
  }

  async function remove(p: Portal) {
    if (!confirm(`Delete portal "${p.name}"?`)) return;
    const { error } = await supabase.from("portals").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  async function toggleVip(p: Portal) {
    const { error } = await supabase.from("portals").update({ vip: !p.vip }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function togglePublished(p: Portal) {
    const next = !p.published;
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, published: next } : r)));
    const { error } = await supabase.rpc("boss_set_portal_published", {
      _portal_id: p.id,
      _published: next,
    });
    if (error) {
      toast.error(error.message);
      load();
      return;
    }
    toast.success(next ? "Portal published" : "Portal hidden from members");
  }

  async function generateCover(p: Portal) {
    setGenId(p.id);
    const t = toast.loading(`Generating cover for ${p.name}…`);
    try {
      const { data, error } = await supabase.functions.invoke("portal-image", {
        body: { portal_id: p.id },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Cover generated & saved", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image generation failed", { id: t });
    } finally {
      setGenId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-[Montserrat] font-black text-2xl text-metallic">Portals</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} shown</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, slug, niche…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="border rounded-md bg-background px-3 py-2 text-sm"
          value={hub}
          onChange={(e) => setHub(e.target.value)}
          aria-label="Filter by hub"
        >
          <option value="all">All hubs ({rows.length})</option>
          {hubBuckets.map((b) => (
            <option key={b.kind} value={b.kind}>{b.label} ({b.count})</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCostSort((s) => (s === "none" ? "asc" : s === "asc" ? "desc" : "none"))}
          className={`inline-flex items-center gap-1.5 border rounded-md px-3 py-2 text-sm transition-colors ${costSort !== "none" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
          title="Sort by cost tier (Free → Live $)"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Cost {costSort === "asc" ? "↑" : costSort === "desc" ? "↓" : ""}
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setHub("all")}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${hub === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground"}`}
        >
          All <span className="opacity-70">· {rows.length}</span>
        </button>
        {hubBuckets.map((b) => (
          <button
            key={b.kind}
            type="button"
            onClick={() => setHub(b.kind)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${hub === b.kind ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {b.label} <span className="opacity-70">· {b.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const isEdit = editing === p.id;
            return (
              <div key={p.id} className="rounded-xl border bg-card p-4">
                {isEdit ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" />
                      <Input value={draft.language ?? ""} onChange={(e) => setDraft({ ...draft, language: e.target.value })} placeholder="Language" />
                    </div>
                    <Input value={draft.niche ?? ""} onChange={(e) => setDraft({ ...draft, niche: e.target.value })} placeholder="Niche" />
                    <Input value={draft.vibe ?? ""} onChange={(e) => setDraft({ ...draft, vibe: e.target.value })} placeholder="Vibe" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={draft.theme ?? ""} onChange={(e) => setDraft({ ...draft, theme: e.target.value })} placeholder="Theme" />
                      <label className="flex items-center gap-2 text-sm px-2">
                        <input type="checkbox" checked={!!draft.vip} onChange={(e) => setDraft({ ...draft, vip: e.target.checked })} />
                        VIP only
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setDraft({}); }}>Cancel</Button>
                      <Button size="sm" onClick={() => save(p.id)}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate">{p.name}</p>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.kind}</span>
                        {p.vip && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">VIP</span>}
                        {!p.published && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">Hidden</span>}
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Eye className="h-3 w-3" />{p.view_count}</span>
                        <CostTierControl
                          flags={p.paid_services}
                          onChange={(next) => setPortalServices(p, next)}
                          compact
                        />
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">/{p.slug} · {p.theme} · {p.language}</p>
                      <p className="text-xs text-muted-foreground/80 truncate">{p.niche}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePublished(p)}
                        title={p.published ? "Hide from members" : "Publish for members"}
                      >
                        {p.published ? <Power className="h-4 w-4 text-emerald-400" /> : <PowerOff className="h-4 w-4 text-rose-400" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleVip(p)} title="Toggle VIP">
                        {p.vip ? "Make free" : "Make VIP"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => generateCover(p)}
                        disabled={genId === p.id}
                        title="Generate AI cover image"
                      >
                        {genId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(p.id); setDraft(p); }} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <a href={viewPath(p)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" title="Open"><ArrowUpRight className="h-4 w-4" /></Button>
                      </a>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No portals match.</div>
          )}
        </div>
      )}
    </div>
  );
}