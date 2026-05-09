import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Skull, RotateCcw, Share2, Swords, Music, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playBattleRound, spawnBattleSong } from "@/lib/battles.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SwearChatPanel } from "@/components/SwearChatPanel";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/b/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `BattleHUB · ${params.slug}` },
      { name: "description", content: "Play the BattleHUB game — every choice is a disaster." },
      { property: "og:title", content: `BattleHUB · ${params.slug}` },
      { property: "og:description", content: "Pick your poison. Every option ends badly." },
    ],
  }),
  component: BattlePlayPage,
});

type Battle = {
  id: string;
  slug: string;
  name: string;
  scenario: string;
  accent: string;
  emoji: string;
  tagline: string;
  language: string;
  themes: string[];
  public: boolean;
  swear_chat_enabled?: boolean;
};

type Round = {
  situation: string;
  choices: Array<{ text: string; consequence: string; badness: number }>;
};

function BattlePlayPage() {
  const { slug } = Route.useParams();
  const play = useServerFn(playBattleRound);
  const dropTrack = useServerFn(spawnBattleSong);
  const { user } = useAuth();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<Round | null>(null);
  const [roundNum, setRoundNum] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [songBusy, setSongBusy] = useState(false);
  const [song, setSong] = useState<{
    jobId: string;
    title: string;
    lyrics: string;
    snippets: string[];
    audioUrl: string | null;
    status: string;
  } | null>(null);
  const sessionId = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    supabase
      .from("battles")
      .select("id, slug, name, scenario, accent, emoji, tagline, language, themes, public, swear_chat_enabled")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        setBattle(data as Battle | null);
        setLoading(false);
      });
    supabase.rpc("increment_portal_view", { _slug: slug }).then(() => {});
    import("@/lib/track-view").then((m) => m.trackPortalView("battle", slug));
  }, [slug]);

  // Poll Suno job status until audio is ready
  useEffect(() => {
    if (!song || song.audioUrl) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase
        .from("suno_jobs")
        .select("status, audio_url")
        .eq("id", song.jobId)
        .maybeSingle();
      if (cancelled || !data) return;
      if (data.audio_url) {
        setSong((s) => (s ? { ...s, audioUrl: data.audio_url, status: data.status } : s));
        toast.success("Brutal track ready");
      } else {
        setSong((s) => (s ? { ...s, status: data.status } : s));
      }
    };
    const i = setInterval(tick, 5000);
    tick();
    return () => { cancelled = true; clearInterval(i); };
  }, [song?.jobId, song?.audioUrl]);

  const dropBrutalTrack = async () => {
    if (!user) { toast.error("Sign in to drop a track"); return; }
    if (songBusy) return;
    setSongBusy(true);
    try {
      const r = await dropTrack({ data: { slug, extra: round?.situation || "" } });
      setSong({
        jobId: r.job.id,
        title: r.title,
        lyrics: r.lyrics,
        snippets: r.snippets ?? [],
        audioUrl: null,
        status: "pending",
      });
      toast.success("Lyrics written. Suno is cooking the track…");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to drop track");
    } finally {
      setSongBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setPicked(null);
    try {
      const r = await play({ data: { slug, session_id: sessionId.current, round: 1 } });
      setRound({ situation: r.situation, choices: r.choices });
      setRoundNum(1);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load round");
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (!round || picked === null) return;
    setBusy(true);
    try {
      const prev = {
        situation: round.situation,
        pickedText: round.choices[picked].text,
        outcome: round.choices[picked].consequence,
      };
      const r = await play({
        data: { slug, session_id: sessionId.current, round: roundNum + 1, previous: prev },
      });
      setRound({ situation: r.situation, choices: r.choices });
      setRoundNum((n) => n + 1);
      setPicked(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to escalate");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12 space-y-3">
        <div className="skeleton-shimmer h-8 w-2/3" />
        <div className="skeleton-shimmer h-40 rounded-2xl" />
      </main>
    );
  }
  if (!battle) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-20 text-center">
        <Skull className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 syndicate-header text-2xl">Battle not found</h1>
        <Link to="/battle" className="text-sm text-muted-foreground underline">Back to BattleHUB</Link>
      </main>
    );
  }

  const accent = battle.accent;

  return (
    <main
      className="min-h-[80vh] py-10"
      style={{
        background: `radial-gradient(closest-side at 50% 0%, ${accent}26, transparent 60%)`,
      }}
    >
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <header className="text-center mb-8">
          <div className="text-6xl mb-3">{battle.emoji}</div>
          <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: accent }}>
            <Swords className="inline h-3.5 w-3.5 mr-2 neon-icon" /> {battle.tagline}
          </p>
          <h1 className="mt-3 syndicate-header text-4xl sm:text-5xl text-metallic">{battle.name}</h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto text-sm">{battle.scenario}</p>
          <div className="mt-3 flex justify-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.3em] terminal-mono px-2 py-1 rounded" style={{ background: `${accent}22`, color: accent }}>
              {battle.language}
            </span>
            {(battle.themes ?? []).slice(0, 5).map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/70">#{t}</span>
            ))}
          </div>
        </header>

        {!round && (
          <div className="text-center">
            <Button onClick={start} disabled={busy} className="btn-magnetic px-8 py-6 text-base" style={{ background: accent, color: "#000" }}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Skull className="h-4 w-4 mr-2" />}
              Enter the disaster
            </Button>
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}
              className="ml-3 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>
        )}

        {round && (
          <div className="glass-obsidian-strong rounded-2xl p-6 space-y-5" style={{ borderColor: accent }}>
            <div className="flex items-center justify-between">
              <span className="terminal-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Round {roundNum}</span>
              <button onClick={start} disabled={busy} className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3 w-3" /> Restart
              </button>
            </div>
            <p className="text-lg leading-snug">{round.situation}</p>

            <div className="grid gap-3">
              {round.choices.map((c, i) => {
                const isPicked = picked === i;
                const showAll = picked !== null;
                return (
                  <button
                    key={i}
                    onClick={() => !showAll && setPicked(i)}
                    disabled={showAll && !isPicked}
                    className={`btn-magnetic text-left rounded-xl p-4 border transition-all ${
                      isPicked ? "scale-[1.01]" : showAll ? "opacity-40" : ""
                    }`}
                    style={{
                      borderColor: isPicked ? accent : "rgba(255,255,255,0.12)",
                      background: isPicked ? `${accent}22` : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="terminal-mono text-xs mt-1" style={{ color: accent }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{c.text}</div>
                        {showAll && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span className="terminal-mono uppercase tracking-[0.2em]" style={{ color: accent }}>
                              {"☠".repeat(c.badness)} ·
                            </span>{" "}
                            {c.consequence}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <div className="flex justify-end">
                <Button onClick={next} disabled={busy} className="btn-magnetic" style={{ background: accent, color: "#000" }}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Next disaster →
                </Button>
              </div>
            )}
          </div>
        )}
        {battle && (
          <SwearChatPanel
            enabled={!!battle.swear_chat_enabled}
            table="battles"
            id={battle.id}
            slug={battle.slug}
            accent={battle.accent}
          />
        )}

        {/* Brutal Suno track generator */}
        {battle && (
          <section className="mt-8 glass-obsidian rounded-2xl p-5" style={{ borderColor: `${accent}55` }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] font-bold" style={{ color: accent }}>
                  <Music className="inline h-3.5 w-3.5 mr-1.5 neon-icon" /> Brutal Track
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Turn this disaster into a foul-mouthed Suno track with snippets you can share.
                </p>
              </div>
              <Button
                onClick={dropBrutalTrack}
                disabled={songBusy || !!song}
                className="btn-magnetic"
                style={{ background: accent, color: "#000" }}
              >
                {songBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Music className="h-4 w-4 mr-2" />}
                {song ? (song.audioUrl ? "Track Dropped" : "Cooking…") : "Drop The Brutal Track"}
              </Button>
            </div>

            {song && (
              <div className="mt-5 space-y-4">
                <div>
                  <h3 className="syndicate-header text-lg" style={{ color: accent }}>{song.title}</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">
                    Status: {song.status}{song.audioUrl ? "" : " · this can take 30–90 seconds"}
                  </p>
                </div>

                {song.snippets.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Snippets · tap to copy</p>
                    <div className="grid gap-2">
                      {song.snippets.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { navigator.clipboard.writeText(s); toast.success("Snippet copied"); }}
                          className="text-left text-sm rounded-lg p-3 bg-white/5 hover:bg-white/10 border transition flex items-start gap-2"
                          style={{ borderColor: `${accent}33` }}
                        >
                          <Copy className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: accent }} />
                          <span className="flex-1">{s}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {song.audioUrl ? (
                  <audio controls src={song.audioUrl} className="w-full mt-2" />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Suno is rendering the track. Audio will appear here when ready.
                  </div>
                )}

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground uppercase tracking-[0.25em] text-[10px]">View lyrics</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed bg-black/40 p-3 rounded-lg border border-white/10 max-h-80 overflow-y-auto">
                    {song.lyrics}
                  </pre>
                </details>
              </div>
            )}

            {!user && !song && (
              <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Sign in to drop a track · uses Suno credits
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}