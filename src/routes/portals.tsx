import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, Music2, Smile, TrendingUp, Newspaper, Swords, Wrench, ClipboardList, Search, Crown, QrCode, Share2, Globe, Download, X, Bot, Sparkles, PlusCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { requireMember } from "@/lib/route-guards";
import { useAuth } from "@/hooks/use-auth";
import ogBotAvatar from "@/assets/og-streamz-wallpaper.png";

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

// Where to send users when they want to spawn a new portal of a given kind.
const SPAWN_TO: Record<Item["kind"], string> = {
  music: "/music",
  joke: "/jokes",
  trade: "/trade",
  news: "/jokes",
  form: "/formhub",
  battle: "/battlehub",
  tool: "/tools",
};

/**
 * OG BoT empty-state card. Speaks with absolute profanity to roast the user
 * (or the Boss) into spawning a portal. Used when a hub or a sub-group has
 * no portals yet so the page never feels dead — clicking the CTA jumps to
 * the spawn hub for that kind.
 */
function OgBotEmpty({
  kind,
  side,
  compact = false,
}: {
  kind: Item["kind"];
  side: "boss" | "mine" | "any";
  compact?: boolean;
}) {
  const meta = KIND_META[kind];
  const spawnHref = SPAWN_TO[kind];
  const lines: Record<typeof side, { title: string; body: string; cta: string }> = {
    boss: {
      title: `Boss hasn't dropped a damn ${meta.label} portal yet.`,
      body: `The lazy bastard's still asleep — nothing official to flex in ${meta.hub}. Spawn your own and rub it in.`,
      cta: `Spawn a ${meta.label} portal`,
    },
    mine: {
      title: `You haven't spawned a fucking ${meta.label} portal.`,
      body: `Stop scrolling like a tourist and make some shit. Two clicks in ${meta.hub} and you're on the board.`,
      cta: `Spawn one in ${meta.hub}`,
    },
    any: {
      title: `${meta.hub} is bone fucking empty.`,
      body: `No Boss drops, no user portals — absolute ghost town. Be the first prick to plant a flag.`,
      cta: `Open ${meta.hub}`,
    },
  };
  const copy = lines[side];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-xl ${compact ? "p-4" : "p-5 sm:p-6"}`}
      style={{
        borderColor: `color-mix(in oklab, ${meta.accent} 35%, transparent)`,
        boxShadow: `0 0 40px -28px ${meta.accent}`,
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="relative shrink-0 overflow-hidden rounded-full h-12 w-12 sm:h-14 sm:w-14 ring-2"
          style={{
            background: `color-mix(in oklab, ${meta.accent} 15%, transparent)`,
            boxShadow: `0 0 22px -6px ${meta.accent}, inset 0 0 20px color-mix(in oklab, ${meta.accent} 25%, transparent)`,
            // @ts-ignore – CSS custom prop for ring colour
            "--tw-ring-color": `color-mix(in oklab, ${meta.accent} 60%, transparent)` as any,
          }}
        >
          <img
            src={ogBotAvatar}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover scale-[1.15]"
            style={{ objectPosition: "78% 48%" }}
          />
          <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/40 via-transparent to-white/10" />
          <Bot
            className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-black/80 p-0.5 ring-1 ring-white/20"
            style={{ color: meta.accent }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: meta.accent }}>
            <Sparkles className="h-3 w-3" /> OG BoT
          </div>
          <p className="mt-1 font-[Montserrat] font-black text-base sm:text-lg leading-tight text-foreground">
            {copy.title}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{copy.body}</p>
          <Link
            to={spawnHref as never}
            className="portal-button-motion mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.2em] font-bold text-black"
            style={{ background: meta.accent }}
          >
            <PlusCircle className="h-3.5 w-3.5" /> {copy.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}

type PortalsSearch = {
  filter: "all" | Item["kind"];
  scope: "all" | "boss" | "mine";
  q: string;
};

const FILTER_VALUES: PortalsSearch["filter"][] = ["all", "music", "joke", "trade", "news", "form", "battle", "tool"];
const SCOPE_VALUES: PortalsSearch["scope"][] = ["all", "boss", "mine"];

export const Route = createFileRoute("/portals")({
  beforeLoad: requireMember,
  // Persist filter / scope / search query in the URL so the grouping and
  // ordering of portals stays consistent across navigation and refresh.
  validateSearch: (raw: Record<string, unknown>): PortalsSearch => {
    const f = String(raw.filter ?? "all") as PortalsSearch["filter"];
    const s = String(raw.scope ?? "all") as PortalsSearch["scope"];
    const q = typeof raw.q === "string" ? raw.q.slice(0, 80) : "";
    return {
      filter: FILTER_VALUES.includes(f) ? f : "all",
      scope: SCOPE_VALUES.includes(s) ? s : "all",
      q,
    };
  },
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
  // VIPs already know MusicHUB inside-out — suppress the OG BoT empty-state
  // nudge for the `music` kind so it stops cluttering their Portals page.
  const isVip =
    isBoss || profile?.rank === "vip" || profile?.status === "vip";
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Filter / scope / search query are persisted in the URL via validateSearch
  // so the grouping & ordering stay consistent across navigation and refresh.
  const { filter, scope, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/portals" });
  const setFilter = (v: PortalsSearch["filter"]) =>
    navigate({ search: (prev: PortalsSearch) => ({ ...prev, filter: v }), replace: true });
  const setScope = (v: PortalsSearch["scope"]) =>
    navigate({ search: (prev: PortalsSearch) => ({ ...prev, scope: v }), replace: true });
  const setQ = (v: string) =>
    navigate({ search: (prev: PortalsSearch) => ({ ...prev, q: v }), replace: true });
  const [qrFor, setQrFor] = useState<Item | null>(null);
  // Per-user badge visibility preferences. Non-sensitive UI prefs only.
  // Synced to profiles.ui_prefs.badges so they follow the user across
  // devices. localStorage acts as an offline cache to avoid first-paint
  // flicker before the profile row loads.
  const BADGE_PREFS_KEY = "portals.badgePrefs.v1";
  type BadgePrefs = { boss: boolean; mine: boolean; vip: boolean };
  const normalizePrefs = (raw: any): BadgePrefs => ({
    boss: raw?.boss !== false,
    mine: raw?.mine !== false,
    vip: raw?.vip !== false,
  });
  const [badgePrefs, setBadgePrefs] = useState<BadgePrefs>({ boss: true, mine: true, vip: true });
  // Polite SR announcement for the most recent badge toggle.
  const [badgeAnnouncement, setBadgeAnnouncement] = useState("");
  // Hydrate from localStorage cache on mount (instant, no network).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(BADGE_PREFS_KEY);
      if (raw) setBadgePrefs(normalizePrefs(JSON.parse(raw)));
    } catch { /* ignore corrupt prefs */ }
  }, []);
  // When signed in, pull authoritative prefs from profiles.ui_prefs and
  // overwrite the local cache so they match across devices.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("profiles")
        .select("ui_prefs")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || e || !data) return;
      const remote = (data.ui_prefs as any)?.badges;
      if (remote && typeof remote === "object") {
        const next = normalizePrefs(remote);
        setBadgePrefs(next);
        try { window.localStorage.setItem(BADGE_PREFS_KEY, JSON.stringify(next)); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);
  const toggleBadge = (key: keyof BadgePrefs) => {
    setBadgePrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const labels: Record<keyof BadgePrefs, string> = { boss: "Boss", mine: "Mine", vip: "VIP" };
      setBadgeAnnouncement(`${labels[key]} badges ${next[key] ? "shown" : "hidden"}`);
      try {
        window.localStorage.setItem(BADGE_PREFS_KEY, JSON.stringify(next));
      } catch { /* storage may be unavailable in private mode */ }
      // Fire-and-forget sync to profile. RLS limits this to the user's own row.
      if (user?.id) {
        (async () => {
          const { data: cur } = await supabase
            .from("profiles")
            .select("ui_prefs")
            .eq("id", user.id)
            .maybeSingle();
          const merged = { ...((cur?.ui_prefs as any) ?? {}), badges: next };
          await supabase.from("profiles").update({ ui_prefs: merged }).eq("id", user.id);
        })().catch(() => { /* best-effort sync */ });
      }
      return next;
    });
  };
  // Per-hub visible-count state: MusicHUB / JokesHUB / ToolHUB paginate
  // long lists so the page stays fast even with hundreds of portals.
  const PAGE_SIZE = 12;
  const PAGINATED_KINDS: Item["kind"][] = ["music", "joke", "tool"];
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({
    music: PAGE_SIZE,
    joke: PAGE_SIZE,
    tool: PAGE_SIZE,
  });
  // Reset paging whenever the filter, search query, or scope changes so users
  // don't see a misleading "Show more" hidden behind a tiny filtered set.
  useEffect(() => {
    setVisibleCounts({ music: PAGE_SIZE, joke: PAGE_SIZE, tool: PAGE_SIZE });
  }, [filter, q, scope]);
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
              supabase.from("calculators_public")
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
      if (scope === "boss" && !i.byBoss) return false;
      if (scope === "mine" && i.byBoss) return false;
      if (q && !(`${i.name} ${i.subtitle} ${i.slug}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [items, filter, q, scope]);

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
      <header className="mb-12 sm:mb-16">
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
      <div className="mb-8 grid gap-3 sm:flex sm:items-center sm:justify-between">
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
                className="portal-button-motion inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold border"
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
          {/* Scope toggle: All / Boss-published / Yours */}
          <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5 text-[10px] uppercase tracking-[0.18em] font-bold">
            {(["all","boss","mine"] as const).map((s) => {
              const active = scope === s;
              const label = s === "all" ? "All" : s === "boss" ? "Boss" : "Mine";
              return (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  aria-pressed={active}
                  className="portal-button-motion px-2.5 py-1.5 rounded"
                  style={{
                    background: active ? "rgba(255,255,255,0.08)" : "transparent",
                    color: active ? "var(--mood-accent,#ffd166)" : "rgba(255,255,255,0.65)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {/* Badge visibility toggles — keyboard + screen-reader friendly.
              role="group" + aria-label names the cluster; each button is a
              toggle (aria-pressed) with a visually-hidden state label so
              screen readers announce "Boss badges, hidden, toggle button"
              instead of just "Boss". A polite live region announces the
              change after activation. */}
          <div
            className="badge-toggle-group inline-flex items-center rounded-md border border-border bg-card p-0.5 text-[10px] uppercase tracking-[0.18em] font-bold"
            role="group"
            aria-label="Badge visibility"
          >
            {([
              { key: "boss" as const, label: "Boss" },
              { key: "mine" as const, label: "Mine" },
              { key: "vip" as const, label: "VIP" },
            ]).map(({ key, label }) => {
              const on = badgePrefs[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleBadge(key)}
                  aria-pressed={on}
                  aria-label={`${label} badges, ${on ? "shown" : "hidden"}`}
                  title={`${on ? "Hide" : "Show"} ${label} badges`}
                  className="portal-button-motion inline-flex items-center gap-1 px-2.5 py-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mood-accent,#ffd166)] focus-visible:ring-offset-1 focus-visible:ring-offset-card"
                  style={{
                    background: on ? "rgba(255,255,255,0.08)" : "transparent",
                    color: on ? "var(--mood-accent,#ffd166)" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {on ? (
                    <Eye className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <EyeOff className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span aria-hidden="true">{label}</span>
                  <span className="sr-only">{on ? "shown" : "hidden"}</span>
                </button>
              );
            })}
          </div>
          {/* Polite live region — announces the latest toggle change without
              stealing focus. Updated by toggleBadge via badgeAnnouncement. */}
          <span className="sr-only" role="status" aria-live="polite">
            {badgeAnnouncement}
          </span>
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
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 sm:p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No portals match {q ? `“${q}”` : "this filter"} in <span className="font-bold text-foreground">{scope === "boss" ? "Boss-published" : scope === "mine" ? "your portals" : "any scope"}</span> yet.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(filter === "all" ? HUB_ORDER : [filter as Item["kind"]])
              .filter((k) => !(isVip && k === "music"))
              .slice(0, 4)
              .map((k) => (
              <OgBotEmpty
                key={k}
                kind={k}
                side={scope === "boss" ? "boss" : scope === "mine" ? "mine" : "any"}
                compact
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {HUB_ORDER.map((hubKind) => {
            const hubItems = filtered.filter((i) => i.kind === hubKind);
            if (hubItems.length === 0) return null;
            const hubMeta = KIND_META[hubKind];
            const paginated = PAGINATED_KINDS.includes(hubKind);
            const visible = paginated ? (visibleCounts[hubKind] ?? PAGE_SIZE) : hubItems.length;
            const shown = paginated ? hubItems.slice(0, visible) : hubItems;
            const remaining = hubItems.length - shown.length;
            // When scope === "all", detect if either Boss or Mine subgroup is
            // empty within this hub so we can show a friendly OG BoT nudge.
            const hasBoss = hubItems.some((i) => i.byBoss);
            const hasMine = hubItems.some((i) => !i.byBoss);
            const missingSide: "boss" | "mine" | null =
              scope === "all" ? (!hasBoss ? "boss" : !hasMine ? "mine" : null) : null;
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
                    {paginated && remaining > 0
                      ? `${shown.length} of ${hubItems.length} portals`
                      : `${hubItems.length} portal${hubItems.length === 1 ? "" : "s"}`}
                  </span>
                </header>
                <div className="grid gap-2.5 sm:gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] items-stretch">
                  {shown.map((i, idx) => {
            const meta = KIND_META[i.kind];
            const href = buildHref(i);
            // Cap the cascade so large hubs don't drag — last card kicks
            // off no later than ~480ms, keeping total reveal under ~840ms.
            const revealDelay = `${Math.min(idx, 8) * 60}ms`;
            return (
              <div
                key={`${i.kind}-${i.id}`}
                className="group portal-card-motion portal-card-reveal relative flex h-full flex-col gap-2.5 sm:gap-4 rounded-2xl border border-white/10 bg-black/40 p-3.5 sm:p-5 backdrop-blur-xl min-h-[230px] sm:min-h-[280px]"
                style={{ boxShadow: `0 0 32px -24px ${meta.accent}`, ["--portal-reveal-delay" as any]: revealDelay }}
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] min-w-0 truncate" style={{ color: meta.accent }}>
                    <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
                  </div>
                  {/* Badge stack: wraps on narrow cards so Boss/Mine never
                      collides with VIP. Right-aligned, fixed gap, identical
                      pill heights keep the row visually aligned across all
                      cards regardless of which badges are present. */}
                  {/* Badge stack: badges stay mounted and animate width /
                      opacity / scale on toggle.
                      - `flex-nowrap` (was `flex-wrap`) keeps badges on a
                        single row so flex doesn't recompute the wrap point
                        mid-animation as a badge's max-width shrinks (was
                        causing a 2→1 line jump on narrow mobile).
                      - `min-h-5` reserves the badge row height so the title
                        row above never jumps when the last visible badge
                        collapses to zero.
                      - At most two badges per card (Boss XOR Mine, plus
                        optional VIP), so a single row fits within 60% of
                        even a 360px card. */}
                  <div className="flex flex-nowrap justify-end items-center gap-1 shrink-0 max-w-[60%] min-h-5">
                    {i.byBoss ? (
                      <span
                        aria-hidden={!badgePrefs.boss}
                        data-show={badgePrefs.boss}
                        className="badge-toggle inline-flex items-center h-5 rounded-full text-[10px] leading-none uppercase tracking-widest font-bold bg-[oklch(0.72_0.22_245/0.15)] border border-[oklch(0.72_0.22_245/0.5)] text-[oklch(0.78_0.18_245)]"
                      >
                        <span className="badge-toggle-inner">Boss</span>
                      </span>
                    ) : (
                      <span
                        aria-hidden={!badgePrefs.mine}
                        data-show={badgePrefs.mine}
                        className="badge-toggle inline-flex items-center h-5 rounded-full text-[10px] leading-none uppercase tracking-widest font-bold bg-white/5 border border-white/20 text-white/80"
                      >
                        <span className="badge-toggle-inner">Mine</span>
                      </span>
                    )}
                    {i.vip && (
                      <span
                        aria-hidden={!badgePrefs.vip}
                        data-show={badgePrefs.vip}
                        className="badge-toggle inline-flex items-center h-5 rounded-full text-[10px] leading-none uppercase tracking-widest font-bold bg-gold/15 border border-gold/50 text-gold"
                      >
                        <span className="badge-toggle-inner inline-flex items-center gap-1">
                          <Crown className="h-3 w-3" /> VIP
                        </span>
                      </span>
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
                    className="portal-card-title m-0 text-eye-ice--bright tracking-[-0.02em] leading-[1.15] sm:leading-[1.1] lg:leading-[1.05] line-clamp-2 break-words"
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
                      // Size variant by hub: MusicHUB → lg (hero CTA),
                      // JokesHUB → md (default), ToolHUB → sm (compact).
                      // The variant class owns padding/font/radius/min-h
                      // and the matching --portal-focus-scale, so we drop
                      // the Tailwind px/py/text-* utilities here to avoid
                      // a double-sized footprint.
                      className={`portal-button-motion ${
                        i.kind === "music"
                          ? "portal-button-motion--lg"
                          : i.kind === "joke"
                            ? "portal-button-motion--md"
                            : i.kind === "tool"
                              ? "portal-button-motion--sm"
                              : "px-1.5 sm:px-3 py-2 text-[10px] sm:text-[11px] rounded-md"
                      } flex-1 min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 uppercase tracking-[0.12em] sm:tracking-[0.18em] font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-primary`}
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
                {missingSide && !(isVip && hubKind === "music") && (
                  <div className="mt-4">
                    <OgBotEmpty kind={hubKind} side={missingSide} compact />
                  </div>
                )}
                {paginated && remaining > 0 && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() =>
                        setVisibleCounts((prev) => ({
                          ...prev,
                          [hubKind]: (prev[hubKind] ?? PAGE_SIZE) + PAGE_SIZE,
                        }))
                      }
                      className="portal-button-motion inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[11px] uppercase tracking-[0.2em] font-bold"
                      style={{
                        borderColor: `color-mix(in oklab, ${hubMeta.accent} 50%, transparent)`,
                        color: hubMeta.accent,
                        background: `color-mix(in oklab, ${hubMeta.accent} 8%, transparent)`,
                      }}
                    >
                      Show {Math.min(PAGE_SIZE, remaining)} more
                      <span className="opacity-60">({remaining} left)</span>
                    </button>
                  </div>
                )}
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