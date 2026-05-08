import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, RotateCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/jokes")({
  head: () => ({
    meta: [
      { title: "JokesHUB — 0G-STREAMZ" },
      { name: "description", content: "Quick-fire wit on JokesHUB." },
    ],
  }),
  component: JokesPage,
});

const jokes = [
  "I told my Wi-Fi we needed to talk. It said 'no signal'.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "Parallel lines have so much in common. Shame they'll never meet.",
  "I would tell you a construction joke, but I'm still working on it.",
  "I'm on a seafood diet. I see food and I eat it.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "I used to play piano by ear. Now I use my hands.",
  "Time flies like an arrow. Fruit flies like a banana.",
  "My dog used to chase people on a bike. I had to take it away — he had no license.",
];

function JokesPage() {
  const [i, setI] = useState(0);
  const next = () => {
    if (jokes.length <= 1) return;
    let n = i;
    while (n === i) n = Math.floor(Math.random() * jokes.length);
    setI(n);
  };
  return (
    <main className="max-w-3xl mx-auto px-5 sm:px-8 py-16 sm:py-24 min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
      <p className="text-xs tracking-[0.4em] text-gold uppercase font-semibold mb-3">JokesHUB</p>
      <h1 className="font-[Montserrat] font-black text-4xl sm:text-5xl tracking-tight text-center mb-12 text-metallic">
        Daily Punchlines
      </h1>

      <article className="relative w-full rounded-2xl border border-border bg-card p-8 sm:p-14 text-center shadow-2xl">
        <Sparkles className="absolute top-5 right-5 h-5 w-5 text-gold" />
        <p className="text-xl sm:text-3xl font-medium leading-relaxed text-foreground min-h-[6rem]">
          "{jokes[i]}"
        </p>
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Joke {i + 1} of {jokes.length}
        </p>
      </article>

      <Button
        onClick={next}
        className="mt-10 btn-glass-blue text-white font-bold uppercase tracking-[0.25em] px-10 py-6 text-base animate-pulse-gold"
      >
        <RotateCw className="h-4 w-4 mr-2" />
        Random Joke
      </Button>
    </main>
  );
}