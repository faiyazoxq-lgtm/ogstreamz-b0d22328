import { Link } from "@tanstack/react-router";
import { OgWordmark } from "@/components/OgWordmark";

/**
 * Logged-out welcome / hard-sell screen.
 *
 * Mobile-first broadcast aesthetic: animated OG mark dead-center, single
 * one-line pitch, primary "Sign Up Free" CTA in neon-blue, secondary log-in
 * link, micro social-proof strip, and four corner brackets to read like a
 * pirate-broadcast feed. Wallpaper shows through — no card chrome.
 */
export function WelcomeBroadcast({
  signupCount = "482,000+",
}: {
  signupCount?: string;
}) {
  return (
    <section
      aria-label="Welcome to 0G-STREAMZ"
      className="relative z-10 mx-auto flex min-h-[88vh] w-full max-w-[480px] flex-col items-center justify-between px-6 pt-10 pb-12 text-center"
    >
      {/* Status header — broadcast frequency line */}
      <div className="flex w-full items-center opacity-50">
        <div className="h-px flex-1 bg-white/20" />
        <span
          className="px-3 text-[9px] font-bold uppercase tracking-[0.4em] whitespace-nowrap text-white/80"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
        >
          Connection Established // 245.02.OG
        </span>
        <div className="h-px flex-1 bg-white/20" />
      </div>

      {/* Hero — animated OG mark + pitch */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative mb-8">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full opacity-30 blur-3xl"
            style={{ background: "oklch(0.72 0.22 245)" }}
          />
          <h1 className="text-7xl sm:text-8xl leading-none">
            <OgWordmark suffix="-STREAMZ" />
          </h1>
        </div>

        <p
          className="max-w-[280px] text-base sm:text-lg font-light uppercase leading-tight tracking-wide text-white/90"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}
        >
          The global{" "}
          <span className="font-bold" style={{ color: "var(--gold, #f4c869)" }}>
            underground
          </span>{" "}
          broadcast is now live.
        </p>
      </div>

      {/* Action block */}
      <div className="mt-auto flex w-full flex-col gap-4">
        <Link
          to="/auth"
          className="w-full py-5 text-lg font-black uppercase tracking-[0.25em] text-black transition-transform active:scale-[0.97]"
          style={{
            backgroundColor: "oklch(0.72 0.22 245)",
            boxShadow: "0 0 60px oklch(0.72 0.22 245 / 0.35)",
          }}
        >
          Sign Up Free
        </Link>

        <div className="w-full py-2 text-center text-xs font-bold uppercase tracking-[0.25em] text-white/70">
          <span className="opacity-60">Already a Legend?</span>{" "}
          <Link
            to="/auth"
            search={{ mode: "login" } as never}
            className="ml-1 inline-block underline underline-offset-4 decoration-1 transition-colors hover:text-white"
            style={{ color: "var(--gold, #f4c869)" }}
          >
            Log In
          </Link>
        </div>

        {/* Micro social proof */}
        <div className="mt-4 flex flex-col items-center gap-2.5">
          <div className="flex -space-x-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black bg-neutral-800 text-[8px] font-bold text-white/80">JD</div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black bg-neutral-700 text-[8px] font-bold text-white/80">RL</div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black bg-neutral-600 text-[8px] font-bold text-white/80">MT</div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black text-[8px] font-bold text-white/60">+9k</div>
          </div>
          <p
            className="text-[9px] font-medium uppercase tracking-[0.25em] text-white/55"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
          >
            Joined by <span className="text-white/90">{signupCount}</span> street elites
          </p>
        </div>
      </div>

      {/* Broadcast frame corners */}
      <span aria-hidden className="pointer-events-none absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-white/20" />
      <span aria-hidden className="pointer-events-none absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-white/20" />
      <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-white/20" />
      <span aria-hidden className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-white/20" />
    </section>
  );
}

export default WelcomeBroadcast;