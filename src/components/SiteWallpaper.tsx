import wallpaper from "@/assets/og-streamz-wallpaper.png";

/**
 * Global brand wallpaper. Mounts at the top of every page, sized to 100vh,
 * scrolls naturally with the document so it fades into the page background
 * (solid black) as the user scrolls down. A gradient overlay accelerates the
 * fade so foreground content stays readable as it slides up over it.
 */
export function SiteWallpaper() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-screen overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-no-repeat bg-center bg-cover motion-safe:animate-[hero-pan_30s_ease-in-out_infinite_alternate]"
        style={{ backgroundImage: `url(${wallpaper})` }}
      />
      {/* Fade-to-black overlay: transparent at top, full background by the
          bottom of the first viewport so subsequent content sits on pure black. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
    </div>
  );
}