import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HUB_SECTION_TYPES,
  newSection,
  type HubSection,
  type HubSectionType,
} from "@/lib/hub-sections";

/**
 * Inline section editor used by the new-hub form and the edit-hub form.
 * Keeps everything in one component so layout/format stays consistent.
 */
export function HubSectionsEditor({
  value,
  onChange,
}: {
  value: HubSection[];
  onChange: (next: HubSection[]) => void;
}) {
  function update(i: number, patch: any) {
    const next = value.slice();
    next[i] = { ...next[i], ...patch } as HubSection;
    onChange(next);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function add(type: HubSectionType) {
    onChange([...value, newSection(type)]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {value.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No sections yet — add one below.
          </div>
        )}
        {value.map((s, i) => (
          <div key={i} className="rounded-lg border bg-card/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {i + 1}. {labelFor(s.type)}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <SectionFields section={s} onPatch={(p) => update(i, p)} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground self-center mr-1">Add:</span>
        {HUB_SECTION_TYPES.map((t) => (
          <Button key={t.value} type="button" variant="outline" size="sm" onClick={() => add(t.value)}>
            <Plus className="h-3 w-3 mr-1" />
            {t.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function labelFor(t: HubSectionType): string {
  return HUB_SECTION_TYPES.find((x) => x.value === t)?.label ?? t;
}

function SectionFields({
  section, onPatch,
}: { section: HubSection; onPatch: (patch: any) => void }) {
  switch (section.type) {
    case "hero":
      return (
        <div className="space-y-2">
          <Input placeholder="Tagline (overrides hub tagline)" value={section.tagline ?? ""}
                 onChange={(e) => onPatch({ tagline: e.target.value || undefined })} />
          <Input placeholder="Image generation seed (optional)" value={section.seed ?? ""}
                 onChange={(e) => onPatch({ seed: e.target.value || undefined })} />
          <p className="text-[11px] text-muted-foreground">Renders the same cinematic AI header used by every portal.</p>
        </div>
      );
    case "text":
      return (
        <div className="space-y-2">
          <Input placeholder="Heading (optional)" value={section.heading ?? ""}
                 onChange={(e) => onPatch({ heading: e.target.value || undefined })} />
          <textarea className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm"
                    placeholder="Body copy" value={section.body}
                    onChange={(e) => onPatch({ body: e.target.value.slice(0, 2000) })} />
        </div>
      );
    case "link_grid":
      return (
        <div className="space-y-2">
          <Input placeholder="Heading (optional)" value={section.heading ?? ""}
                 onChange={(e) => onPatch({ heading: e.target.value || undefined })} />
          <div className="space-y-2">
            {section.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr,1.5fr,auto] gap-2 items-center">
                <Input placeholder="Label" value={it.label}
                       onChange={(e) => {
                         const items = section.items.slice();
                         items[i] = { ...it, label: e.target.value };
                         onPatch({ items });
                       }} />
                <Input placeholder="/path or https://..." value={it.href}
                       onChange={(e) => {
                         const items = section.items.slice();
                         items[i] = { ...it, href: e.target.value };
                         onPatch({ items });
                       }} />
                <Button variant="ghost" size="icon" onClick={() => {
                  const items = section.items.slice();
                  items.splice(i, 1);
                  if (items.length === 0) items.push({ label: "", href: "" });
                  onPatch({ items });
                }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" type="button"
                  onClick={() => onPatch({ items: [...section.items, { label: "", href: "" }] })}>
            <Plus className="h-3 w-3 mr-1" /> Add link
          </Button>
        </div>
      );
    case "embed":
      return (
        <div className="space-y-2">
          <Input placeholder="https://embed-url" value={section.url}
                 onChange={(e) => onPatch({ url: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Title (optional)" value={section.title ?? ""}
                   onChange={(e) => onPatch({ title: e.target.value || undefined })} />
            <Input type="number" placeholder="Height px" value={section.height ?? 420}
                   onChange={(e) => onPatch({ height: Math.max(160, Math.min(1200, Number(e.target.value) || 420)) })} />
          </div>
          <p className="text-[11px] text-muted-foreground">Sandboxed iframe. Make sure the source allows embedding.</p>
        </div>
      );
    case "media":
      return (
        <div className="space-y-2">
          <Input placeholder="https://image-url" value={section.src}
                 onChange={(e) => onPatch({ src: e.target.value })} />
          <Input placeholder="Alt text" value={section.alt ?? ""}
                 onChange={(e) => onPatch({ alt: e.target.value || undefined })} />
          <Input placeholder="Caption (optional)" value={section.caption ?? ""}
                 onChange={(e) => onPatch({ caption: e.target.value || undefined })} />
        </div>
      );
    case "portal_grid":
      return (
        <div className="space-y-2">
          <Input placeholder="Heading (optional)" value={section.heading ?? ""}
                 onChange={(e) => onPatch({ heading: e.target.value || undefined })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="w-full border rounded-md bg-background px-2 py-2 text-sm"
                    value={section.kind}
                    onChange={(e) => onPatch({ kind: e.target.value })}>
              {["joke","music","trade","connect","battle","tool"].map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <Input type="number" placeholder="Limit" value={section.limit ?? 6}
                   onChange={(e) => onPatch({ limit: Math.max(1, Math.min(24, Number(e.target.value) || 6)) })} />
          </div>
          <p className="text-[11px] text-muted-foreground">Auto-lists the most recent spawned portals of this kind.</p>
        </div>
      );
    default:
      return null;
  }
}