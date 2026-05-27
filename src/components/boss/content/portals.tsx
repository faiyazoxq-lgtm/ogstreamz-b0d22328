import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Pencil, Trash2, ArrowUpRight, Loader2, Eye, ArrowUpDown, ImageIcon, Power, PowerOff, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { bossSetPortalPublished } from "@/lib/boss-admin-misc.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CostTierControl } from "@/components/CostTierControl";
import { summarizeCosts, TIER_RANK } from "@/lib/cost-registry";
import { PortalDraftPreview } from "@/components/PortalDraftPreview";
import { OGBotDraftPanel } from "@/components/og-bot/OGBotDraftPanel";

type Portal = {
  id: string; slug: string; name: string; kind: string;
  niche: string; vibe: string | null; language: string;
  theme: string; vip: boolean; view_count: number;
  created_at: string; created_by: string | null;
  paid_services: Record<string, boolean>;
  published: boolean;
  // Optional / advanced fields editable by boss
  style: string | null;
  use_credit_cost: number;
  swear_chat_enabled: boolean;
  seo_title: string | null;
  seo_description: string | null;
  seo_image_url: string | null;
  wallpaper_url: string | null;
  wallpaper_prompt: string | null;
  bg_video_url: string | null;
  bg_video_aspect: string;
  bg_video_prompt: string | null;
  audio_url: string | null;
  audio_snippet_url: string | null;
  lyric_text: string | null;
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

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function PortalsPanel() {
  const setPortalPublishedFn = useServerFn(bossSetPortalPublished);
  const [rows, setRows] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [hub, setHub] = useState<string>("all");
  const [costSort, setCostSort] = useState<"none" | "asc" | "desc">("none");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Portal>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genId, setGenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("portals")
      .select(
        "id,slug,name,kind,niche,vibe,language,theme,vip,view_count,created_at,created_by,paid_services,published," +
        "style,use_credit_cost,swear_chat_enabled,seo_title,seo_description,seo_image_url," +
        "wallpaper_url,wallpaper_prompt,bg_video_url,bg_video_aspect,bg_video_prompt,audio_url,audio_snippet_url,lyric_text"
      )
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
    const nextSlug = (draft.slug ?? "").trim().toLowerCase();
    if (!nextSlug || !SLUG_RE.test(nextSlug)) {
      return toast.error("Slug must be lowercase letters, numbers and hyphens (2–64 chars).");
    }
    if (!(draft.name ?? "").trim()) return toast.error("Name is required.");
    if (!(draft.niche ?? "").trim()) return toast.error("Niche is required.");
    const credit = Math.max(0, Math.floor(Number(draft.use_credit_cost ?? 0) || 0));

    setSaving(true);
    const patch = {
      slug: nextSlug,
      name: (draft.name ?? "").trim(),
      niche: (draft.niche ?? "").trim(),
      vibe: (draft.vibe ?? "")?.toString().trim() || null,
      language: (draft.language ?? "English").trim(),
      theme: (draft.theme ?? "street").trim(),
      vip: !!draft.vip,
      style: (draft.style ?? "")?.toString().trim() || null,
      use_credit_cost: credit,
      swear_chat_enabled: !!draft.swear_chat_enabled,
      seo_title: (draft.seo_title ?? "")?.toString().trim() || null,
      seo_description: (draft.seo_description ?? "")?.toString().trim() || null,
      seo_image_url: (draft.seo_image_url ?? "")?.toString().trim() || null,
      wallpaper_url: (draft.wallpaper_url ?? "")?.toString().trim() || null,
      wallpaper_prompt: (draft.wallpaper_prompt ?? "")?.toString().trim() || null,
      bg_video_url: (draft.bg_video_url ?? "")?.toString().trim() || null,
      bg_video_aspect: (draft.bg_video_aspect ?? "16:9").trim() || "16:9",
      bg_video_prompt: (draft.bg_video_prompt ?? "")?.toString().trim() || null,
      audio_url: (draft.audio_url ?? "")?.toString().trim() || null,
      audio_snippet_url: (draft.audio_snippet_url ?? "")?.toString().trim() || null,
      lyric_text: (draft.lyric_text ?? "")?.toString() || null,
    };
    const { error } = await supabase.from("portals").update(patch).eq("id", id);
    setSaving(false);
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return toast.error(`Slug "${nextSlug}" is already taken.`);
      }
      return toast.error(error.message);
    }
    toast.success("Saved");
    setEditing(null);
    setDraft({});
    setShowAdvanced(false);
    load();
  }

  function startEdit(p: Portal) {
    setEditing(p.id);
    setDraft({ ...p });
    setShowAdvanced(false);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft({});
    setShowAdvanced(false);
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
    try {
      await setPortalPublishedFn({ data: { portal_id: p.id, published: next } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
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
                  <div className="space-y-3">
                    {/* Basic identity */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</span>
                        <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Portal name" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Slug (URL)</span>
                        <Input
                          value={draft.slug ?? ""}
                          onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })}
                          placeholder="lower-case-slug"
                        />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Niche / description</span>
                      <Textarea
                        value={draft.niche ?? ""}
                        onChange={(e) => setDraft({ ...draft, niche: e.target.value })}
                        placeholder="What this portal is about"
                        rows={2}
                      />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Vibe</span>
                        <Input value={draft.vibe ?? ""} onChange={(e) => setDraft({ ...draft, vibe: e.target.value })} placeholder="e.g. dark, comedic" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Language</span>
                        <Input value={draft.language ?? ""} onChange={(e) => setDraft({ ...draft, language: e.target.value })} placeholder="English" />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                      <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Theme</span>
                        <Input value={draft.theme ?? ""} onChange={(e) => setDraft({ ...draft, theme: e.target.value })} placeholder="street" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Use cost (credits)</span>
                        <Input
                          type="number"
                          min={0}
                          value={String(draft.use_credit_cost ?? 0)}
                          onChange={(e) => setDraft({ ...draft, use_credit_cost: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </label>
                      <div className="flex flex-col gap-1 text-sm">
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded border bg-background">
                          <input type="checkbox" checked={!!draft.vip} onChange={(e) => setDraft({ ...draft, vip: e.target.checked })} />
                          VIP only
                        </label>
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded border bg-background">
                          <input type="checkbox" checked={!!draft.swear_chat_enabled} onChange={(e) => setDraft({ ...draft, swear_chat_enabled: e.target.checked })} />
                          Swear chat
                        </label>
                      </div>
                    </div>

                    {/* Advanced section */}
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      Advanced (media, SEO, style)
                    </button>

                    {showAdvanced && (
                      <div className="space-y-2 rounded-lg border border-dashed border-border/60 bg-background/40 p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Style hint</span>
                            <Input value={draft.style ?? ""} onChange={(e) => setDraft({ ...draft, style: e.target.value })} placeholder="e.g. neon-noir" />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">BG video aspect</span>
                            <Input value={draft.bg_video_aspect ?? "16:9"} onChange={(e) => setDraft({ ...draft, bg_video_aspect: e.target.value })} placeholder="16:9" />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallpaper URL</span>
                            <Input value={draft.wallpaper_url ?? ""} onChange={(e) => setDraft({ ...draft, wallpaper_url: e.target.value })} placeholder="https://…" />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallpaper prompt</span>
                            <Input value={draft.wallpaper_prompt ?? ""} onChange={(e) => setDraft({ ...draft, wallpaper_prompt: e.target.value })} placeholder="Image generation prompt" />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">BG video URL</span>
                            <Input value={draft.bg_video_url ?? ""} onChange={(e) => setDraft({ ...draft, bg_video_url: e.target.value })} placeholder="https://…" />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">BG video prompt</span>
                            <Input value={draft.bg_video_prompt ?? ""} onChange={(e) => setDraft({ ...draft, bg_video_prompt: e.target.value })} placeholder="Video generation prompt" />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Audio URL</span>
                            <Input value={draft.audio_url ?? ""} onChange={(e) => setDraft({ ...draft, audio_url: e.target.value })} placeholder="https://…" />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Audio snippet URL</span>
                            <Input value={draft.audio_snippet_url ?? ""} onChange={(e) => setDraft({ ...draft, audio_snippet_url: e.target.value })} placeholder="https://…" />
                          </label>
                        </div>
                        <label className="block space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Lyric / hero text</span>
                          <Textarea
                            value={draft.lyric_text ?? ""}
                            onChange={(e) => setDraft({ ...draft, lyric_text: e.target.value })}
                            rows={3}
                            placeholder="Optional lyric or hero copy"
                          />
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">SEO title</span>
                            <Input value={draft.seo_title ?? ""} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} placeholder="≤60 chars" maxLength={70} />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">SEO image URL</span>
                            <Input value={draft.seo_image_url ?? ""} onChange={(e) => setDraft({ ...draft, seo_image_url: e.target.value })} placeholder="https://…" />
                          </label>
                        </div>
                        <label className="block space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">SEO description</span>
                          <Textarea
                            value={draft.seo_description ?? ""}
                            onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })}
                            rows={2}
                            placeholder="≤160 chars"
                            maxLength={200}
                          />
                        </label>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                      <Button size="sm" onClick={() => save(p.id)} disabled={saving}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                      </Button>
                    </div>

                    <PortalDraftPreview draft={{ ...draft, kind: draft.kind ?? p.kind }} />

                    {(draft.kind ?? p.kind) === "music" && (
                      <OGBotDraftPanel
                        surface={`boss-music-portal:${p.id}`}
                        kind="music"
                        contextHint="Boss editing a MusicHUB portal. Output stays on-brand with the existing 0G-Studio style examples (Nasheed → spiritual-blue, Drill → street-neon, Lo-Fi → lofi-haze, Synth → cyber, Folk → warm-folk, default → studio-blue)."
                        placeholder="Describe the vibe — genre, audience, mood. I'll fill the form."
                        intro="Tell me the vibe — I'll draft the name, niche, style, theme, and wallpaper prompt."
                        fieldHints={[
                          { key: "name", description: "Portal display name (Title Case)", max: 60 },
                          { key: "niche", description: "1-line description of what this music portal is about", max: 180 },
                          { key: "style", description: "Music style hint (e.g. \"northern grime\", \"sufi nasheed\", \"trap drill\")", max: 80 },
                          { key: "vibe", description: "Mood / vibe tag (e.g. \"gritty, nocturnal\", \"reverent, devotional\")", max: 120 },
                          { key: "theme", description: "Theme key: one of spiritual-blue, street-neon, lofi-haze, cyber, warm-folk, studio-blue", max: 40 },
                          { key: "language", description: "Primary language (default English)", max: 40 },
                          { key: "wallpaper_prompt", description: "Image prompt for the cinematic background wallpaper", max: 400 },
                          { key: "seo_title", description: "SEO title, <60 chars", max: 60 },
                          { key: "seo_description", description: "SEO meta description, <160 chars", max: 160 },
                        ]}
                        onApply={(f) => {
                          setDraft((d) => ({
                            ...d,
                            name: f.name || d.name,
                            niche: f.niche || d.niche,
                            style: f.style || d.style,
                            vibe: f.vibe || d.vibe,
                            theme: f.theme || d.theme,
                            language: f.language || d.language,
                            wallpaper_prompt: f.wallpaper_prompt || d.wallpaper_prompt,
                            seo_title: f.seo_title || d.seo_title,
                            seo_description: f.seo_description || d.seo_description,
                          }));
                          toast.success("OG-Bot draft applied — review and Save");
                        }}
                      />
                    )}
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
                      <Button variant="ghost" size="icon" onClick={() => startEdit(p)} title="Edit">
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