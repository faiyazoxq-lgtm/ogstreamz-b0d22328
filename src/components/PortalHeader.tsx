import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { getPortalHeader, type PortalHeader as PortalHeaderRow } from "@/lib/portal-shell.functions";
import { ZeroGBadge } from "@/components/ZeroGBadge";

/**
 * Cinematic top-of-page header used by every portal page. Renders an
 * AI-generated background image (cached forever in `portal_headers` +
 * `portal-bg` storage), the portal's large name, and a one-line
 * AI-generated description below it.
 *
 *   <PortalHeader portalKey="music" name="MusicHUB" tagline="Build Your Sound" />
 */
export function PortalHeader({
  portalKey,
  name,
  tagline,
  seed,
  accent = "gold",
  className = "",
}: {
  /** Stable cache key — never changes once the portal is generated. */
  portalKey: string;
  /** Large display name (e.g. "MusicHUB"). */
  name: string;
  /** Optional tiny eyebrow text above the name. */
  tagline?: string;
  /** Optional theme/keywords that bias the first-time generation. */
  seed?: string;
  /** Color accent for the eyebrow. */
  accent?: "gold" | "blue" | "violet";
  className?: string;
}) {
  const fetchFn = useServerFn(getPortalHeader);
  const [header, setHeader] = useState<PortalHeaderRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFn({ data: { portalKey, name, seed } })
      .then((h) => {
        if (alive) setHeader(h);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "Header unavailable");
      });
    return () => {
      alive = false;
    };
  }, [portalKey, name, seed, fetchFn]);

  const accentColor =
    accent === "blue"
      ? "var(--neon-blue-bright, #6dd0ff)"
      : accent === "violet"
        ? "var(--neon-violet-bright, #c08bff)"
        : "var(--gold, #f4c869)";

  return (
    <header
      className={`relative mb-6 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-card/60 to-background/40 px-4 py-10 sm:px-8 sm:py-14 text-center ${className}`}
    >
      {/* AI-generated background */}
      {header?.bg_url ? (
        <img
          src={header.bg_url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-screen"
          draggable={false}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-pulse"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in oklab, currentColor 14%, transparent) 0%, transparent 65%)",
          }}
        />
      )}
      {/* Vignette so text always reads */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.85))",
        }}
      />

      <div className="relative">
        {tagline && (
          <p
            className="text-[10px] sm:text-xs uppercase tracking-[0.4em] font-semibold"
            style={{ color: accentColor }}
          >
            {tagline}
          </p>
        )}
        <h1 className="mt-2 font-[Montserrat] font-black text-4xl sm:text-6xl tracking-tight leading-[1.02] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.6)]">
          {name}
        </h1>
        <p
          className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)] min-h-[1.5em]"
          aria-live="polite"
        >
          {header?.description ?? (error ? error : <span className="opacity-60">Conjuring portal…</span>)}
        </p>
        <div className="mt-4 flex justify-center">
          <ZeroGBadge />
        </div>
      </div>
    </header>
  );
}

/**
 * Small fixed-style hint shown directly above each portal's Generate button.
 * Pair with `mergeStyle()` so the same sentence is auto-prepended to the
 * user's prompt before submission.
 */
export function PortalStyleLine({
  sentence,
  className = "",
}: {
  sentence: string;
  className?: string;
}) {
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-[11px] leading-snug text-muted-foreground ${className}`}
      title="This style is auto-added to your prompt when you generate."
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 mt-px text-foreground/70" aria-hidden />
      <span>
        <span className="uppercase tracking-[0.25em] text-[9px] mr-1.5 text-foreground/70">
          Style
        </span>
        {sentence}
      </span>
    </div>
  );
}

/** Auto-prepend the style sentence to a user prompt. */
export function mergeStyle(stylesSentence: string, userPrompt: string): string {
  const u = userPrompt.trim();
  if (!u) return stylesSentence;
  if (u.toLowerCase().includes(stylesSentence.toLowerCase())) return u;
  return `${stylesSentence}\n\n${u}`;
}