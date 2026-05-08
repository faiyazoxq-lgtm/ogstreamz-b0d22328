import { createFileRoute } from "@tanstack/react-router";
import { Play, Pause, ShoppingBag, Heart, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VaultLockedDialog } from "@/components/VaultLockedDialog";
import { useAuth } from "@/hooks/use-auth";

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
  { title: "Midnight Dhikr", artist: "Aamir Sufi", duration: "3:42", vip: false },
  { title: "Crown of Light", artist: "Yusuf Vox", duration: "4:18", vip: true },
  { title: "Madinah Drive", artist: "Bilal Wave", duration: "2:55", vip: false },
  { title: "Golden Hour", artist: "Khalid Tone", duration: "5:01", vip: true },
  { title: "Velvet Sajdah", artist: "Rumi Beats", duration: "3:27", vip: false },
  { title: "Onyx Sky", artist: "Ali Frequency", duration: "4:44", vip: true },
];

function MusicPage() {
  const [playing, setPlaying] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const isVip = profile?.status === "vip";
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
            className={
              "group relative rounded-xl border bg-card p-5 transition-colors " +
              (t.vip
                ? "border-[oklch(0.72_0.22_245/0.5)] hover:border-[oklch(0.72_0.22_245/0.9)]"
                : "border-border hover:border-gold")
            }
          >
            {t.vip && (
              <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold bg-[oklch(0.72_0.22_245/0.15)] border border-[oklch(0.72_0.22_245/0.5)] text-white">
                <Lock className="h-3 w-3" style={{ color: "var(--neon-blue-bright)" }} />
                VIP
              </div>
            )}
            <div className="aspect-square rounded-lg bg-gradient-to-br from-secondary via-background to-secondary mb-4 flex items-center justify-center">
              <button
                onClick={() => {
                  if (t.vip && !isVip) setLocked(t.title);
                }}
                className="h-14 w-14 rounded-full bg-background/60 backdrop-blur border border-border text-gold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={t.vip && !isVip ? "Locked" : "Play"}
              >
                {t.vip && !isVip ? (
                  <Lock className="h-6 w-6" style={{ color: "var(--neon-blue-bright)" }} />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" />
                )}
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

      <VaultLockedDialog
        open={!!locked}
        onOpenChange={(o) => !o && setLocked(null)}
        itemName={locked ?? ""}
        isAuthenticated={!!user}
      />
    </main>
  );
}