import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, Music2, Smile, TrendingUp, Newspaper, Swords, Wrench, ClipboardList, Search, Crown, QrCode, Share2, Globe, Download, X } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { requireMember } from "@/lib/route-guards";
import { useAuth } from "@/hooks/use-auth";

type PortalRow = {
  id: string;
  slug: string;
  name: string;
  niche: string | null;
  kind: string;
  vip: boolean;
  view_count: number;
  created_at: string;
};

type BattleRow = {
  id: string; slug: string; name: string; tagline: string | null; view_count: number; created_at: string; public: boolean;
};

type ToolRow = {
  id: string; slug: string; name: string; description: string | null; vip: boolean; created_at: string; published: boolean;
};

type Item = {
  id: string; slug: string; name: string; subtitle: string;
  kind: "music" | "joke" | "trade" | "news" | "battle" | "tool" | "form";
  to: "/m/$slug" | "/p/$slug" | "/td/$slug" | "/b/$slug" | "/t/$slug" | "/f/$slug";
  vip: boolean; views: number; created_at: string; byBoss: boolean;
};

const KIND_META: Record<Item["kind"], { label: string; hub: string; Icon: any; accent: string }> = {
  music:  { label: "Music",  hub: "MusicHUB",  Icon: Music2,     accent: "#3ad6ff" },
  joke:   { label: "Jokes",  hub: "JokesHUB",  Icon: Smile,      accent: "#ffd166" },
  trade:  { label: "Trade",  hub: "TradeHUB",  Icon: TrendingUp, accent: "#D4AF37" },
  news:   { label: "News",   hub: "NewsHUB",   Icon: Newspaper,  accent: "#a78bfa" },
  battle: { label: "Battle", hub: "BattleHUB", Icon: Swords,     accent: "#ff2e55" },
  tool:   { label: "Tool",   hub: "ToolHUB",   Icon: Wrench,     accent: "#5cbdb9" },
  form:   { label: "Form",   hub: "FormHUB",   Icon: ClipboardList, accent: "#7dd3fc" },
};

// Display order for hub sections on the portals page.
const HUB_ORDER: Item["kind"][] = ["music", "joke", "trade", "news", "form", "battle", "tool"];

const PORTAL_TO: Record<string, Item["to"]> = {
  music: "/m/$slug",
  joke: "/p/$slug",
  trade: "/td/$slug",
  news: "/p/$slug",
  form: "/f/$slug",
};

export const Route = createFileRoute("/portals")({
  beforeLoad: requireMember,
  head: () => ({
    meta: [
      { title: "All Portals — 0G Share Hub" },
      { name: "description", content: "Every portal you've spawned across MusicHUB, JokesHUB, TradeHUB, BattleHUB and ToolHUB — ready to share." },
    ],
  }),
  component: PortalsHub,
});

function PortalsHub() {
  const { user, isAdmin, profile } = useAuth();
  const isBoss = isAdmin || profile?.rank === "boss";
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Item["kind"]>("all");
  const [q, setQ] = useState("");
  const [qrFor, setQrFor] = useState<Item | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    (async () => {
      try {
        const out: Item[] = [];
        if (isBoss) {
          // Boss sees the full catalogue: every portal + battle + tool.
          const [{ data: portals, error: pErr }, { data: battles, error: bErr }, { data: tools, error: tErr }] =
            await Promise.all([
              supabase.from("portals")
                .select("id, slug, name, niche, kind, vip, view_count, created_at")
                .order("created_at", { ascending: false }),
              supabase.from("battles")
                .select("id, slug, name, tagline, view_count, created_at, public")
                .order("created_at", { ascending: false }),
              supabase.from("calculators")
                .select("id, slug, name, description, vip, created_at, published")
                .order("created_at", { ascending: false }),
            ]);
          if (pErr) throw pErr;
          if (bErr) throw bErr;
          if (tErr) throw tErr;
          for (const p of (portals as PortalRow[] | null) ?? []) {
            const to = PORTAL_TO[p.kind] ?? "/p/$slug";
            const kind = (["music","joke","trade","news","form"].includes(p.kind) ? p.kind : "joke") as Item["kind"];
            out.push({
              id: p.id, slug: p.slug, name: p.name, subtitle: p.niche || "",
              kind, to, vip: !!p.vip, views: p.view_count || 0, created_at: p.created_at, byBoss: true,
            });
          }
          for (const b of (battles as BattleRow[] | null) ?? []) {
            out.push({
              id: b.id, slug: b.slug, name: b.name, subtitle: b.tagline || "Battle scenario",
              kind: "battle", to: "/b/$slug", vip: false, views: b.view_count || 0, created_at: b.created_at, byBoss: true,
            });
          }
          for (const t of (tools as ToolRow[] | null) ?? []) {
            if (!t.published) continue;
            out.push({
              id: t.id, slug: t.slug, name: t.name, subtitle: t.description || "Spawned tool",
              kind: "tool", to: "/t/$slug", vip: !!t.vip, views: 0, created_at: t.created_at, byBoss: true,
            });
          }
        } else {
          // Members & VIPs: Boss-published portals (curated for everyone) +
          // any portals the viewer themselves spawned. Both groups stream
          // into the same hub-grouped grid below.
          const [navRes, ownRes] = await Promise.all([
            supabase.rpc("list_nav_portals"),
            user?.id
              ? supabase.from("portals")
                  .select("id, slug, name, niche, kind, vip, view_count, created_at")
                  .eq("created_by", user.id)
                  .order("created_at", { ascending: false })
              : Promise.resolve({ data: [] as PortalRow[], error: null } as any),
          ]);
          if (navRes.error) throw navRes.error;
          const seen = new Set<string>();
          for (const p of (navRes.data ?? []) as Array<{ id: string; slug: string; name: string; kind: string; vip: boolean; by_boss?: boolean; created_at: string }>) {
            if (p.by_boss === false) continue;
            const to = PORTAL_TO[p.kind] ?? "/p/$slug";
            const kind = (["music","joke","trade","news","form"].includes(p.kind) ? p.kind : "joke") as Item["kind"];
            out.push({
              id: p.id, slug: p.slug, name: p.name, subtitle: "",
              kind, to, vip: !!p.vip, views: 0, created_at: p.created_at, byBoss: true,
            });
            seen.add(p.id);
          }
          for (const p of ((ownRes?.data ?? []) as PortalRow[])) {
            if (seen.has(p.id)) continue;
            const to = PORTAL_TO[p.kind] ?? "/p/$slug";
            const kind = (["music","joke","trade","news","form"].includes(p.kind) ? p.kind : "joke") as Item["kind"];
            out.push({
              id: p.id, slug: p.slug, name: p.name, subtitle: p.niche || "",
              kind, to, vip: !!p.vip, views: p.view_count || 0, created_at: p.created_at, byBoss: false,
            });
          }
        }
        // Boss-published portals first, then viewer's own — newest first within each group.
        out.sort((a, b) => {
          if (a.byBoss !== b.byBoss) return a.byBoss ? -1 : 1;
          return +new Date(b.created_at) - +new Date(a.created_at);
        });
        setItems(out);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load portals");
      }
    })();
  }, [isBoss, user?.id]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (filter !== "all" && i.kind !== filter) return false;
      if (q && !(`${i.name} ${i.subtitle} ${i.slug}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [items, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0 };
    for (const i of items ?? []) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [items]);

  const buildHref = (i: Item) => i.to.replace("$slug", i.slug);

  const copyLink = async (i: Item) => {
    try {
      await navigator.clipboard.writeText(`${origin}${buildHref(i)}`);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const shareAll = async () => {
    const lines = filtered.map((i) => `${i.name} — ${origin}${buildHref(i)}`).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      toast.success(`Copied ${filtered.length} link${filtered.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const nativeShare = async (i: Item) => {
    const url = `${origin}${buildHref(i)}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: i.name, text: i.subtitle || i.name, url });
        return;
      } catch { /* user cancelled */ }
    }
    copyLink(i);
  };

  const downloadQr = (i: Item) => {
    const svg = document.getElementById(`qr-${i.id}`) as SVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const urlObj = URL.createObjectURL(blob);
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const png = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = png;
      a.download = `0g-${i.kind}-${i.slug}.png`;
      a.click();
      URL.revokeObjectURL(urlObj);
    };
    img.src = urlObj;
  };

  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-24 md:pb-14">
      <header className="mb-8">
        <p className="text-xs tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--mood-accent, #ffd166)" }}>
          0G · Share Hub
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-4xl sm:text-5xl tracking-tight">
          All Portals
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl">
          Every portal you've spawned — Music, Jokes, Trade, News, Battles and Tools — in one share-ready feed. Tap a card to open it, or copy a clean link to drop anywhere.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-300">
          <Globe className="h-3 w-3" /> Public view · No account needed to open
        </div>
      </header>

      {/* Controls */}
      <div className="mb-6 grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {((isBoss
              ? (["all","music","joke","trade","news","form","battle","tool"] as const)
              : (["all","music","joke","trade","news","form"] as const)
            ) as ReadonlyArray<"all" | Item["kind"]>).map((k) => {
            const active = filter === k;
            const meta = k === "all" ? null : KIND_META[k];
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold border transition"
                style={{
                  borderColor: active ? (meta?.accent ?? "var(--mood-accent,#ffd166)") : "rgba(255,255,255,0.12)",
                  background: active ? "rgba(255,255,255,0.06)" : "transparent",
                  color: active ? (meta?.accent ?? "var(--mood-accent,#ffd166)") : "rgba(255,255,255,0.7)",
                }}
              >
                {meta && <meta.Icon className="h-3.5 w-3.5" />}
                {k === "all" ? "All" : meta!.label}
                <span className="opacity-60">{counts[k] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search portals…"
              className="pl-8 pr-3 py-1.5 rounded-md bg-card border border-border text-xs w-44 focus:outline-none focus:border-[oklch(0.72_0.22_245/0.7)]"
            />
          </div>
          <button
            onClick={shareAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] font-bold hover:border-[oklch(0.72_0.22_245/0.7)]"
          >
            <Copy className="h-3.5 w-3.5" /> Copy all
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!items ? (
        <div className="text-sm text-muted-foreground">Loading portals…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No portals match this filter yet. Spawn one from a hub.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {HUB_ORDER.map((hubKind) => {
            const hubItems = filtered.filter((i) => i.kind === hubKind);
            if (hubItems.length === 0) return null;
            const hubMeta = KIND_META[hubKind];
            return (
              <section key={hubKind} aria-labelledby={`hub-${hubKind}`}>
                <header className="mb-3 flex items-center gap-2">
                  <hubMeta.Icon className="h-4 w-4" style={{ color: hubMeta.accent }} />
                  <h2
                    id={`hub-${hubKind}`}
                    className="font-[Montserrat] font-black tracking-tight text-xl sm:text-2xl"
                    style={{ color: hubMeta.accent }}
                  >
                    {hubMeta.hub}
                  </h2>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {hubItems.length} portal{hubItems.length === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="grid gap-2.5 sm:gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] items-stretch">
                  {hubItems.map((i) => {
            const meta = KIND_META[i.kind];
            const href = buildHref(i);
            return (
              <div
                key={`${i.kind}-${i.id}`}
                className="group relative flex h-full flex-col gap-2.5 sm:gap-4 rounded-2xl border border-white/10 bg-black/40 p-3.5 sm:p-5 backdrop-blur-xl transition hover:-translate-y-0.5 min-h-[230px] sm:min-h-[280px]"
                style={{ boxShadow: `0 0 32px -24px ${meta.accent}` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em]" style={{ color: meta.accent }}>
                    <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    {i.byBoss ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-[oklch(0.72_0.22_245/0.15)] border border-[oklch(0.72_0.22_245/0.5)] text-[oklch(0.78_0.18_245)]">
                        Boss
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-white/5 border border-white/20 text-white/80">
                        Mine
                      </span>
                    )}
                    {i.vip && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-gold/15 border border-gold/50 text-gold">
                      <Crown className="h-3 w-3" /> VIP
                    </div>
                    )}
                  </div>
                </div>
                <Link
                  to={i.to}
                  params={{ slug: i.slug }}
                  className="block space-y-2 sm:space-y-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {/* Title typography matches the header 0G-PORTAL wordmark:
                      JetBrains Mono / black weight via text-eye-ice--bright,
                      fluid clamp scale tuned to roughly half the navbar
                      wordmark, and a per-card accent halo layered on top of
                      the shared white→blue ice aura. */}
                  <h3
                    className="m-0 text-eye-ice--bright tracking-[-0.02em] leading-[1.15] sm:leading-[1.1] lg:leading-[1.05] line-clamp-2 break-words transition-[text-shadow,filter] duration-300 group-hover:brightness-110"
                    style={{
                      fontSize: "clamp(1rem, 3.6vw, 1.875rem)",
                      textShadow: `0 0 2px rgba(0,0,0,0.55), 0 0 8px rgba(0,0,0,0.4), 0 0 16px ${meta.accent}, 0 0 32px color-mix(in oklab, ${meta.accent} 55%, transparent)`,
                    }}
                  >
                    {i.name}
                  </h3>
                  <p
                    className="m-0 text-muted-foreground line-clamp-2 leading-relaxed sm:leading-snug lg:leading-tight"
                    style={{ fontSize: "clamp(0.75rem, 1.8vw, 0.8125rem)" }}
                  >
                    {i.subtitle || "—"}
                  </p>
                </Link>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 truncate">
                  {origin.replace(/^https?:\/\//, "")}{href}
                </div>
                <div className="mt-auto pt-2.5 sm:pt-4 border-t border-white/5 flex flex-col gap-2.5">
                  {/* Reserved views slot keeps the action row at the same
                      vertical position whether or not a card has views. */}
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 min-h-[1em]">
                    {i.views > 0 ? `${i.views.toLocaleString()} views` : "\u00A0"}
                  </div>
                  <div className="flex flex-nowrap items-stretch gap-1 sm:gap-1.5">
                    <button
                      onClick={() => copyLink(i)}
                      className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-md border border-border bg-card px-1.5 sm:px-3 py-2 text-[10px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.18em] font-bold hover:border-[oklch(0.72_0.22_245/0.7)]"
                      title="Copy link"
                      aria-label={`Copy link for ${i.name}`}
                    >
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                      <span className="hidden sm:inline">Copy</span>
                    </button>
                    <button
                      onClick={() => setQrFor(i)}
                      className="shrink-0 inline-flex items-center justify-center rounded-md border border-border bg-card w-9 sm:w-auto sm:px-3 py-2 text-[11px] font-bold hover:border-[oklch(0.72_0.22_245/0.7)]"
                      title="Show QR code"
                      aria-label={`Show QR code for ${i.name}`}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => nativeShare(i)}
                      className="shrink-0 inline-flex items-center justify-center rounded-md border border-border bg-card w-9 sm:w-auto sm:px-3 py-2 text-[11px] font-bold hover:border-[oklch(0.72_0.22_245/0.7)]"
                      title="Share"
                      aria-label={`Share ${i.name}`}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      to={i.to}
                      params={{ slug: i.slug }}
                      className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-md px-1.5 sm:px-3 py-2 text-[10px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.18em] font-bold text-black outline-none transition-transform hover:brightness-110 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary"
                      style={{ background: meta.accent }}
                    >
                      Open <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {qrFor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setQrFor(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Share ${qrFor.name}`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-6 backdrop-blur-xl"
            style={{ boxShadow: `0 0 60px -20px ${KIND_META[qrFor.kind].accent}` }}
          >
            <button
              onClick={() => setQrFor(null)}
              className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em]" style={{ color: KIND_META[qrFor.kind].accent }}>
                <QrCode className="h-3.5 w-3.5" /> Scan to open
              </div>
              <h3 className="mt-2 font-[Montserrat] font-black text-xl tracking-tight">{qrFor.name}</h3>
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Public · No account needed
              </p>
            </div>
            <div className="mt-5 flex items-center justify-center rounded-xl bg-white p-4">
              <QRCodeSVG
                id={`qr-${qrFor.id}`}
                value={`${origin}${buildHref(qrFor)}`}
                size={232}
                level="M"
                marginSize={1}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>
            <div className="mt-4 break-all rounded-md border border-border bg-card px-3 py-2 text-center text-[11px] text-muted-foreground">
              {origin}{buildHref(qrFor)}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => copyLink(qrFor)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-2 text-[10px] uppercase tracking-[0.18em] font-bold"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              <button
                onClick={() => downloadQr(qrFor)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-2 text-[10px] uppercase tracking-[0.18em] font-bold"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </button>
              <button
                onClick={() => nativeShare(qrFor)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[10px] uppercase tracking-[0.18em] font-bold text-black"
                style={{ background: KIND_META[qrFor.kind].accent }}
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}