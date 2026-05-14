import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowUpRight, Sparkles, Music2, Smile, Wrench, TrendingUp,
  Rocket, Radio, Bot, Brain, Zap, Star, Megaphone, Disc3, Satellite, Radar,
  Loader2, Eye, EyeOff, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  validateHubForm, HUB_ICON_KEYS, HUB_TITLE_MAX, HUB_TAGLINE_MAX,
  HUB_DESCRIPTION_MAX, HUB_VISIBILITY_OPTIONS, HUB_TEMPLATES,
  suggestSlugFromTitle, type HubFieldErrors,
} from "@/lib/hub-style";
import { templateToSections, HubSectionsZ, type HubSection } from "@/lib/hub-sections";
import { HubSectionsEditor } from "@/components/HubSectionsEditor";
import { OGBotDraftPanel } from "@/components/og-bot/OGBotDraftPanel";

const ICONS: Record<string, any> = {
  Sparkles, Music2, Smile, Wrench, TrendingUp, Rocket, Radio, Bot, Brain,
  Zap, Star, Megaphone, Disc3, Satellite, Radar,
};
const ICON_KEYS = HUB_ICON_KEYS;

const ACCENT_PRESETS = [
  "oklch(0.72 0.22 245)", "oklch(0.78 0.18 85)", "oklch(0.70 0.20 145)",
  "oklch(0.65 0.22 295)", "oklch(0.65 0.24 25)", "oklch(0.70 0.18 180)",
  "oklch(0.75 0.20 320)", "oklch(0.68 0.22 60)",
];

export const Route = createFileRoute("/boss/hubs/new")({
  component: NewHubPage,
});

function NewHubPage() {
  const nav = useNavigate();
  const [template, setTemplate] = useState<string>("generic");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [hrefMode, setHrefMode] = useState<"slug" | "custom">("slug");
  const [href, setHref] = useState("/");
  const [icon, setIcon] = useState("Sparkles");
  const [accent, setAccent] = useState(ACCENT_PRESETS[0]);
  const [sortOrder, setSortOrder] = useState(0);
  const [published, setPublished] = useState(true);
  const [visibility, setVisibility] = useState<"public" | "signed_in" | "boss_only">("public");
  const [sections, setSections] = useState<HubSection[]>(() =>
    templateToSections("generic", { title: "", tagline: "" }));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<HubFieldErrors>({});
  const [touched, setTouched] = useState(false);

  const Icon = ICONS[icon] ?? Sparkles;

  // Auto-suggest slug as user types title (until they edit it manually).
  useEffect(() => {
    if (!slugTouched) setSlug(suggestSlugFromTitle(title));
  }, [title, slugTouched]);

  // Keep href in sync with slug when in "slug" mode.
  const effectiveHref = useMemo(() => {
    if (hrefMode === "slug") return slug ? `/hub/${slug}` : "/hub/";
    return href;
  }, [hrefMode, slug, href]);

  function applyTemplate(t: string) {
    setTemplate(t);
    setSections(templateToSections(t, { title: title || "YourHUB", tagline }));
  }

  function runValidate() {
    const errs = validateHubForm({ title, tagline, href: effectiveHref, icon, accent, slug });
    if (hrefMode === "slug" && !slug.trim()) errs.slug = errs.slug ?? "Slug required for /hub/<slug>";
    setErrors(errs);
    return errs;
  }

  async function save() {
    setTouched(true);
    const errs = runValidate();
    if (Object.keys(errs).length > 0) { toast.error("Fix the highlighted fields"); return; }

    const sectionsParsed = HubSectionsZ.safeParse(sections);
    if (!sectionsParsed.success) {
      toast.error("One or more sections have invalid fields");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("custom_hubs").insert({
      title: title.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      slug: slug.trim() || null,
      href: effectiveHref.trim(),
      icon, accent,
      sort_order: sortOrder, published,
      visibility, template,
      sections: sectionsParsed.data as any,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Hub created");
    nav({ to: "/boss/hubs" });
  }

  function field<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); if (touched) setTimeout(runValidate, 0); };
  }

  const VisIcon = visibility === "public" ? Eye : visibility === "signed_in" ? EyeOff : Lock;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/boss/hubs" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to hubs
        </Link>
        <h1 className="mt-1 font-[Montserrat] font-black text-2xl text-metallic">Create New Hub</h1>
        <p className="text-sm text-muted-foreground">Pick a template, set the look, drop in sections — same format as built-in HUBs.</p>
      </div>

      {/* TEMPLATE PICKER */}
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Start from a template</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {HUB_TEMPLATES.map((t) => (
            <button key={t.value} type="button" onClick={() => applyTemplate(t.value)}
              className={`rounded-lg border p-3 text-left transition ${template === t.value ? "border-foreground bg-foreground/10" : "hover:border-foreground/40"}`}>
              <div className="font-bold text-sm">{t.label}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* FORM */}
        <div className="space-y-4 rounded-2xl border bg-card p-6">
          <OGBotDraftPanel
            surface="hub-create"
            kind="hub"
            contextHint="User is on /boss/hubs/new creating a custom hub card."
            placeholder="Tell me what this hub is for and the vibe."
            fieldHints={[
              { key: "title", description: "Hub title, PascalCase + HUB suffix", max: 40 },
              { key: "tagline", description: "Short punchy tagline", max: 60 },
              { key: "description", description: "One-line summary", max: 200 },
            ]}
            onApply={(f) => {
              if (f.title) { setTitle(f.title); if (!slugTouched) setSlug(suggestSlugFromTitle(f.title)); }
              if (f.tagline) setTagline(f.tagline);
              if (f.description) setDescription(f.description);
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Title</label>
              <Input value={title} maxLength={HUB_TITLE_MAX}
                     onChange={(e) => field(setTitle)(e.target.value)} onBlur={runValidate}
                     placeholder="e.g. SignalHUB"
                     className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""} />
              {errors.title
                ? <p className="mt-1 text-[11px] text-destructive">{errors.title}</p>
                : <p className="mt-1 text-[11px] text-muted-foreground">PascalCase + “HUB” suffix.</p>}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Slug</label>
              <div className="flex items-center">
                <span className="text-[11px] text-muted-foreground pr-1">/hub/</span>
                <Input value={slug} maxLength={48}
                       onChange={(e) => { setSlugTouched(true); field(setSlug)(e.target.value.toLowerCase()); }}
                       onBlur={runValidate} placeholder="signalhub"
                       className={errors.slug ? "border-destructive focus-visible:ring-destructive" : ""} />
              </div>
              {errors.slug
                ? <p className="mt-1 text-[11px] text-destructive">{errors.slug}</p>
                : <p className="mt-1 text-[11px] text-muted-foreground">Auto from title. Editable.</p>}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Tagline</label>
            <Input value={tagline} maxLength={HUB_TAGLINE_MAX}
                   onChange={(e) => field(setTagline)(e.target.value)} onBlur={runValidate}
                   placeholder="Short. Punchy."
                   className={errors.tagline ? "border-destructive focus-visible:ring-destructive" : ""} />
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
              {errors.tagline ? <p className="text-destructive">{errors.tagline}</p> : <span />}
              <span className="text-muted-foreground tabular-nums">{tagline.length}/{HUB_TAGLINE_MAX}</span>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Description</label>
            <textarea className="w-full min-h-[70px] rounded-md border bg-background p-2 text-sm"
                      maxLength={HUB_DESCRIPTION_MAX}
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, HUB_DESCRIPTION_MAX))}
                      placeholder="One-line summary used by the auto-generated header." />
            <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
              {description.length}/{HUB_DESCRIPTION_MAX}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Card link target</label>
            <div className="flex items-center gap-2 text-xs mb-1">
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={hrefMode === "slug"} onChange={() => setHrefMode("slug")} />
                Use <code className="text-muted-foreground">/hub/{slug || "slug"}</code>
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={hrefMode === "custom"} onChange={() => setHrefMode("custom")} />
                Custom link
              </label>
            </div>
            {hrefMode === "custom" ? (
              <Input value={href} onChange={(e) => field(setHref)(e.target.value)} onBlur={runValidate}
                     placeholder="/music or https://..."
                     className={errors.href ? "border-destructive focus-visible:ring-destructive" : ""} />
            ) : (
              <Input value={effectiveHref} disabled />
            )}
            {errors.href && <p className="mt-1 text-[11px] text-destructive">{errors.href}</p>}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Icon</label>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {ICON_KEYS.map((k) => {
                const I = ICONS[k]; const active = k === icon;
                return (
                  <button key={k} type="button" onClick={() => field(setIcon)(k)}
                    className={`aspect-square rounded-lg border flex items-center justify-center transition ${active ? "border-foreground bg-foreground/10" : "border-border hover:border-foreground/40"}`}
                    title={k}><I className="h-4 w-4" /></button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Accent (OKLCH)</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button key={c} type="button" onClick={() => field(setAccent)(c)}
                  className={`h-8 w-8 rounded-full border-2 ${accent === c ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c }} title={c} />
              ))}
            </div>
            <Input className={`mt-2 ${errors.accent ? "border-destructive focus-visible:ring-destructive" : ""}`}
                   value={accent} onChange={(e) => field(setAccent)(e.target.value)} onBlur={runValidate}
                   placeholder="oklch(0.7 0.2 245)" />
            {errors.accent && <p className="mt-1 text-[11px] text-destructive">{errors.accent}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Sort</label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <VisIcon className="h-3 w-3" /> Visibility
              </label>
              <select className="w-full mt-1 border rounded-md bg-background px-2 py-2 text-sm"
                      value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
                {HUB_VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published (uncheck to keep fully hidden regardless of visibility)
          </label>

          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Hub
          </Button>
        </div>

        {/* PREVIEW + SECTIONS */}
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Card preview (home page)</p>
            <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 transition-all duration-500"
                 style={{ borderColor: `${accent}55` }}>
              <div className="absolute -inset-px rounded-2xl pointer-events-none"
                   style={{ background: `radial-gradient(500px circle at 50% 0%, ${accent}44, transparent 60%)` }} />
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center"
                     style={{ background: `${accent}1f`, color: accent }}>
                  <Icon className="h-6 w-6" />
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="mt-10 font-[Montserrat] font-black text-3xl tracking-tight text-metallic">{title || "YourHUB"}</h2>
              <p className="mt-3 text-base font-semibold text-foreground/95 leading-relaxed">{tagline || "Tagline goes here."}</p>
              <div className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-lg text-xs uppercase tracking-[0.25em] font-bold text-white"
                   style={{ background: `${accent}26`, border: `1px solid ${accent}66` }}>
                Open Hub <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Sections</p>
              <span className="text-[11px] text-muted-foreground">{sections.length} block{sections.length === 1 ? "" : "s"}</span>
            </div>
            <HubSectionsEditor value={sections} onChange={setSections} />
          </div>
        </div>
      </div>
    </div>
  );
}