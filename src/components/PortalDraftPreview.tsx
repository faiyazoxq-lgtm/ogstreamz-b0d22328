import { useMemo } from "react";
import { Eye, Crown, ImageIcon, Video, Music2, Link2 } from "lucide-react";

/**
 * Live preview of an in-flight portal draft used by the Boss editor in
 * `src/routes/boss.portals.tsx`. Renders three side-by-side previews so a
 * boss can verify the portal before saving:
 *  1. Card — how it appears in lists (name, hub chip, niche, vibe, VIP).
 *  2. Landing — wallpaper / bg-video / audio-snippet stand-in with hero text.
 *  3. SEO — Google + OG-share card built from seo_title / description / image.
 *
 * Pure-presentational. No data fetching, no mutations.
 */

export type PortalDraft = {
  name?: string | null;
  slug?: string | null;
  kind?: string | null;
  niche?: string | null;
  vibe?: string | null;
  language?: string | null;
  theme?: string | null;
  vip?: boolean | null;
  use_credit_cost?: number | null;
  style?: string | null;
  swear_chat_enabled?: boolean | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image_url?: string | null;
  wallpaper_url?: string | null;
  bg_video_url?: string | null;
  bg_video_aspect?: string | null;
  audio_url?: string | null;
  audio_snippet_url?: string | null;
  lyric_text?: string | null;
};

const KIND_PATH: Record<string, (s: string) => string> = {
  music: (s) => `/m/${s}`,
  trade: (s) => `/td/${s}`,
};
function pathFor(kind: string, slug: string) {
  return (KIND_PATH[kind] ?? ((s: string) => `/p/${s}`))(slug);
}

const HUB_LABELS: Record<string, string> = {
  music: "MusicHUB", joke: "JokesHUB", jokes: "JokesHUB",
  trade: "TradeHUB", connect: "ConnectHUB", battle: "BattleHUB",
  tools: "ToolHUB", tool: "ToolHUB",
};
function hubLabel(kind: string) {
  return HUB_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1) + "HUB";
}

const SITE_HOST = "ogstreamz.co.uk";

export function PortalDraftPreview({ draft }: { draft: PortalDraft }) {
  const name = (draft.name ?? "").trim() || "Untitled portal";
  const slug = (draft.slug ?? "").trim() || "your-slug";
  const kind = (draft.kind ?? "portal").trim() || "portal";
  const niche = (draft.niche ?? "").trim();
  const vibe = (draft.vibe ?? "").trim();
  const lyric = (draft.lyric_text ?? "").trim();
  const wallpaper = (draft.wallpaper_url ?? "").trim();
  const bgVideo = (draft.bg_video_url ?? "").trim();
  const audio = (draft.audio_snippet_url ?? draft.audio_url ?? "").trim();
  const seoTitle = (draft.seo_title ?? "").trim() || name;
  const seoDesc = (draft.seo_description ?? "").trim() || niche;
  const seoImage = (draft.seo_image_url ?? wallpaper).trim();

  const url = useMemo(() => `${SITE_HOST}${pathFor(kind, slug)}`, [kind, slug]);

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-primary">
        <Eye className="h-3.5 w-3.5" /> Live preview · updates as you type
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Card preview */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Card</p>
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm truncate">{name}</p>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{hubLabel(kind)}</span>
              {draft.vip ? (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 inline-flex items-center gap-1"><Crown className="h-2.5 w-2.5" /> VIP</span>
              ) : null}
              {(draft.use_credit_cost ?? 0) > 0 && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{draft.use_credit_cost} cr</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-1">/{slug} · {draft.theme || "street"} · {draft.language || "English"}</p>
            {niche && <p className="text-xs text-muted-foreground/80 truncate mt-0.5">{niche}</p>}
            {vibe && <p className="text-[11px] italic text-muted-foreground/70 truncate mt-0.5">vibe: {vibe}</p>}
          </div>
        </div>

        {/* Landing preview */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Landing</p>
          <div className="relative overflow-hidden rounded-xl border bg-black aspect-video">
            {bgVideo ? (
              <video
                src={bgVideo}
                muted
                loop
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
            ) : wallpaper ? (
              <img
                src={wallpaper}
                alt={`${name} background preview`}
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs gap-1">
                <ImageIcon className="h-5 w-5 opacity-60" />
                <span>No wallpaper / video yet</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute inset-0 p-3 flex flex-col justify-end gap-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/70">{hubLabel(kind)}</p>
              <h3 className="text-white font-black text-lg leading-tight drop-shadow">{name}</h3>
              {lyric ? (
                <p className="text-[11px] text-white/85 line-clamp-2 whitespace-pre-line">{lyric}</p>
              ) : niche ? (
                <p className="text-[11px] text-white/80 line-clamp-2">{niche}</p>
              ) : null}
              <div className="flex items-center gap-2 text-[10px] text-white/70 mt-0.5">
                {bgVideo && <span className="inline-flex items-center gap-1"><Video className="h-3 w-3" /> video</span>}
                {audio && <span className="inline-flex items-center gap-1"><Music2 className="h-3 w-3" /> audio</span>}
                <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" /> {url}</span>
              </div>
            </div>
          </div>
          {audio && (
            <audio src={audio} controls className="w-full h-8" preload="none" />
          )}
        </div>

        {/* SEO preview */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">SEO &amp; share</p>
          {/* Google-style result */}
          <div className="rounded-xl border bg-card p-3 space-y-1">
            <p className="text-[11px] text-emerald-400 truncate">{url}</p>
            <p className="text-sm text-blue-300 truncate">{seoTitle}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{seoDesc || "Add an SEO description to control what search engines display."}</p>
            <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
              <span className={seoTitle.length > 60 ? "text-amber-400" : ""}>Title {seoTitle.length}/60</span>
              <span className={seoDesc.length > 160 ? "text-amber-400" : ""}>Desc {seoDesc.length}/160</span>
            </div>
          </div>
          {/* OG share card */}
          <div className="rounded-xl border overflow-hidden">
            <div className="aspect-[1.91/1] bg-muted relative">
              {seoImage ? (
                <img src={seoImage} alt={`${seoTitle} share card preview`} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">
                  No share image
                </div>
              )}
            </div>
            <div className="p-2 bg-background">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{SITE_HOST}</p>
              <p className="text-xs font-semibold truncate">{seoTitle}</p>
              {seoDesc && <p className="text-[11px] text-muted-foreground line-clamp-2">{seoDesc}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}