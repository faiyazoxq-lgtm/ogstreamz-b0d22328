import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, Sparkles, Music2, Smile, Wrench, TrendingUp, Rocket, Radio, Bot, Brain, Zap, Star, Megaphone, Disc3, Satellite, Radar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateHubForm, HUB_ICON_KEYS, HUB_TITLE_MAX, HUB_TAGLINE_MAX, type HubFieldErrors } from "@/lib/hub-style";
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
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [href, setHref] = useState("/");
  const [icon, setIcon] = useState("Sparkles");
  const [accent, setAccent] = useState(ACCENT_PRESETS[0]);
  const [sortOrder, setSortOrder] = useState(0);
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<HubFieldErrors>({});
  const [touched, setTouched] = useState(false);

  const Icon = ICONS[icon] ?? Sparkles;

  function runValidate() {
    const errs = validateHubForm({ title, tagline, href, icon, accent });
    setErrors(errs);
    return errs;
  }

  async function save() {
    setTouched(true);
    const errs = runValidate();
    if (Object.keys(errs).length > 0) {
      toast.error("Fix the highlighted fields");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("custom_hubs").insert({
      title: title.trim(), tagline: tagline.trim(), href: href.trim(),
      icon, accent, sort_order: sortOrder, published,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Hub created");
    nav({ to: "/boss/hubs" });
  }

  // Live-revalidate after the user has tried to submit once.
  function field<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); if (touched) setTimeout(runValidate, 0); };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/boss/hubs" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to hubs
          </Link>
          <h1 className="mt-1 font-[Montserrat] font-black text-2xl text-metallic">Create New Hub</h1>
          <p className="text-sm text-muted-foreground">Custom hubs render alongside the built-ins on the home page.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* FORM */}
        <div className="space-y-4 rounded-2xl border bg-card p-6">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Title</label>
            <Input
              value={title}
              maxLength={HUB_TITLE_MAX}
              onChange={(e) => field(setTitle)(e.target.value)}
              onBlur={runValidate}
              placeholder="e.g. SignalHUB"
              aria-invalid={!!errors.title}
              className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
              {errors.title
                ? <p className="text-destructive">{errors.title}</p>
                : <p className="text-muted-foreground">PascalCase + “HUB” suffix.</p>}
              <span className="text-muted-foreground tabular-nums">{title.length}/{HUB_TITLE_MAX}</span>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Tagline</label>
            <Input
              value={tagline}
              maxLength={HUB_TAGLINE_MAX}
              onChange={(e) => field(setTagline)(e.target.value)}
              onBlur={runValidate}
              placeholder="Short. Punchy."
              aria-invalid={!!errors.tagline}
              className={errors.tagline ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
              {errors.tagline
                ? <p className="text-destructive">{errors.tagline}</p>
                : <p className="text-muted-foreground">Imperative, punchy.</p>}
              <span className="text-muted-foreground tabular-nums">{tagline.length}/{HUB_TAGLINE_MAX}</span>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Link target</label>
            <Input
              value={href}
              onChange={(e) => field(setHref)(e.target.value)}
              onBlur={runValidate}
              placeholder="/my-hub or https://..."
              aria-invalid={!!errors.href}
              className={errors.href ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.href
              ? <p className="mt-1 text-[11px] text-destructive">{errors.href}</p>
              : <p className="mt-1 text-[11px] text-muted-foreground">Internal route (e.g. <code>/signals</code>) or full URL.</p>}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Icon</label>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {ICON_KEYS.map((k) => {
                const I = ICONS[k];
                const active = k === icon;
                return (
                  <button key={k} type="button" onClick={() => field(setIcon)(k)}
                    className={`aspect-square rounded-lg border flex items-center justify-center transition ${active ? "border-foreground bg-foreground/10" : "border-border hover:border-foreground/40"}`}
                    title={k}>
                    <I className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            {errors.icon && <p className="mt-1 text-[11px] text-destructive">{errors.icon}</p>}
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
            <Input
              className={`mt-2 ${errors.accent ? "border-destructive focus-visible:ring-destructive" : ""}`}
              value={accent}
              onChange={(e) => field(setAccent)(e.target.value)}
              onBlur={runValidate}
              placeholder="oklch(0.7 0.2 245)"
              aria-invalid={!!errors.accent}
            />
            {errors.accent
              ? <p className="mt-1 text-[11px] text-destructive">{errors.accent}</p>
              : <p className="mt-1 text-[11px] text-muted-foreground">Must be an OKLCH color string to stay on-brand.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Sort order</label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
            </div>
            <label className="flex items-end gap-2 text-sm">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Published
            </label>
          </div>

          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Hub
          </Button>
        </div>

        {/* LIVE PREVIEW (matches index.tsx custom-hub card exactly) */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Preview</p>
          <div
            className="group relative overflow-hidden rounded-2xl border bg-card p-8 sm:p-10 transition-all duration-500"
            style={{ borderColor: `${accent}55`, ["--hub-accent" as any]: accent }}
          >
            <div className="absolute -inset-px rounded-2xl opacity-100 pointer-events-none"
              style={{ background: `radial-gradient(500px circle at 50% 0%, ${accent}44, transparent 60%)` }} />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ background: `${accent}1f`, color: accent }}>
                <Icon className="h-6 w-6" />
              </div>
              <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="mt-10 font-[Montserrat] font-black text-3xl sm:text-4xl tracking-tight text-metallic">
              {title || "YourHUB"}
            </h2>
            <p className="mt-3 text-base font-semibold text-foreground/95 leading-relaxed">
              {tagline || "Tagline goes here."}
            </p>
            <div className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-lg text-xs uppercase tracking-[0.25em] font-bold text-white"
              style={{ background: `${accent}26`, border: `1px solid ${accent}66` }}>
              Open Hub <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-dashed p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Style rules</p>
            <p>· Title: PascalCase ending in “HUB”, ≤ 24 chars.</p>
            <p>· Tagline: imperative, punchy, ≤ 60 chars.</p>
            <p>· Accent: OKLCH only — no hex / rgb.</p>
            <p>· Icon: pick from the curated set above.</p>
            <p>· Layout, padding, typography are locked to match other hubs.</p>
          </div>
        </div>
      </div>
    </div>
  );
}