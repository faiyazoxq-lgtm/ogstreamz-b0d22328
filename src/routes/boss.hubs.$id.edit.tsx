import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HUB_VISIBILITY_OPTIONS, HUB_DESCRIPTION_MAX, validateHubForm, suggestSlugFromTitle,
  type HubFieldErrors,
} from "@/lib/hub-style";
import { HubSectionsZ, type HubSection } from "@/lib/hub-sections";
import { HubSectionsEditor } from "@/components/HubSectionsEditor";
import { OGBotDraftPanel } from "@/components/og-bot/OGBotDraftPanel";

export const Route = createFileRoute("/boss/hubs/$id/edit")({
  component: HubEditPage,
});

function HubEditPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [hub, setHub] = useState<any | null>(null);
  const [sections, setSections] = useState<HubSection[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<HubFieldErrors>({});

  useEffect(() => {
    void supabase.from("custom_hubs").select("*").eq("id", id).maybeSingle()
      .then(({ data }) => {
        if (!data) { toast.error("Hub not found"); nav({ to: "/boss/hubs" }); return; }
        setHub(data);
        const parsed = HubSectionsZ.safeParse(data.sections ?? []);
        setSections(parsed.success ? parsed.data : []);
      });
  }, [id, nav]);

  if (!hub) {
    return <div className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…</div>;
  }

  function patch(p: any) { setHub({ ...hub, ...p }); }

  async function save() {
    const errs = validateHubForm({
      title: hub.title, tagline: hub.tagline, href: hub.href,
      icon: hub.icon, accent: hub.accent, slug: hub.slug ?? "",
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Fix the highlighted fields"); return; }

    const sParsed = HubSectionsZ.safeParse(sections);
    if (!sParsed.success) { toast.error("Invalid section data"); return; }

    setBusy(true);
    const { error } = await supabase.from("custom_hubs").update({
      title: hub.title, tagline: hub.tagline, description: hub.description ?? "",
      slug: (hub.slug ?? "").trim() || null, href: hub.href,
      icon: hub.icon, accent: hub.accent,
      sort_order: hub.sort_order, published: hub.published,
      visibility: hub.visibility, sections: sParsed.data as any,
    }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Hub saved");
  }

  const previewHref = hub.slug ? `/hub/${hub.slug}` : hub.href;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/boss/hubs" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to hubs
          </Link>
          <h1 className="mt-1 font-[Montserrat] font-black text-2xl text-metallic">Edit: {hub.title}</h1>
        </div>
        <a href={previewHref} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded-md px-3 py-1.5">
          <ExternalLink className="h-3 w-3" /> Open
        </a>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <OGBotDraftPanel
            surface="hub-edit"
            kind="hub"
            contextHint={`User is editing custom hub "${hub.title}".`}
            placeholder="Tell me what to change — title, tagline, description."
            fieldHints={[
              { key: "title", description: "Hub title", max: 40 },
              { key: "tagline", description: "Short tagline", max: 60 },
              { key: "description", description: "One-line summary", max: 200 },
            ]}
            onApply={(f) => {
              const p: any = {};
              if (f.title) p.title = f.title;
              if (f.tagline) p.tagline = f.tagline;
              if (f.description) p.description = f.description;
              if (Object.keys(p).length) patch(p);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Title</label>
              <Input value={hub.title} onChange={(e) => patch({ title: e.target.value })}
                     className={errors.title ? "border-destructive" : ""} />
              {errors.title && <p className="mt-1 text-[11px] text-destructive">{errors.title}</p>}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Slug</label>
              <Input value={hub.slug ?? ""} placeholder={suggestSlugFromTitle(hub.title)}
                     onChange={(e) => patch({ slug: e.target.value.toLowerCase() })}
                     className={errors.slug ? "border-destructive" : ""} />
              {errors.slug && <p className="mt-1 text-[11px] text-destructive">{errors.slug}</p>}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Tagline</label>
            <Input value={hub.tagline ?? ""} onChange={(e) => patch({ tagline: e.target.value })} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Description</label>
            <textarea className="w-full min-h-[60px] rounded-md border bg-background p-2 text-sm"
                      maxLength={HUB_DESCRIPTION_MAX} value={hub.description ?? ""}
                      onChange={(e) => patch({ description: e.target.value.slice(0, HUB_DESCRIPTION_MAX) })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Card link</label>
              <Input value={hub.href} onChange={(e) => patch({ href: e.target.value })}
                     className={errors.href ? "border-destructive" : ""} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Accent</label>
              <Input value={hub.accent} onChange={(e) => patch({ accent: e.target.value })}
                     className={errors.accent ? "border-destructive" : ""} />
              {errors.accent && <p className="mt-1 text-[11px] text-destructive">{errors.accent}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Visibility</label>
              <select className="w-full mt-1 border rounded-md bg-background px-2 py-2 text-sm"
                      value={hub.visibility ?? "public"}
                      onChange={(e) => patch({ visibility: e.target.value })}>
                {HUB_VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Status</label>
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hub.published}
                       onChange={(e) => patch({ published: e.target.checked })} />
                Published
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Sections</p>
          <HubSectionsEditor value={sections} onChange={setSections} />
        </div>
      </div>
    </div>
  );
}