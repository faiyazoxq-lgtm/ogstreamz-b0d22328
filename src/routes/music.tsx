import { createFileRoute } from "@tanstack/react-router";
import { Play, Pause, ShoppingBag, Heart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "MusicHUB — 0G-STREAMZ" },
      { name: "description", content: "Featured nasheeds and premium tracks on 0G-STREAMZ MusicHUB." },
    ],
  }),
  component: MusicPage,
});

const tracks = [
  { title: "Midnight Dhikr", artist: "Aamir Sufi", duration: "3:42" },
  { title: "Crown of Light", artist: "Yusuf Vox", duration: "4:18" },
  { title: "Madinah Drive", artist: "Bilal Wave", duration: "2:55" },
  { title: "Golden Hour", artist: "Khalid Tone", duration: "5:01" },
  { title: "Velvet Sajdah", artist: "Rumi Beats", duration: "3:27" },
  { title: "Onyx Sky", artist: "Ali Frequency", duration: "4:44" },
];

function MusicPage() {
  const [playing, setPlaying] = useState(false);
  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <header className="mb-10">
        <p className="text-xs tracking-[0.4em] text-gold uppercase font-semibold">MusicHUB</p>
        <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-6xl tracking-tight">
          Sound, <span className="text-gradient-gold">Refined.</span>
        </h1>
      </header>

      {/* Featured */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-background p-6 sm:p-10 mb-12">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,oklch(0.82_0.16_88_/_0.25),transparent)]" />
        <div className="relative grid gap-8 md:grid-cols-[280px_1fr] items-center">
          <div className="aspect-square rounded-xl bg-gradient-to-br from-secondary to-background border border-border flex items-center justify-center animate-pulse-gold">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="h-20 w-20 rounded-full bg-gold text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
            </button>
          </div>
          <div>
            <span className="text-xs tracking-[0.3em] uppercase text-gold font-semibold">Featured Nasheed</span>
            <h2 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl tracking-tight">
              Crown of Light
            </h2>
            <p className="mt-2 text-muted-foreground">Aamir Sufi · Premium Single</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="bg-gold text-primary-foreground hover:bg-gold/90 font-semibold">
                <ShoppingBag className="h-4 w-4 mr-2" /> Buy for $2
              </Button>
              <Button variant="outline" className="border-border">
                <Heart className="h-4 w-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Track grid */}
      <h3 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-5">Latest Drops</h3>
      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tracks.map((t) => (
          <article
            key={t.title}
            className="group relative rounded-xl border border-border bg-card p-5 hover:border-gold transition-colors"
          >
            <div className="aspect-square rounded-lg bg-gradient-to-br from-secondary via-background to-secondary mb-4 flex items-center justify-center">
              <button className="h-14 w-14 rounded-full bg-background/60 backdrop-blur border border-border text-gold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="h-6 w-6 ml-0.5" />
              </button>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold tracking-tight">{t.title}</h4>
                <p className="text-sm text-muted-foreground">{t.artist}</p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{t.duration}</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}