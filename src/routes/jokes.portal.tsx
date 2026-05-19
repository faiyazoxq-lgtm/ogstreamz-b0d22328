import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCw, Radio, Loader2 } from "lucide-react";
import { FlameBackdrop } from "@/components/FlameBackdrop";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { STYLE_PRESETS } from "./jokes";
import { generateLiveJoke } from "@/lib/live-joke.functions";
import { requireBossHub } from "@/lib/route-guards";

type Search = { styles: string; custom: string; live: 0 | 1 };

export const Route = createFileRoute("/jokes/portal")({
  beforeLoad: requireBossHub,
  validateSearch: (s: Record<string, unknown>): Search => ({
    styles: typeof s.styles === "string" ? s.styles : "",
    custom: typeof s.custom === "string" ? s.custom : "",
    live: s.live === 1 || s.live === "1" ? 1 : 0,
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
  indian: [
    "My uncle didn't get into IIT so now he's just an uncle.",
    "Indian parents don't say I love you, they say 'did you eat?' — then bill you for the rice.",
    "Arranged marriage is Tinder, but your mum swipes and your dowry pays the subscription.",
    "I tried therapy. My mum cried louder than me and somehow I owed her ₹40,000.",
    "Indian dad GPS: 'go straight, beta — slap, you missed the turn.'",
    "We don't have cheat days, we have weddings. Seven of them. All in May.",
    "My cousin's a doctor, my other cousin's an engineer, and I'm the family WhatsApp group's group photo.",
    "Indian weddings: 800 guests, 4 of them invited, 2 of them know the bride.",
    "Call centre rule one — your name is Kevin, your village is Ohio, and your kidney is for sale.",
    "I told my mum I'm gay. She said fine, just marry a nice Gujarati boy who's a doctor.",
    "Cricket isn't a sport in India, it's a hostage situation with ad breaks.",
    "Indian dating bio: '5'6, fair, slim, MBA, virgin, mum included.'",
    "Why hire a personal trainer when your dad's chappal does cardio for free.",
    "Bollywood plot: boy meets girl, dad meets boy, boy meets hospital, intermission, samosa.",
    "My nani's blessing comes with 14 conditions and a marriage proposal you didn't ask for.",
    "The only thing thicker than my mum's curry is her guilt trip.",
    "Indian Wi-Fi password is your full name, your dad's full name, and your caste — all lowercase.",
    "We didn't have a piggy bank — we had a Horlicks jar full of ₹10 notes and generational trauma.",
    "I joined the gym. Mum said 'good, now you'll get a fair wife.' I joined to lift, not to breed.",
    "Auntie saw me single at 28 and started planning my funeral in case the shame killed me first.",
    "Indian airport reunion: one hug, four taunts, a suitcase of Maggi smuggled past customs.",
    "Punjabi wedding DJ has two settings — bhangra and louder bhangra.",
    "South Indian filter coffee will outlive your marriage and judge it on the way out.",
    "Mum's WhatsApp DP changes more than my career. Both are pictures of flowers I can't afford.",
    "Indian Standard Time: card says 7pm, baraat at 11, food at 1, regret at 3, divorce at 40.",
    "Brown dad's love language is silence, sandals, and the electricity bill in your name.",
    "Sharma ji's son got 99%, a Tesla, and a wife. I got compared to him at three separate funerals.",
    "We don't gatekeep recipes — we just refuse to measure anything so you fail and come back hungrier.",
    "Indian horror movie: the daughter brings home a black boyfriend who eats with his left hand.",
    "Don't tell an Indian mum you're tired. She raised four kids on one fan and a god complex.",
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
  const { styles, custom, live } = Route.useSearch();
  const liveFn = useServerFn(generateLiveJoke);
  const { session } = useAuth();
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

  const [joke, setJoke] = useState<string>(() => (live ? "" : pickFor(styleIds, custom)));
  const [headline, setHeadline] = useState<string>("");
  const [source, setSource] = useState<string | undefined>(undefined);
  const [count, setCount] = useState(live ? 0 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLive = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!session) {
        setError("Sign in to use Live Roast.");
        return;
      }
      const res = await liveFn({ data: { styles: styleIds, custom } });
      if (res.error) {
        if (res.error === "insufficient") {
          setError("Out of 🪙. Redirecting to Store…");
          setTimeout(() => { window.location.href = "/store?reason=empty"; }, 900);
        } else {
          setError(res.error);
        }
      } else {
        setJoke(res.joke);
        setHeadline(res.headline);
        setSource(res.source);
        setCount((c) => c + 1);
      }
    } catch (e) {
      setError("Live Roast signal lost. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (live) {
      void fetchLive();
      return;
    }
    setJoke(pickFor(styleIds, custom));
    setCount((c) => c + 1);
  };

  // Auto-fetch first live joke on mount
  useMemo(() => {
    if (live && count === 0 && !loading) void fetchLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <FlameBackdrop className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
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
          Return to Portal
        </Link>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[oklch(0.72_0.22_245/0.4)] bg-[oklch(0.72_0.22_245/0.08)]">
            {live ? (
              <>
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="absolute inset-0 rounded-full bg-[var(--neon-blue-bright)] animate-ping opacity-75" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--neon-blue-bright)] shadow-[0_0_10px_var(--neon-blue-bright)]" />
                </span>
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--neon-blue-bright)]">
                  LIVE ROAST · Real-Time News
                </span>
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white">Live Mix</span>
              </>
            )}
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
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[8rem] gap-3">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--neon-blue-bright)" }} />
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Scanning the wire…
              </p>
            </div>
          ) : error ? (
            <p className="text-base sm:text-lg leading-relaxed text-destructive min-h-[8rem]">{error}</p>
          ) : (
            <>
              {live && headline && (
                <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Re: {headline}
                </p>
              )}
              <p className="text-xl sm:text-3xl font-medium leading-relaxed text-foreground min-h-[8rem]">
                {joke ? `"${joke}"` : ""}
              </p>
              <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {live ? "Live Drop" : "Punchline"} #{count}
              </p>
              {live && source && (
                <a href={source} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-[var(--neon-blue-bright)]">
                  Source ↗
                </a>
              )}
            </>
          )}
        </article>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={next}
            disabled={loading}
            className="btn-glass-blue text-white font-bold uppercase tracking-[0.25em] px-10 py-6 text-base"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4 mr-2" />
            )}
            {live ? "Next Roast" : "Next Joke"}
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
