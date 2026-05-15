import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Music, Download, Lock, Loader2, Share2, Disc3, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CoinBalance } from "@/components/CoinBalance";
import {
  listMyGenerations,
  unlockPortalTrackDownload,
} from "@/lib/music-portals.functions";
import { COIN } from "@/lib/coins";

export const Route = createFileRoute("/my-generations")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { redirect: "/my-generations" } as any });
    }
  },
  head: () => ({
    meta: [
      { title: "My Generations · 0G-Studio" },
      { name: "description", content: "Revisit your generated tracks and reopen unlocked downloads." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyGenerationsPage,
});

type Job = Awaited<ReturnType<typeof listMyGenerations>>["jobs"][number];

function MyGenerationsPage() {
  const { refresh: refreshAuth } = useAuth();
  const listFn = useServerFn(listMyGenerations);
  const unlockFn = useServerFn(unlockPortalTrackDownload);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await listFn({});
      setJobs(r.jobs);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUnlock = async (jobId: string) => {
    if (!confirm("Unlock full track + downloads for 2 coins?")) return;
    setUnlockingId(jobId);
    try {
      const r = await unlockFn({ data: { jobId } });
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                download_unlocked: true,
                audio_url_v1: r.audio_url_v1 ?? j.audio_url_v1,
                audio_url_v2: r.audio_url_v2 ?? j.audio_url_v2,
              }
            : j,
        ),
      );
      refreshAuth().catch(() => {});
      if (r.charged) {
        toast.success("Unlocked", {
          description:
            r.previous_balance !== null && r.balance !== null
              ? `Charged ${r.cost} ${COIN} · ${r.previous_balance} → ${r.balance} ${COIN}`
              : `Charged ${r.cost} ${COIN}`,
        });
      } else {
        toast.success("Already unlocked");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Unlock failed");
    } finally {
      setUnlockingId(null);
    }
  };

  const onShare = async (url: string, label: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: label, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Track link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 0G
          </Link>
          <CoinBalance />
        </div>

        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.5em] text-primary">◈ History</p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black flex items-center gap-3">
            <Disc3 className="h-8 w-8 text-primary" /> My Generations
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your recent Suno tracks. Re-open unlocked downloads anytime — unlock anything still locked for 2 {COIN}.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />
            Loading your tracks…
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Music className="h-10 w-10 mx-auto opacity-40 mb-3" />
            <p className="text-sm text-muted-foreground">
              You haven't generated any tracks yet. Pick a portal and hit a style preset to start.
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="outline">Browse portals</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((j) => {
              const versions = [
                { label: "Version A", url: j.audio_url_v1 },
                { label: "Version B", url: j.audio_url_v2 },
              ].filter((v) => v.url);
              const hasAudio = versions.length > 0;
              const isReady = j.status === "completed" || hasAudio;
              return (
                <li
                  key={j.id}
                  className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row gap-4"
                >
                  <div
                    className="h-20 w-20 sm:h-24 sm:w-24 rounded-lg bg-muted flex-shrink-0 bg-cover bg-center flex items-center justify-center"
                    style={j.image_url ? { backgroundImage: `url(${j.image_url})` } : undefined}
                  >
                    {!j.image_url && <Music className="h-7 w-7 opacity-40" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground truncate">
                          {j.portal ? (
                            <Link
                              to="/m/$slug"
                              params={{ slug: j.portal.slug }}
                              className="hover:text-primary"
                            >
                              {j.portal.name}
                            </Link>
                          ) : (
                            "Studio"
                          )}
                          {j.style_tags && <> · {j.style_tags}</>}
                        </p>
                        <p className="mt-1 font-bold truncate">
                          {j.title || j.prompt?.slice(0, 80) || "Untitled track"}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                          {new Date(j.created_at).toLocaleString()} ·{" "}
                          <span
                            className={
                              j.status === "completed"
                                ? "text-primary"
                                : j.status === "failed"
                                ? "text-destructive"
                                : ""
                            }
                          >
                            {j.status}
                          </span>
                          {j.download_unlocked && <> · ✓ unlocked</>}
                        </p>
                      </div>
                      {j.portal && (
                        <Link
                          to="/m/$slug"
                          params={{ slug: j.portal.slug }}
                          search={{ job: j.id } as never}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] font-bold"
                          title="Reopen this track in the MusicHUB studio"
                        >
                          <ExternalLink className="h-3 w-3" /> Open in Studio
                        </Link>
                      )}
                    </div>

                    {isReady && hasAudio && (
                      <div className="mt-3 space-y-2">
                        {versions.map((v) => (
                          <div
                            key={v.label}
                            className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
                          >
                            <span className="text-[10px] uppercase tracking-[0.25em] w-16">
                              {v.label}
                            </span>
                            <audio
                              controls
                              src={v.url!}
                              className="flex-1 min-w-[180px] h-8"
                            />
                            {j.download_unlocked && (
                              <>
                                <a
                                  href={v.url!}
                                  download={`${(j.title || "track").replace(/[^a-z0-9]+/gi, "-")}-${v.label.toLowerCase().replace(" ", "-")}.mp3`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Button size="sm" variant="outline" className="h-8">
                                    <Download className="h-3.5 w-3.5 mr-1" /> MP3
                                  </Button>
                                </a>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8"
                                  onClick={() => onShare(v.url!, j.title || "track")}
                                >
                                  <Share2 className="h-3.5 w-3.5 mr-1" /> Share
                                </Button>
                              </>
                            )}
                          </div>
                        ))}

                        {!j.download_unlocked && (
                          <Button
                            onClick={() => onUnlock(j.id)}
                            disabled={unlockingId === j.id}
                            size="sm"
                            className="w-full sm:w-auto"
                          >
                            {unlockingId === j.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                Unlocking…
                              </>
                            ) : (
                              <>
                                <Lock className="h-3.5 w-3.5 mr-2" />
                                Unlock downloads · 2 {COIN}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}

                    {!isReady && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        {j.status === "failed"
                          ? "Generation failed — your coin was refunded if applicable."
                          : "Still generating… open the portal to watch progress live."}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}