import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCw, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { STYLE_PRESETS } from "./jokes";

type Search = { styles: string; custom: string };

export const Route = createFileRoute("/jokes/portal")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    styles: typeof s.styles === "string" ? s.styles : "",
    custom: typeof s.custom === "string" ? s.custom : "",
  }),
  head: () => ({
    meta: [
      { title: "Joke Portal — JokesHUB · 0G-STREAMZ" },
      { name: "description", content: "Your personalized joke portal — punchlines tuned to your style mix." },
    ],
  }),
  component: JokePortal,
});

const JOKE_LIBRARY: Record<string, string[]> = {
  street: [
    "My playlist hits harder than my landlord's eviction notice.",
    "Y'all act like Wi-Fi is free. Out here loading memes on hope and prayer.",
    "I don't chase, I attract. Mostly mosquitoes, but still.",
    "Real ones know: the snack aisle is a personality test.",
  ],
  dark: [
    "I told my therapist about my fear of elevators. She said I need to take steps to deal with it.",
    "I have a stepladder. It's a great ladder, but I never knew my real ladder.",
    "My grandfather has the heart of a lion — and a lifetime ban from the zoo.",
    "I bought the world's worst thesaurus yesterday. Not only is it terrible, it's also terrible.",
  ],
  sarcastic: [
    "Oh, you woke up early? Want a parade?",
    "Sure, let me drop everything and solve your problem you created last Tuesday.",
    "I'd agree with you, but then we'd both be wrong.",
    "Wow, what a totally original opinion. Never heard that one before. From everyone. Ever.",
  ],
  legendary: [
    "They asked if I'm a legend. I said no — legends fade. I'm folklore.",
    "Built different. Tested in traffic. Certified by the streetlights.",
    "I don't enter rooms. The room politely rearranges itself.",
    "History books got drafts. I got footnotes in three of them.",
  ],
  gritty: [
    "My morning coffee tastes like a Tuesday I'd rather forget.",
    "Concrete raised me. Concrete don't apologize.",
    "Sleep is a luxury. The grind is unionized.",
    "I don't have bad days. I have research material.",
  ],
};

function pickFor(styles: string[], custom: string): string {
  const pools = styles.filter((s) => JOKE_LIBRARY[s]).flatMap((s) => JOKE_LIBRARY[s]);
  const all = pools.length > 0 ? pools : Object.values(JOKE_LIBRARY).flat();
  const joke = all[Math.floor(Math.random() * all.length)];
  if (custom) return joke + ` (${custom} edition)`;
  return joke;
}

function JokePortal() {
  const { styles, custom } = Route.useSearch();
  const styleIds = useMemo(
    () => styles.split(",").map((s: string) => s.trim()).filter(Boolean),
    [styles],
  );
  const labels = useMemo(() => {
    const preset = styleIds
      .map((id: string) => STYLE_PRESETS.find((p) => p.id === id)?.label)
      .filter(Boolean) as string[];
    return custom ? [...preset, custom] : preset;
  }, [styleIds, custom]);

  const [joke, setJoke] = useState<string>(() => pickFor(styleIds, custom));
  const [count, setCount] = useState(1);

  const next = () => {
    setJoke(pickFor(styleIds, custom));
    setCount((c) => c + 1);
  };

  return (
    <main className="relative min-h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[700px] w-[900px] rounded-full blur-2xl bg-[radial-gradient(closest-side,oklch(0.72_0.22_245_/_0.45),transparent)] animate-pulse-gold" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.55_0.24_255_/_0.35),transparent)]" />
        <div className="absolute bottom-10 right-1/4 h-[350px] w-[350px] rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.85_0.18_235_/_0.25),transparent)]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <Link
          to="/jokes"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Command Center
        </Link>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[oklch(0.72_0.22_245/0.4)] bg-[oklch(0.72_0.22_245/0.08)]">
            <Radio className="h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white">
              Live Mix
            </span>
          </div>
          <h1 className="mt-5 font-[Montserrat] font-black text-3xl sm:text-5xl tracking-tight text-metallic">
            Your Joke Portal
          </h1>
          {labels.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {labels.map((l) => (
                <span
                  key={l}
                  className="px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold text-white border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.15)]"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>

        <article className="relative mt-12 rounded-2xl border border-[oklch(0.72_0.22_245/0.45)] bg-card p-8 sm:p-14 text-center animate-pulse-gold">
          <p className="text-xl sm:text-3xl font-medium leading-relaxed text-foreground min-h-[8rem]">
            "{joke}"
          </p>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Punchline #{count}
          </p>
        </article>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={next}
            className="btn-glass-blue text-white font-bold uppercase tracking-[0.25em] px-10 py-6 text-base"
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Next Joke
          </Button>
          <Link
            to="/jokes"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-xs uppercase tracking-[0.25em] font-bold text-muted-foreground hover:text-white border border-border hover:border-[oklch(0.72_0.22_245/0.5)] transition-all"
          >
            Remix Styles
          </Link>
        </div>
      </div>
    </main>
  );
}
