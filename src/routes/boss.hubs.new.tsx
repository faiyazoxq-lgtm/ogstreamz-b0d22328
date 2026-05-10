import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, Sparkles, Music2, Smile, Wrench, TrendingUp, Rocket, Radio, Bot, Brain, Zap, Star, Megaphone, Disc3, Satellite, Radar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ICONS: Record<string, any> = {
  Sparkles, Music2, Smile, Wrench, TrendingUp, Rocket, Radio, Bot, Brain,
  Zap, Star, Megaphone, Disc3, Satellite, Radar,
};
const ICON_KEYS = Object.keys(ICONS);

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

  const Icon = ICONS[icon] ?? Sparkles;

  async function save() {
    if (!title.trim()) return toast.error("Title required");
    if (title.length > 24) return toast.error("Title must be ≤ 24 chars to match HUB style");
    if (tagline.length > 60) return toast.error("Tagline must be ≤ 60 chars");
    if (!href.trim()) return toast.error("Link target required");
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
            <Input value={title} maxLength={24} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SignalHUB" />
            <p className="mt-1 text-[11px] text-muted-foreground">Convention: PascalCase + “HUB” suffix · max 24 chars.</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Tagline</label>
            <Input value={tagline} maxLength={60} onChange={(e) => setTagline(e.target.value)} placeholder="Short. Punchy. ≤ 60 chars." />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Link target</label>
            <Input value={href} onChange={(e) => setHref(e.target.value)} placeholder="/my-hub or https://..." />
            <p className="mt-1 text-[11px] text-muted-foreground">Internal route (e.g. <code>/signals</code>) or full URL.</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Icon</label>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {ICON_KEYS.map((k) => {
                const I = ICONS[k];
                const active = k === icon;
                return (
                  <button key={k} type="button" onClick={() => setIcon(k)}
                    className={`aspect-square rounded-lg border flex items-center justify-center transition ${active ? "border-foreground bg-foreground/10" : "border-border hover:border-foreground/40"}`}
                    title={k}>
                    <I className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Accent (OKLCH)</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button key={c} type="button" onClick={() => setAccent(c)}
                  className={`h-8 w-8 rounded-full border-2 ${accent === c ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c }} title={c} />
              ))}
            </div>
            <Input className="mt-2" value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="oklch(...)" />
            <p className="mt-1 text-[11px] text-muted-foreground">Must be an OKLCH color string to stay on-brand.</p>
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