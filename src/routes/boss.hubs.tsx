import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowUpRight, Sparkles, Music2, Smile, Wrench, TrendingUp, Rocket, Radio, Bot, Brain, Zap, Star, Megaphone, Disc3, Satellite, Radar, Lock, Loader2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ICONS: Record<string, any> = {
  Sparkles, Music2, Smile, Wrench, TrendingUp, Rocket, Radio, Bot, Brain,
  Zap, Star, Megaphone, Disc3, Satellite, Radar,
};
const ICON_KEYS = Object.keys(ICONS);

const BUILTINS = [
  { title: "MusicHUB",   tagline: "Stream. Own. Repeat.",       href: "/music",   icon: "Music2",     accent: "oklch(0.72 0.22 245)" },
  { title: "JokesHUB",   tagline: "Fast wit. Zero filler.",     href: "/jokes",   icon: "Smile",      accent: "oklch(0.78 0.18 85)"  },
  { title: "TradeHUB",   tagline: "Live signals. Bias meters.", href: "/trade",   icon: "TrendingUp", accent: "oklch(0.70 0.20 145)" },
  { title: "ConnectHUB", tagline: "Scout. Enrich. Outreach.",   href: "/connect", icon: "Rocket",     accent: "oklch(0.65 0.22 295)" },
  { title: "BattleHUB",  tagline: "Every choice is a loss.",    href: "/battle",  icon: "Sparkles",   accent: "oklch(0.65 0.24 25)"  },
  { title: "ToolHUB",    tagline: "Sharp utilities, fast.",     href: "/tools",   icon: "Wrench",     accent: "oklch(0.70 0.18 180)" },
];

type Hub = {
  id: string; title: string; tagline: string; href: string;
  icon: string; accent: string; sort_order: number; published: boolean;
};

export const Route = createFileRoute("/boss/hubs")({
  component: HubsManager,
});

function HubsManager() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Hub>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("custom_hubs").select("*").order("sort_order").order("created_at");
    setHubs((data ?? []) as Hub[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(id: string) {
    const { error } = await supabase.from("custom_hubs").update({
      title: draft.title, tagline: draft.tagline, href: draft.href,
      icon: draft.icon, accent: draft.accent,
      sort_order: draft.sort_order, published: draft.published,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null); setDraft({}); load();
  }

  async function togglePublished(h: Hub) {
    const { error } = await supabase.from("custom_hubs").update({ published: !h.published }).eq("id", h.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(h: Hub) {
    if (!confirm(`Delete "${h.title}" hub?`)) return;
    const { error } = await supabase.from("custom_hubs").delete().eq("id", h.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  async function persistOrder(next: Hub[]) {
    setSavingOrder(true);
    const updates = next.map((h, i) =>
      supabase.from("custom_hubs").update({ sort_order: i }).eq("id", h.id)
    );
    const results = await Promise.all(updates);
    setSavingOrder(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) { toast.error(failed.error.message); load(); return; }
    toast.success("Order saved");
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const from = hubs.findIndex((h) => h.id === dragId);
    const to = hubs.findIndex((h) => h.id === targetId);
    if (from < 0 || to < 0) return;
    const next = hubs.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reindexed = next.map((h, i) => ({ ...h, sort_order: i }));
    setHubs(reindexed);
    setDragId(null);
    setOverId(null);
    persistOrder(reindexed);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-[Montserrat] font-black text-2xl text-metallic">Hubs</h1>
          <p className="text-sm text-muted-foreground">{BUILTINS.length} built-in · {hubs.length} custom</p>
        </div>
        <Button asChild><Link to="/boss/hubs/new"><Plus className="h-4 w-4 mr-1" /> New Hub</Link></Button>
      </div>

      {/* Built-in hubs */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Built-in (locked)</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BUILTINS.map((h) => {
            const Icon = ICONS[h.icon] ?? Sparkles;
            return (
              <div key={h.title} className="rounded-xl border bg-card p-4 flex items-center gap-3"
                style={{ borderColor: `${h.accent}55` }}>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${h.accent}1f`, color: h.accent }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{h.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{h.tagline}</p>
                </div>
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom hubs */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Custom</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : hubs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No custom hubs yet. <Link to="/boss/hubs/new" className="underline">Create one</Link>.
          </div>
        ) : (
          <div className="space-y-2">
            {hubs.map((h) => {
              const Icon = ICONS[h.icon] ?? Sparkles;
              const isEdit = editing === h.id;
              return (
                <div
                  key={h.id}
                  draggable={!isEdit}
                  onDragStart={(e) => { setDragId(h.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overId !== h.id) setOverId(h.id); }}
                  onDragLeave={() => { if (overId === h.id) setOverId(null); }}
                  onDrop={(e) => { e.preventDefault(); handleDrop(h.id); }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  className={`rounded-xl border bg-card p-4 transition-all ${dragId === h.id ? "opacity-50" : ""} ${overId === h.id && dragId && dragId !== h.id ? "ring-2 ring-primary" : ""}`}
                  style={{ borderColor: `${h.accent}55` }}
                >
                  {isEdit ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={draft.title ?? ""} maxLength={24} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
                        <Input value={draft.href ?? ""} onChange={(e) => setDraft({ ...draft, href: e.target.value })} placeholder="Link" />
                      </div>
                      <Input value={draft.tagline ?? ""} maxLength={60} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} placeholder="Tagline" />
                      <div className="grid grid-cols-3 gap-2">
                        <select className="border rounded-md bg-background px-2 py-2 text-sm" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })}>
                          {ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <Input value={draft.accent ?? ""} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} placeholder="oklch(...)" />
                        <Input type="number" value={draft.sort_order ?? 0} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setDraft({}); }}>Cancel</Button>
                        <Button size="sm" onClick={() => save(h.id)}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none" title="Drag to reorder">
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ background: `${h.accent}1f`, color: h.accent }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm truncate">{h.title}</p>
                          {!h.published && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hidden</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{h.tagline} · → {h.href}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title={h.published ? "Hide" : "Publish"} onClick={() => togglePublished(h)}>
                          {h.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(h.id); setDraft(h); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <a href={h.href} target={/^https?:/.test(h.href) ? "_blank" : undefined} rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="Open"><ArrowUpRight className="h-4 w-4" /></Button>
                        </a>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(h)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {savingOrder && (
        <div className="fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground shadow">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving order…
        </div>
      )}
    </div>
  );
}