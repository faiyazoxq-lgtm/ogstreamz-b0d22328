import { createFileRoute, Link } from "@tanstack/react-router";
import { Music2, Smile, Wrench, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "0G-STREAMZ — The Hub" },
      { name: "description", content: "Enter the 0G-STREAMZ universe: MusicHUB, JokesHUB, and ToolHUB." },
    ],
  }),
  component: Index,
});

const portals = [
  {
    to: "/music" as const,
    title: "MusicHUB",
    desc: "Curated nasheeds and premium tracks. Stream, vibe, own.",
    Icon: Music2,
  },
  {
    to: "/jokes" as const,
    title: "JokesHUB",
    desc: "Quick-fire wit. Tap, laugh, repeat.",
    Icon: Smile,
  },
  {
    to: "/tools" as const,
    title: "ToolHUB",
    desc: "Sharp utilities for sharper minds.",
    Icon: Wrench,
  },
];

function Index() {
  return (
    <main className="relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[radial-gradient(closest-side,oklch(0.82_0.16_88_/_0.18),transparent)]" />
      </div>

      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-20 sm:pt-32 pb-16 text-center">
        <p className="text-xs sm:text-sm tracking-[0.4em] text-gold uppercase font-semibold">
          Luxury · Street · Sound
        </p>
        <h1 className="mt-6 font-[Montserrat] font-black text-5xl sm:text-7xl md:text-8xl tracking-tight leading-[0.95]">
          Enter the <br className="sm:hidden" />
          <span className="text-gradient-gold">0G-STREAMZ</span>
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-muted-foreground text-base sm:text-lg">
          A cinematic hub built for taste. Step through a portal and pick your frequency.
        </p>
      </section>

      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-28 grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-3">
        {portals.map(({ to, title, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-10 transition-all duration-500 hover:border-gold hover:-translate-y-1 hover:shadow-[0_0_60px_-15px_oklch(0.82_0.16_88_/_0.5)]"
          >
            <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: "radial-gradient(400px circle at var(--x,50%) var(--y,0%), oklch(0.82 0.16 88 / 0.18), transparent 60%)" }}
            />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-primary-foreground transition-colors">
                <Icon className="h-6 w-6" />
              </div>
              <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-gold transition-colors" />
            </div>
            <h2 className="mt-10 font-[Montserrat] font-black text-3xl sm:text-4xl tracking-tight">
              {title}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">{desc}</p>
            <div className="mt-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] font-semibold text-gold">
              Open Portal
              <span className="h-px w-8 bg-gold group-hover:w-14 transition-all" />
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
