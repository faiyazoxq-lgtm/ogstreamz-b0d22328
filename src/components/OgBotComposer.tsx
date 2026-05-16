import { useState } from "react";
import { Bot, Wand2, Loader2, ArrowRight, RotateCcw, Flame, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { streamFormatLyrics, enhanceSwearLyrics } from "@/lib/music-portals.functions";

type Step = "askName" | "askBrief" | "formatting" | "review";
type Heat = "clean" | "heavy";

/**
 * OG-Bot conversational composer.
 *
 * Drives the fan through:
 *   1. "What's the song called?"   → song title input
 *   2. "Describe the lyrics."       → free-text brief + Clean / Heavy swears toggle
 *   3. Streams Suno-ready lyrics from Gemini (always clean draft).
 *   4. If "Heavy" picked → Perplexity rewrites in BRUTAL SWEARING MODE.
 *   5. Hands the finished lyrics + title back to the host via onReady.
 */
export function OgBotComposer(props: {
  slug: string;
  /** Portal-level swear flag — only used to default the toggle to "heavy". */
  portalSwearDefault?: boolean;
  /** Religious portals never offer the swear toggle. */
  religious?: boolean;
  accent: string;
  /** Called when the user accepts the finished lyrics. */
  onReady: (out: { title: string; lyrics: string }) => void;
  /** Pre-fill from a previous session (e.g. user used a hook). */
  prefillBrief?: string;
}) {
  const streamFn = useServerFn(streamFormatLyrics);
  const enhanceFn = useServerFn(enhanceSwearLyrics);

  const [step, setStep] = useState<Step>("askName");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState(props.prefillBrief ?? "");
  const [heat, setHeat] = useState<Heat>(props.religious ? "clean" : props.portalSwearDefault ? "heavy" : "clean");
  const [cleanLyrics, setCleanLyrics] = useState("");
  const [finalLyrics, setFinalLyrics] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const accent = props.accent;
  const bubble = `inline-block rounded-2xl px-3.5 py-2.5 leading-snug max-w-[85%]`;

  const reset = () => {
    setStep("askName");
    setTitle("");
    setBrief(props.prefillBrief ?? "");
    setCleanLyrics("");
    setFinalLyrics("");
  };

  const onSubmitName = () => {
    const t = title.trim();
    if (!t) return toast.error("Give the song a name first");
    setStep("askBrief");
  };

  const onSubmitBrief = async () => {
    if (!brief.trim()) return toast.error("Tell OG-Bot what the song is about");
    setStep("formatting");
    setStreaming(true);
    setCleanLyrics("");
    setFinalLyrics("");
    try {
      const stream = await streamFn({ data: { slug: props.slug, raw: brief, cleanOnly: true, songTitle: title } });
      let acc = "";
      for await (const chunk of stream as AsyncIterable<{ delta: string }>) {
        if (chunk?.delta) {
          acc += chunk.delta;
          setCleanLyrics(acc);
        }
      }
      if (!acc.trim()) throw new Error("No lyrics returned");
      setStreaming(false);

      // Step 2: Perplexity swear enhancement when "heavy".
      if (heat === "heavy" && !props.religious) {
        setEnhancing(true);
        toast.info("Adding heat… (Perplexity is editing in swears)");
        try {
          const r = await enhanceFn({ data: { slug: props.slug, lyrics: acc } });
          setFinalLyrics(r.lyrics);
          toast.success("Lyrics ready — swears injected 🔥");
        } catch (e: any) {
          toast.error(e?.message ?? "Swear enhancement failed — using clean draft");
          setFinalLyrics(acc);
        } finally {
          setEnhancing(false);
        }
      } else {
        setFinalLyrics(acc);
        toast.success("Lyrics ready");
      }
      setStep("review");
    } catch (e: any) {
      toast.error(e?.message ?? "Format failed");
      setStep("askBrief");
    } finally {
      setStreaming(false);
    }
  };

  const onAccept = () => {
    const lyrics = (finalLyrics || cleanLyrics).trim();
    if (!lyrics) return toast.error("No lyrics yet");
    props.onReady({ title: title.trim() || "Untitled", lyrics });
    toast.success("Lyrics locked in — pick a style below to generate");
  };

  const Bubble = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-start gap-2">
      <div className="h-7 w-7 shrink-0 rounded-full border flex items-center justify-center mt-0.5" style={{ borderColor: `${accent}80`, background: `${accent}15`, color: accent }}>
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className={bubble} style={{ background: `${accent}12`, border: `1px solid ${accent}40`, color: "#fff" }}>
        {children}
      </div>
    </div>
  );

  const UserBubble = ({ children }: { children: React.ReactNode }) => (
    <div className="flex justify-end">
      <div className={bubble + " text-right bg-black/40 border border-white/15 text-white/90"}>
        {children}
      </div>
    </div>
  );

  return (
    <section
      className="rounded-2xl border p-5 sm:p-6 mb-8 space-y-4"
      style={{ borderColor: `${accent}55`, background: `${accent}08`, boxShadow: `0 0 60px ${accent}22` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: accent }} />
          <h2 className="text-sm uppercase tracking-[0.3em] font-bold" style={{ color: accent }}>
            OG-Bot Songwriter
          </h2>
        </div>
        {step !== "askName" && (
          <button
            type="button"
            onClick={reset}
            className="text-[10px] uppercase tracking-[0.22em] inline-flex items-center gap-1 opacity-70 hover:opacity-100"
            title="Start over"
          >
            <RotateCcw className="h-3 w-3" /> Restart
          </button>
        )}
      </div>

      <div className="space-y-3">
        <Bubble>What's the song called?</Bubble>
        {step === "askName" ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              onKeyDown={(e) => { if (e.key === "Enter") onSubmitName(); }}
              placeholder="e.g. Midnight on the M62"
              className="flex-1 bg-black/40 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: `${accent}40`, color: "#fff" }}
            />
            <Button onClick={onSubmitName} size="sm" style={{ background: accent, color: "#000" }} className="font-bold uppercase tracking-wider text-[11px]">
              Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        ) : (
          <UserBubble>{title}</UserBubble>
        )}

        {step !== "askName" && (
          <>
            <Bubble>Tell me what this song is about — story, mood, lines you want in there.</Bubble>
            {step === "askBrief" ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={brief}
                  onChange={(e) => setBrief(e.target.value.slice(0, 4000))}
                  placeholder="A late-night drive home from a shift you hated, the city blurring past the window…"
                  rows={5}
                  className="w-full bg-black/40 border rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2"
                  style={{ borderColor: `${accent}40`, color: "#fff" }}
                />
                {!props.religious && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="uppercase tracking-[0.22em] opacity-70">Heat:</span>
                    <button
                      type="button"
                      onClick={() => setHeat("clean")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border uppercase tracking-[0.18em] font-bold"
                      style={{
                        borderColor: heat === "clean" ? accent : `${accent}55`,
                        background: heat === "clean" ? accent : "transparent",
                        color: heat === "clean" ? "#000" : accent,
                      }}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Clean
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeat("heavy")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border uppercase tracking-[0.18em] font-bold"
                      style={{
                        borderColor: heat === "heavy" ? "#ff3366" : `${accent}55`,
                        background: heat === "heavy" ? "#ff3366" : "transparent",
                        color: heat === "heavy" ? "#000" : accent,
                      }}
                    >
                      <Flame className="h-3 w-3" /> Heavy swears
                    </button>
                    <span className="opacity-60">
                      {heat === "heavy"
                        ? "Gemini drafts clean, then Perplexity injects brutal swearing."
                        : "Radio-friendly · no profanity."}
                    </span>
                  </div>
                )}
                {props.religious && (
                  <p className="text-[11px] opacity-70 italic">Devotional studio · lyrics stay reverent.</p>
                )}
                <Button
                  onClick={onSubmitBrief}
                  disabled={streaming || !brief.trim()}
                  className="h-10 px-4 text-xs uppercase tracking-[0.25em] font-bold"
                  style={{ background: accent, color: "#000" }}
                >
                  <Wand2 className="h-4 w-4 mr-2" /> Format my lyrics
                </Button>
              </div>
            ) : (
              <>
                <UserBubble>
                  <div className="whitespace-pre-wrap text-left">{brief}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em] opacity-70">
                    Heat: {heat === "heavy" ? "🔥 Heavy swears" : "✓ Clean"}
                  </div>
                </UserBubble>
              </>
            )}
          </>
        )}

        {(step === "formatting" || step === "review") && (
          <>
            <Bubble>
              {streaming
                ? "Drafting your verses…"
                : enhancing
                ? "Adding heat — Perplexity is editing in swears…"
                : "Here's your draft."}
            </Bubble>
            <div className="space-y-2">
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed bg-black/50 border rounded-md p-4 max-h-[420px] overflow-auto"
                style={{ borderColor: `${accent}40`, fontFamily: "ui-monospace, monospace", color: "#fff" }}
              >
                {finalLyrics || cleanLyrics || (streaming ? "…" : "")}
                {(streaming || enhancing) && (
                  <span className="inline-flex items-center ml-2 opacity-70">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </span>
                )}
              </pre>

              {step === "review" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={onAccept}
                    disabled={enhancing || !(finalLyrics || cleanLyrics)}
                    className="h-11 px-5 text-xs uppercase tracking-[0.25em] font-bold"
                    style={{ background: accent, color: "#000" }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Use these lyrics
                  </Button>
                  <Button
                    onClick={onSubmitBrief}
                    disabled={enhancing || streaming}
                    variant="outline"
                    className="h-11 px-4 text-xs uppercase tracking-[0.25em] font-bold border-white/30 bg-transparent text-white hover:bg-white/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-2" /> Regenerate
                  </Button>
                  <Button
                    onClick={() => setStep("askBrief")}
                    disabled={enhancing || streaming}
                    variant="ghost"
                    className="h-11 px-3 text-xs uppercase tracking-[0.25em] text-white/70 hover:text-white"
                  >
                    Edit brief
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}