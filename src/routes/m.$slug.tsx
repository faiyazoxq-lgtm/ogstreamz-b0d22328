import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Music, Wand2, Loader2, ArrowLeft, Disc3, Lock, BadgeCheck, Layers, Sparkles, Download, Share2, Play, Pause, Link2, Twitter, Facebook, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatLyrics, requestStudioTrack, generatePortalTrack, getPortalTrackJob, unlockPortalTrackDownload } from "@/lib/music-portals.functions";
import { spawnMusic } from "@/lib/suno.functions";
import { listPortalTracks, getTrackOwnership } from "@/lib/tracks.functions";
import { TrackPlayer } from "@/components/TrackPlayer";
import { SwearChatPanel } from "@/components/SwearChatPanel";
import { OgWordmark } from "@/components/OgWordmark";
import { CoinBalance } from "@/components/CoinBalance";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { COIN } from "@/lib/coins";

type MusicPortal = {
  id: string;
  slug: string;
  name: string;
  language: string;
  style: string | null;
  vibe: string | null;
  theme: string;
  swear_chat_enabled?: boolean;
  jokes: string[] | null;
  music_hooks: string[] | null;
  wallpaper_url?: string | null;
};

export const Route = createFileRoute("/m/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    unlocked: typeof search.unlocked === "string" ? search.unlocked : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    job: typeof search.job === "string" ? search.job : undefined,
  }),
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("portals_public")
      .select("id, slug, name, language, style, vibe, theme, kind, swear_chat_enabled, jokes, music_hooks, wallpaper_url")
      .eq("slug", params.slug)
      .eq("kind", "music")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();
    return { portal: data as MusicPortal };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.portal
      ? [
          { title: `${loaderData.portal.name} · 0G-Studio` },
          { name: "description", content: `${loaderData.portal.style ?? ""} · ${loaderData.portal.language}` },
        ]
      : [],
  }),
  component: MusicPortalPage,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold">{error.message}</h1>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-3xl font-bold">Music portal not found</h1>
        <Link to="/" className="text-sm underline mt-3 inline-flex items-center gap-1">Back to <OgWordmark suffix="-PORTAL" /></Link>
      </div>
    </main>
  ),
});

const THEMES: Record<string, { bg: string; accent: string; secondary: string; font: string; ornament: string; pattern: string; label: string }> = {
  "spiritual-blue": {
    bg: "radial-gradient(ellipse at top, #0a1f4a 0%, #020816 70%)",
    accent: "#5eb4ff",
    secondary: "#a8d4ff",
    font: "'Amiri', 'Scheherazade New', serif",
    ornament: "✦",
    pattern: "repeating-linear-gradient(45deg, transparent 0 24px, rgba(94,180,255,0.04) 24px 25px), repeating-linear-gradient(-45deg, transparent 0 24px, rgba(94,180,255,0.04) 24px 25px)",
    label: "نشيد · Spiritual Frequency",
  },
  "street-neon": {
    bg: "linear-gradient(180deg, #050810 0%, #0a1428 100%)",
    accent: "#00d4ff",
    secondary: "#ff3366",
    font: "'Bebas Neue', 'Impact', sans-serif",
    ornament: "▮",
    pattern: "repeating-linear-gradient(90deg, transparent 0 60px, rgba(0,212,255,0.06) 60px 61px)",
    label: "// STREET FREQUENCY",
  },
  "lofi-haze": {
    bg: "linear-gradient(180deg, #1a1530 0%, #0a0820 100%)",
    accent: "#b8a4ff",
    secondary: "#ffb3d9",
    font: "'Quicksand', sans-serif",
    ornament: "◐",
    pattern: "radial-gradient(circle at 20% 30%, rgba(184,164,255,0.1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,179,217,0.08) 0%, transparent 40%)",
    label: "lofi haze",
  },
  cyber: {
    bg: "linear-gradient(180deg, #050018 0%, #1a0033 100%)",
    accent: "#00ffea",
    secondary: "#ff00aa",
    font: "'Orbitron', sans-serif",
    ornament: "◆",
    pattern: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,255,234,0.05) 3px 4px)",
    label: "// SYNTH GRID",
  },
  "warm-folk": {
    bg: "linear-gradient(180deg, #2a1810 0%, #4a2a1a 100%)",
    accent: "#ffb874",
    secondary: "#e8884a",
    font: "'Lora', serif",
    ornament: "❦",
    pattern: "none",
    label: "Folk Roots",
  },
  "studio-blue": {
    bg: "linear-gradient(180deg, #050d20 0%, #0a1840 100%)",
    accent: "#3b82f6",
    secondary: "#60a5fa",
    font: "'Montserrat', sans-serif",
    ornament: "◈",
    pattern: "repeating-linear-gradient(135deg, transparent 0 40px, rgba(59,130,246,0.05) 40px 41px)",
    label: "0G-STUDIO",
  },
};

function MusicPortalPage() {
  const { portal } = Route.useLoaderData();
  const { unlocked: unlockedParam, job: jobParam } = Route.useSearch();
  const navigate = useNavigate();
  const theme = THEMES[portal.theme] ?? THEMES["studio-blue"];
  const { user, profile, isAdmin, refresh: refreshAuth } = useAuth();
  const isVip = isAdmin || profile?.status === "vip";
  const formatFn = useServerFn(formatLyrics);
  const requestFn = useServerFn(requestStudioTrack);
  const listTracksFn = useServerFn(listPortalTracks);
  const ownershipFn = useServerFn(getTrackOwnership);
  const generateTrackFn = useServerFn(generatePortalTrack);
  const getJobFn = useServerFn(getPortalTrackJob);
  const unlockFn = useServerFn(unlockPortalTrackDownload);
  const spawnFn = useServerFn(spawnMusic);

  type T = { id: string; title: string; price_cents: number; preview_url: string | null };
  const [tracks, setTracks] = useState<T[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());

  const refresh = async () => {
    try {
      const r = await listTracksFn({ data: { portal_slug: portal.slug } });
      setTracks(r.tracks);
      if (user && r.tracks.length) {
        const o = await ownershipFn({ data: { trackIds: r.tracks.map((t) => t.id) } });
        setOwned(new Set(o.owned));
      } else {
        setOwned(new Set());
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [portal.slug, user?.id]);

  // track_purchases was removed from the realtime publication for security
  // (broadcast leaked every user's purchase events to any authenticated
  // subscriber). Poll for ownership changes every 5s while the page is open
  // — RLS scopes the underlying refresh() read to the signed-in user.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refresh();
    }, 5_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, portal.slug]);

  // Returning from Stripe checkout: poll briefly until the webhook lands and the
  // purchase is reflected, then strip the URL params.
  useEffect(() => {
    if (!unlockedParam || !user) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      await refresh();
      if (cancelled) return;
      // Stop after 10 tries (~20s) or once we've rendered ownership.
      if (tries < 10) setTimeout(tick, 2000);
    };
    toast.success("Payment confirmed — unlocking your track…");
    tick();
    // Clear the search params so re-renders don't re-trigger.
    navigate({ to: "/m/$slug", params: { slug: portal.slug }, search: {}, replace: true });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedParam, user?.id]);

  // Realtime: when a Suno job for this user finishes, fire a toast.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`suno-jobs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "suno_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row?.audio_url) return;
          toast.success("🎧 Track Ready", {
            description: row.title || "Your Suno master is live",
            action: {
              label: "Play",
              onClick: () => window.open(row.audio_url, "_blank"),
            },
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const [raw, setRaw] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [trackJobId, setTrackJobId] = useState<string | null>(null);
  const [trackStatus, setTrackStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [audioV1, setAudioV1] = useState<string | null>(null);
  const [audioV2, setAudioV2] = useState<string | null>(null);
  const [downloadUnlocked, setDownloadUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);

  const STYLE_PRESETS = [
    "Aggressive & Raw",
    "Dark Cinematic",
    "Anthemic & Euphoric",
    "Chill Lo-Fi",
    "Bouncy Club",
    "Melodic & Emotional",
    "Gritty Underground",
    "Trap / 808 Heavy",
  ];

  const onPickStyle = async (preset: string) => {
    if (!user) return toast.error("Sign in to generate");
    if (trackStatus === "generating") return;
    setSelectedStyle(preset);
    setTrackStatus("generating");
    setAudioV1(null);
    setAudioV2(null);
    setDownloadUnlocked(false);
    setTrackJobId(null);
    try {
      const r = await generateTrackFn({ data: { slug: portal.slug, style: preset } });
      setTrackJobId(r.jobId);
      toast.success("Generating · 2 versions on the way (~60s)");
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
      setTrackStatus("failed");
    }
  };

  // Poll the suno job until both audio URLs land or timeout.
  useEffect(() => {
    if (!trackJobId || trackStatus !== "generating") return;
    let cancelled = false;
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const j = await getJobFn({ data: { jobId: trackJobId } });
        if (cancelled) return;
        if (j.audio_url_v1) setAudioV1(j.audio_url_v1);
        if (j.audio_url_v2) setAudioV2(j.audio_url_v2);
        setDownloadUnlocked(j.download_unlocked);
        if (j.audio_url_v1 || j.status === "complete") {
          setTrackStatus("ready");
          toast.success("🎧 Track ready — preview below");
          return;
        }
        if (j.status === "failed") {
          setTrackStatus("failed");
          toast.error("Generation failed");
          return;
        }
      } catch (e: any) {
        console.error("poll", e);
      }
      if (tries >= 75) {
        // ~5 min
        setTrackStatus("failed");
        toast.error("Generation timed out — try again");
        return;
      }
      setTimeout(poll, 4000);
    };
    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackJobId, trackStatus]);

  // Hydrate from ?job=<id> when arriving from "My Generations" so the studio
  // reopens with the same track context (audio versions, unlock state).
  useEffect(() => {
    if (!jobParam) return;
    if (trackJobId === jobParam) return;
    let cancelled = false;
    (async () => {
      try {
        const j = await getJobFn({ data: { jobId: jobParam } });
        if (cancelled) return;
        setTrackJobId(jobParam);
        if (j.audio_url_v1) setAudioV1(j.audio_url_v1);
        if (j.audio_url_v2) setAudioV2(j.audio_url_v2);
        setDownloadUnlocked(!!j.download_unlocked);
        if (j.audio_url_v1 || j.status === "complete") {
          setTrackStatus("ready");
        } else if (j.status === "failed") {
          setTrackStatus("failed");
        } else {
          setTrackStatus("generating");
        }
        // Smooth-scroll the player into view so the track is the focal point.
        requestAnimationFrame(() => {
          document.getElementById("studio-track-preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      } catch (e: any) {
        toast.error(e?.message ?? "Could not reopen this track");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobParam]);

  const onUnlockDownload = async () => {
    if (!trackJobId || unlocking || downloadUnlocked) return;
    setUnlocking(true);
    try {
      const r = await unlockFn({ data: { jobId: trackJobId } });
      if (r.audio_url_v1) setAudioV1(r.audio_url_v1);
      if (r.audio_url_v2) setAudioV2(r.audio_url_v2);
      setDownloadUnlocked(true);
      // Refresh profile balance in the header chip
      refreshAuth().catch(() => {});
      if (r.charged) {
        const prev = r.previous_balance;
        const next = r.balance;
        const desc =
          prev !== null && next !== null
            ? `Charged ${r.cost} ${COIN} · ${prev} → ${next} ${COIN}`
            : `Charged ${r.cost} ${COIN}`;
        toast.success("Track unlocked — full versions + downloads enabled", {
          description: desc,
          duration: 6000,
        });
      } else {
        toast.success("Already unlocked — no coins charged");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Unlock failed");
    } finally {
      setUnlocking(false);
      setConfirmUnlockOpen(false);
    }
  };

  const onShare = async (url: string, label: string) => {
    const shareData = { title: portal.name, text: `${portal.name} — ${selectedStyle ?? ""} (${label})`, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Track link copied — paste into your socials");
      }
    } catch {
      /* user cancelled */
    }
  };

  const onFormat = async () => {
    if (!user) return toast.error("Sign in to compose");
    if (!raw.trim()) return toast.error("Type your story first");
    setFormatting(true);
    try {
      const r = await formatFn({ data: { slug: portal.slug, raw } });
      setLyrics(r.lyrics);
      toast.success("Lyrics formatted");
    } catch (e: any) {
      toast.error(e?.message ?? "Format failed");
    } finally {
      setFormatting(false);
    }
  };

  const onGenerate = async () => {
    if (!user) return toast.error("Sign in to request a track");
    if (!lyrics.trim()) return toast.error("Format your lyrics first");
    setGenerating(true);
    try {
      const styleTags =
        selectedStyle
          ? `${portal.style ?? "studio"}, ${selectedStyle}`
          : `${portal.style ?? "studio"}, ${portal.vibe ?? "cinematic"}`;
      const r = await spawnFn({
        data: {
          prompt: lyrics,
          style_tags: styleTags,
          title: portal.name,
          make_instrumental: false,
          portal_slug: portal.slug,
        },
      });
      setSubmitted(r.job.task_id);
      toast.success("Suno V5.5 spawning your track…", {
        description: "We'll ping you when the master is ready.",
      });
      // Keep the legacy fulfillment record too
      try {
        await requestFn({ data: { slug: portal.slug, lyrics } });
      } catch {}
    } catch (e: any) {
      toast.error(e?.message ?? "Request failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ background: theme.bg, color: "#fff", minHeight: "100vh" }} className="relative flex flex-col">
      <div className="absolute inset-0 pointer-events-none" style={{ background: theme.pattern }} />
      {portal.wallpaper_url && (
        <>
          <div
            className="absolute inset-0 pointer-events-none bg-cover bg-center"
            style={{ backgroundImage: `url(${portal.wallpaper_url})`, opacity: 0.35 }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.75) 100%)" }}
          />
        </>
      )}
      <div className="relative flex-1 px-5 sm:px-8 py-12 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100">
            <ArrowLeft className="h-3.5 w-3.5" /> 0G
          </Link>
          <div className="flex items-center gap-2">
            {user && (
              <Link
                to="/my-generations"
                title="My generations"
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-[10px] font-bold uppercase tracking-[0.2em] transition hover:scale-105"
                style={{ borderColor: `${theme.accent}80`, background: `${theme.accent}10`, color: theme.accent }}
              >
                <Disc3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">History</span>
              </Link>
            )}
            <CoinBalance accent={theme.accent} />
          </div>
        </div>

        <header className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.5em]" style={{ color: theme.accent }}>{theme.label}</p>
          <h1
            className="mt-3 text-4xl sm:text-6xl font-black leading-tight"
            style={{ fontFamily: theme.font, textShadow: `0 0 50px ${theme.accent}aa` }}
          >
            <span className="mr-3" style={{ color: theme.accent }}>{theme.ornament}</span>
            {portal.name}
            <span className="ml-3" style={{ color: theme.accent }}>{theme.ornament}</span>
          </h1>
          <p className="mt-3 text-sm opacity-70">{portal.style} · {portal.language}</p>
        </header>

        <MusicHooksSection portal={portal} theme={theme} onUseHook={(text) => setRaw(text)} />

        {tracks.length > 0 && (
          <section className="mb-10">
            <p className="text-xs uppercase tracking-[0.4em] mb-4 opacity-70" style={{ color: theme.accent }}>
              ◈ Studio Catalog · Preview &amp; Purchase
            </p>
            {tracks.map((t) => (
              <TrackPlayer
                key={t.id}
                trackId={t.id}
                title={t.title}
                previewUrl={t.preview_url}
                priceCents={t.price_cents}
                owned={owned.has(t.id)}
                isVip={isVip}
                accent={theme.accent}
                secondary={theme.secondary}
                onUnlocked={refresh}
              />
            ))}
          </section>
        )}

        <section
          className="rounded-2xl border p-6 sm:p-8 mb-8"
          style={{ borderColor: `${theme.accent}55`, background: `${theme.accent}08`, boxShadow: `0 0 60px ${theme.accent}22` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Music className="h-4 w-4" style={{ color: theme.accent }} />
            <h2 className="text-sm uppercase tracking-[0.3em] font-bold" style={{ color: theme.accent }}>Compose Your Vision</h2>
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`Tell your story in any language. We'll shape it into ${portal.style} verses...`}
            rows={6}
            className="w-full bg-black/40 border rounded-md px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2"
            style={{ borderColor: `${theme.accent}40`, color: "#fff" }}
          />
          <Button
            onClick={onFormat}
            disabled={formatting}
            className="mt-4 h-11 px-6 text-xs uppercase tracking-[0.25em] font-bold border"
            style={{ background: `${theme.accent}20`, color: theme.accent, borderColor: theme.accent }}
          >
            {formatting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Crafting...</> : <><Wand2 className="h-4 w-4 mr-2" />Format for Song</>}
          </Button>

          {lyrics && (
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-60 mb-2">Suno-Ready Lyrics</p>
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed bg-black/50 border rounded-md p-4 max-h-96 overflow-auto"
                style={{ borderColor: `${theme.accent}40`, fontFamily: "ui-monospace, monospace" }}
              >{lyrics}</pre>
            </div>
          )}
        </section>

        {/* Suno V5.5 Style Vector Stack */}
        <section
          className="rounded-2xl border p-6 sm:p-8 mb-8"
          style={{ borderColor: `${theme.accent}55`, background: `${theme.accent}05` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4" style={{ color: theme.accent }} />
            <h2 className="text-sm uppercase tracking-[0.3em] font-bold" style={{ color: theme.accent }}>
              Suno V5.5 · Style Vector Stack
            </h2>
          </div>
          <p className="text-xs opacity-70 mb-3">
            Pick one style — we auto-blend it with this portal's description and Suno spits out 2 versions. Preview free for 30s, unlock the full track + downloads for 2 coins.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STYLE_PRESETS.map((preset) => {
              const active = selectedStyle === preset;
              const isLoading = trackStatus === "generating" && active;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onPickStyle(preset)}
                  disabled={trackStatus === "generating"}
                  className="h-12 px-3 text-[11px] uppercase tracking-[0.18em] font-bold border rounded-md transition disabled:opacity-50 flex items-center justify-center text-center"
                  style={{
                    background: active ? theme.accent : `${theme.accent}10`,
                    color: active ? "#000" : theme.accent,
                    borderColor: theme.accent,
                  }}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : preset}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] opacity-50 mt-2 uppercase tracking-[0.25em]">
            1 coin to generate · 2 coins to unlock full track + downloads
          </p>

          {trackStatus === "generating" && (
            <div className="mt-6 flex items-center gap-3 p-4 rounded-md border" style={{ borderColor: `${theme.accent}30`, background: "rgba(0,0,0,0.4)" }}>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.accent }} />
              <p className="text-xs uppercase tracking-[0.25em]" style={{ color: theme.accent }}>
                Generating 2 versions · ~60s
              </p>
            </div>
          )}

          {(audioV1 || audioV2) && trackStatus !== "generating" && (
            <div className="mt-6 space-y-3">
              {[
                { label: "Version A", url: audioV1 },
                { label: "Version B", url: audioV2 },
              ].filter((v) => v.url).map((v) => (
                <PreviewPlayer
                  key={v.label}
                  label={v.label}
                  url={v.url!}
                  unlocked={downloadUnlocked}
                  accent={theme.accent}
                  onShare={() => onShare(v.url!, v.label)}
                />
              ))}
              {!downloadUnlocked && (
                <Button
                  onClick={() => setConfirmUnlockOpen(true)}
                  disabled={unlocking}
                  className="w-full h-12 text-xs uppercase tracking-[0.3em] font-bold"
                  style={{ background: theme.accent, color: "#000" }}
                >
                  {unlocking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Unlocking…</> : <><Lock className="h-4 w-4 mr-2" />Unlock full track (2 coins)</>}
                </Button>
              )}
              {downloadUnlocked && (
                <p className="text-[10px] uppercase tracking-[0.3em] text-center" style={{ color: theme.accent }}>
                  ✓ Unlocked · download or share each version
                </p>
              )}
            </div>
          )}
        </section>

        <Button
          onClick={onGenerate}
          disabled={generating || !lyrics || owned.size === 0}
          className="w-full h-20 text-base sm:text-lg uppercase tracking-[0.4em] font-black border-2 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.secondary})`,
            color: "#000",
            borderColor: theme.accent,
            boxShadow: `0 0 80px ${theme.accent}99, inset 0 0 30px rgba(255,255,255,0.2)`,
            opacity: owned.size === 0 ? 0.45 : 1,
          }}
        >
          {generating ? (
            <><Loader2 className="h-6 w-6 mr-3 animate-spin" />Sending to Studio...</>
          ) : owned.size === 0 ? (
            <><Lock className="h-6 w-6 mr-3" />Unlock a Track to Request HQ Master</>
          ) : (
            <><Disc3 className="h-6 w-6 mr-3" />Request HQ Master — Spend 50 🪙</>
          )}
        </Button>

        <p className="mt-3 text-center text-[10px] uppercase tracking-[0.35em] opacity-60 flex items-center justify-center gap-2">
          <BadgeCheck className="h-3 w-3" style={{ color: theme.accent }} />
          Licensed by <OgWordmark suffix="-PORTAL" /> · {owned.size > 0 ? "HQ Master fulfillment unlocked" : "Preview & Purchase to unlock HQ"}
        </p>

        {submitted && (
          <div
            className="mt-6 p-5 rounded-xl border text-center"
            style={{ borderColor: `${theme.accent}55`, background: `${theme.accent}10` }}
          >
            <p className="text-sm font-semibold" style={{ color: theme.accent }}>
              Requesting High-Quality 0G-Studio Generation...
            </p>
            <p className="text-xs opacity-60 mt-2">Request ID: {submitted.slice(0, 8)}</p>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 pb-8">
        <SwearChatPanel
          enabled={!!portal.swear_chat_enabled}
          table="portals"
          id={portal.id}
          slug={portal.slug}
          accent={theme.accent}
        />
        {portal.swear_chat_enabled && (
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-center opacity-70" style={{ color: theme.accent }}>
            Unhinged mode ON · lyrics + production stack will spit raw, explicit, no-filter heat
          </p>
        )}
      </div>

      <footer className="relative border-t py-6 text-center text-xs uppercase tracking-[0.4em] opacity-60" style={{ borderColor: `${theme.accent}33` }}>
        <Link to="/" className="hover:opacity-100">
          <span style={{ color: theme.accent }}>▣</span> Powered by <OgWordmark suffix="-PORTAL" />
        </Link>
      </footer>

      <AlertDialog open={confirmUnlockOpen} onOpenChange={setConfirmUnlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock full track?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Removes the 30s preview cap on both versions and enables MP3 download + share.
                </p>
                <div className="rounded-md border p-3 bg-muted/40 space-y-1 tabular-nums">
                  <div className="flex justify-between"><span>Cost</span><span className="font-bold">2 {COIN}</span></div>
                  <div className="flex justify-between"><span>Your balance</span><span className="font-bold">{(profile?.credits ?? 0).toLocaleString()} {COIN}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span>After unlock</span>
                    <span className="font-bold" style={{ color: (profile?.credits ?? 0) >= 2 ? theme.accent : "#ef4444" }}>
                      {Math.max(0, (profile?.credits ?? 0) - 2).toLocaleString()} {COIN}
                    </span>
                  </div>
                </div>
                {(profile?.credits ?? 0) < 2 && (
                  <p className="text-xs text-red-500">
                    Not enough coins. <Link to="/wallet" className="underline">Top up</Link>.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); onUnlockDownload(); }}
              disabled={unlocking || (profile?.credits ?? 0) < 2}
              style={{ background: theme.accent, color: "#000" }}
            >
              {unlocking ? "Unlocking…" : `Confirm · 2 ${COIN}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MusicHooksSection({
  portal,
  theme,
  onUseHook,
}: {
  portal: MusicPortal;
  theme: { accent: string; secondary: string; font: string; ornament: string };
  onUseHook: (text: string) => void;
}) {
  const hookSource = Array.isArray(portal.music_hooks) && portal.music_hooks.length > 0
    ? portal.music_hooks
    : portal.jokes;
  const hooks: string[] = Array.isArray(hookSource)
    ? (hookSource as unknown[]).filter(
        (h): h is string => typeof h === "string" && h.trim().length > 0,
      )
    : [];
  if (hooks.length === 0) return null;

  const useHook = (text: string) => {
    onUseHook(text);
    toast.success("Hook loaded into composer");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: document.body.scrollHeight * 0.35, behavior: "smooth" });
    }
  };

  return (
    <section
      className="mb-10 rounded-2xl border p-6 sm:p-8"
      style={{
        borderColor: `${theme.accent}55`,
        background: `${theme.accent}08`,
        boxShadow: `0 0 60px ${theme.accent}22`,
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: theme.accent }} />
          <h2 className="text-sm uppercase tracking-[0.3em] font-bold" style={{ color: theme.accent }}>
            Generated Hooks · Seed Vault
          </h2>
        </div>
        <span
          className="text-[10px] uppercase tracking-[0.3em] px-2 py-1 rounded-full border"
          style={{ borderColor: `${theme.accent}55`, color: theme.accent }}
        >
          {hooks.length} hook{hooks.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-xs opacity-70 mb-4">
        AI-spawned hooks tuned for <span className="opacity-100">{portal.style ?? "this portal"}</span>.
        Tap one to drop it into the composer below.
      </p>
      <ol className="space-y-3">
        {hooks.map((h, i) => (
          <li
            key={i}
            className="rounded-xl border p-4 flex gap-3 items-start"
            style={{ borderColor: `${theme.accent}30`, background: "rgba(0,0,0,0.45)" }}
          >
            <span
              className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full font-black text-[11px] tabular-nums"
              style={{ background: theme.accent, color: "#000", boxShadow: `0 0 18px -4px ${theme.accent}` }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p
              className="flex-1 text-sm leading-relaxed whitespace-pre-line"
              style={{ fontFamily: theme.font }}
            >
              {h}
            </p>
            <button
              type="button"
              onClick={() => useHook(h)}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] font-bold hover:opacity-80"
              style={{ borderColor: `${theme.accent}66`, color: theme.accent, background: `${theme.accent}10` }}
              aria-label={`Use hook ${i + 1} as composer starter`}
            >
              <Wand2 className="h-3 w-3" /> Use
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PreviewPlayer({
  label,
  url,
  unlocked,
  accent,
  onShare,
}: {
  label: string;
  url: string;
  unlocked: boolean;
  accent: string;
  onShare: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Cap free preview at 30s
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (!unlocked && el.currentTime >= 30) {
        el.pause();
        el.currentTime = 0;
        setPlaying(false);
        toast.info("30s preview · unlock for the full track");
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [unlocked]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play(); else el.pause();
  };

  const filename = `${label.replace(/\s+/g, "_").toLowerCase()}.mp3`;

  return (
    <div className="rounded-md border p-3 space-y-2" style={{ borderColor: `${accent}30`, background: "rgba(0,0,0,0.4)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="h-9 w-9 rounded-full inline-flex items-center justify-center"
            style={{ background: accent, color: "#000" }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <p className="text-[11px] uppercase tracking-[0.3em] font-bold" style={{ color: accent }}>
            {label}
            {!unlocked && <span className="ml-2 opacity-60">· 30s preview</span>}
          </p>
        </div>
        {unlocked && (
          <div className="flex items-center gap-1">
            <a
              href={url}
              download={filename}
              target="_blank"
              rel="noreferrer"
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border"
              style={{ borderColor: `${accent}66`, color: accent, background: `${accent}10` }}
              aria-label="Download MP3"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={onShare}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border"
              style={{ borderColor: `${accent}66`, color: accent, background: `${accent}10` }}
              aria-label="Share"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <audio ref={audioRef} src={url} preload="metadata" controls className="w-full" />
      {unlocked && <SocialShareRow url={url} label={label} accent={accent} />}
    </div>
  );
}

function SocialShareRow({ url, label, accent }: { url: string; label: string; accent: string }) {
  const text = `🎧 ${label} — fresh track on OG Streamz`;
  const enc = encodeURIComponent;
  const links = [
    { name: "X / Twitter", Icon: Twitter, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { name: "Facebook",    Icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}` },
    { name: "WhatsApp",    Icon: MessageCircle, href: `https://wa.me/?text=${enc(text + " " + url)}` },
    { name: "Telegram",    Icon: Send, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — paste anywhere");
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div
      className="flex items-center gap-1.5 flex-wrap pt-2 border-t"
      style={{ borderColor: `${accent}22` }}
      role="group"
      aria-label={`Share ${label} to social`}
    >
      <span className="text-[9px] uppercase tracking-[0.3em] mr-1" style={{ color: accent, opacity: 0.7 }}>
        Share
      </span>
      {links.map(({ name, Icon, href }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share ${label} on ${name}`}
          title={`Share on ${name}`}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border transition hover:scale-110"
          style={{ borderColor: `${accent}55`, color: accent, background: `${accent}10` }}
        >
          <Icon className="h-3.5 w-3.5" />
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label} link`}
        title="Copy link"
        className="h-7 w-7 inline-flex items-center justify-center rounded-md border transition hover:scale-110"
        style={{ borderColor: `${accent}55`, color: accent, background: `${accent}10` }}
      >
        <Link2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}