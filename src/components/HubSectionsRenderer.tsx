import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalHeader } from "@/components/PortalHeader";
import type { HubSection } from "@/lib/hub-sections";

/**
 * Locked layout for boss-built custom hubs. Same typography, padding, and
 * accent system as the built-in HUB pages, so every new hub looks native.
 */
export function HubSectionsRenderer({
  sections,
  hub,
}: {
  sections: HubSection[];
  hub: { id: string; slug: string | null; title: string; tagline: string; description?: string; accent: string };
}) {
  return (
    <main className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-8 pb-24 space-y-10"
      style={{ ["--hub-accent" as any]: hub.accent }}>
      {sections.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-16">
          This hub has no sections yet.
        </p>
      )}
      {sections.map((s, i) => (
        <SectionRenderer key={i} section={s} hub={hub} />
      ))}
    </main>
  );
}

function SectionRenderer({
  section,
  hub,
}: {
  section: HubSection;
  hub: { id: string; slug: string | null; title: string; tagline: string; description?: string; accent: string };
}) {
  switch (section.type) {
    case "hero":
      return (
        <PortalHeader
          portalKey={`hub_${hub.slug ?? hub.id}`}
          name={hub.title}
          tagline={section.tagline ?? hub.tagline}
          seed={section.seed ?? hub.description}
        />
      );
    case "text":
      return (
        <section className="rounded-2xl border bg-card/60 backdrop-blur p-6 sm:p-8">
          {section.heading && (
            <h2 className="font-[Montserrat] font-black text-xl sm:text-2xl text-metallic mb-3">
              {section.heading}
            </h2>
          )}
          <p className="whitespace-pre-wrap text-sm sm:text-base text-foreground/90 leading-relaxed">
            {section.body}
          </p>
        </section>
      );
    case "link_grid":
      return (
        <section>
          {section.heading && (
            <h2 className="font-[Montserrat] font-black text-lg sm:text-xl text-metallic mb-4 px-1">
              {section.heading}
            </h2>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((item, i) => {
              const isExt = /^https?:\/\//i.test(item.href);
              const cls =
                "group block relative overflow-hidden rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[0_0_40px_-15px_var(--hub-accent)]";
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-bold text-sm sm:text-base">{item.label || "Untitled"}</div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  {item.desc && <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>}
                </>
              );
              return isExt ? (
                <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
                   className={cls} style={{ borderColor: `${hub.accent}55` }}>
                  {inner}
                </a>
              ) : (
                <Link key={i} to={item.href as any} className={cls}
                      style={{ borderColor: `${hub.accent}55` }}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      );
    case "embed":
      return (
        <section className="rounded-2xl border overflow-hidden bg-black/40"
                 style={{ borderColor: `${hub.accent}55` }}>
          {section.title && (
            <div className="px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground border-b"
                 style={{ borderColor: `${hub.accent}33` }}>
              {section.title}
            </div>
          )}
          <iframe
            src={section.url}
            title={section.title ?? "embed"}
            className="block w-full"
            style={{ height: section.height ?? 420 }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </section>
      );
    case "media":
      return (
        <figure className="rounded-2xl overflow-hidden border bg-card/40"
                style={{ borderColor: `${hub.accent}55` }}>
          <img
            src={section.src}
            alt={section.alt ?? ""}
            loading="lazy"
            className="block w-full h-auto"
          />
          {section.caption && (
            <figcaption className="px-4 py-3 text-xs text-muted-foreground border-t"
                        style={{ borderColor: `${hub.accent}33` }}>
              {section.caption}
            </figcaption>
          )}
        </figure>
      );
    case "portal_grid":
      return <PortalGrid heading={section.heading} kind={section.kind} limit={section.limit} accent={hub.accent} />;
    default:
      return null;
  }
}

function PortalGrid({
  heading, kind, limit, accent,
}: { heading?: string; kind: string; limit: number; accent: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase
      .from("portals")
      .select("id,slug,name,niche,vibe,kind")
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data }) => { if (alive) setItems(data ?? []); });
    return () => { alive = false; };
  }, [kind, limit]);

  const prefixForKind: Record<string, string> = {
    joke: "/p/", music: "/m/", trade: "/td/", connect: "/connect", battle: "/b/", tool: "/t/",
  };
  const prefix = prefixForKind[kind] ?? "/p/";

  return (
    <section>
      {heading && (
        <h2 className="font-[Montserrat] font-black text-lg sm:text-xl text-metallic mb-4 px-1">
          {heading}
        </h2>
      )}
      {items === null ? (
        <p className="text-xs text-muted-foreground">Loading portals…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No portals yet for kind “{kind}”.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <Link key={p.id} to={`${prefix}${p.slug}` as any}
                  className="group block rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[0_0_40px_-15px_var(--hub-accent)]"
                  style={{ borderColor: `${accent}55` }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" /> {p.niche || kind}
              </div>
              <div className="mt-2 font-bold">{p.name}</div>
              {p.vibe && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.vibe}</div>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}