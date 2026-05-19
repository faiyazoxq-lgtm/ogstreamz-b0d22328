import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCw, Radio, Loader2 } from "lucide-react";
import { FlameBackdrop } from "@/components/FlameBackdrop";
import { useEffect, useMemo, useRef, useState } from "react";
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
    "My mum's chappal travels faster than light. Einstein never met a Punjabi mother.",
    "Indian parents don't say 'I love you' — they say 'have you eaten?' and slap an extra roti on your plate.",
    "Arranged marriage is just LinkedIn for aunties.",
    "Dad slammed the brakes so hard his arm did the seatbelt's job. NASA studies that reflex.",
    "My CV says 'fluent in English.' My WhatsApp says 'kindly do the needful.'",
    "Indian weddings: 3 days, 400 cousins, one DJ playing the same Honey Singh song on loop.",
    "Mum's recipe: 'add masala till your soul tells you to stop.' My soul has trust issues.",
    "Engineer, doctor, or family disappointment. Pick one before age 22.",
    "Indian Wi-Fi password is the same as the dowry — long, complicated, and nobody talks about it.",
    "Grew up on Complan and emotional blackmail. Still 5'6.",
    "My horoscope said I'd find love. Mum said I'd find a Patel from Ahmedabad. Mum won.",
    "Aunties don't gossip — they 'share concerns at full volume in the kitchen.'",
    "Indian standard time means the wedding starts at 7pm sharp, food at 11.",
    "Got 96% in boards. Sharma ji ka beta got 97. I am still grounded.",
    "Dad's toolbox: one screwdriver, one Old Monk bottle, twenty years of jugaad.",
    "My mother negotiates vegetable prices like she's defusing a nuclear bomb. And wins.",
    "Cricket isn't a sport in India. It's a hostage situation involving the TV remote.",
    "Indian parents see 'mental health' the same way they see decaf coffee — fake American problem.",
    "Bought a designer shirt. Mum cut the tag off and used the box to store dal.",
    "Every Indian household has one drawer of plastic bags and one bag of plastic drawers.",
    "I told dad I want to be a YouTuber. He's still laughing. It's been six years.",
    "Indian dads don't have hobbies. They have opinions on the news at 9pm.",
    "My grandmother survived partition, polio, and three power cuts during her favourite serial. Don't test her.",
    "Auntie asked my salary at the wedding before she asked my name. Networking, basically.",
    "Indian girls aren't allowed to date. They're allowed to be 'introduced to a nice boy from a good family.'",
    "Dosa is just a crepe that went to engineering college.",
    "Family WhatsApp group: 400 good-mornings, one funeral notice, zero replies to my promotion.",
    "My mum doesn't trust microwaves, GPS, or me.",
    "Got drunk once at 19. Dad still brings it up at every Diwali. It's our love language.",
    "Indian uncle at the airport carries 47kg of pickle and one shirt.",
    "Yoga in the West is a $90 class. In India it's grandma stretching before yelling at the milkman.",
    "Indian moms can spot one strand of hair in a plate of rice from across the room. CIA, hire them.",
    "We don't celebrate Valentine's. We celebrate Karva Chauth — a fasting Olympics with bonus emotional damage.",
    "My cousin became a doctor. I became a vibe. Guess who's not invited to Diwali.",
    "Dad fixes everything with Fevicol, duct tape, and threats.",
    "Indian parents say 'log kya kahenge' before every decision. The logs have never paid my rent.",
    "Punjabi weddings have more outfit changes than a Beyoncé tour.",
    "Asked dad for pocket money. He gave me a lecture on inflation and walked off.",
    "Auntie's compliment: 'You've become healthy.' Translation: 'You're fat.'",
    "Indian summer is just God doing tandoori.",
    "My mum's tea is so strong it ghosted three boyfriends for me.",
    "Holi is the only day a desi dad lets you touch him without flinching.",
    "Indian household rule: the Amul butter tub never contains butter. It contains last week's sabzi.",
    "South Indian filter coffee will resurrect you and then judge you for sleeping in.",
    "Marwari uncle haggled at his own son's wedding caterer. Saved ₹400. Legend.",
    "Indian astrology said I'd be rich. My bank account said 'kindly try again later.'",
    "Mum doesn't believe in therapy. She believes in 'go drink water and stop drama.'",
    "Every Bengali household is one fish curry away from a Nobel Prize argument.",
    "Indian dads buy one pair of Bata sandals in 1987 and wear them to their own funeral.",
    "I told my mum I'm in a relationship. She asked his caste before his name.",
  ],
};

function fisherYates<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool(styles: string[]): string[] {
  const pools = styles.filter((s) => JOKE_LIBRARY[s]).flatMap((s) => JOKE_LIBRARY[s]);
  const all = pools.length > 0 ? pools : Object.values(JOKE_LIBRARY).flat();
  // De-dupe in case the same joke appears across pools.
  return Array.from(new Set(all));
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

  const [joke, setJoke] = useState<string>("");
  const [headline, setHeadline] = useState<string>("");
  const [source, setSource] = useState<string | undefined>(undefined);
  const [count, setCount] = useState(live ? 0 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shuffle queue — fresh, randomised order every time the portal opens.
  // We never repeat a joke until the whole pool has been served, then
  // reshuffle and start again.
  const queueRef = useRef<string[]>([]);

  const drawJoke = (): string => {
    if (queueRef.current.length === 0) {
      queueRef.current = fisherYates(buildPool(styleIds));
    }
    const next = queueRef.current.shift() ?? "";
    return custom ? `${next} (${custom} edition)` : next;
  };

  // Seed the queue + first joke on mount (or when style mix changes).
  // Runs every portal open since this component remounts per visit.
  useEffect(() => {
    queueRef.current = fisherYates(buildPool(styleIds));
    if (!live) {
      setJoke(drawJoke());
      setCount(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles, custom, live]);

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
    setJoke(drawJoke());
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
