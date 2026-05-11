import { Sparkles } from "lucide-react";

/**
 * Fixed bottom-right floating watermark — replaces the previous
 * "Edit with Lovable" badge slot with our own brand mark.
 * Tappable on touch, keyboard-focusable, dims on hover so it never
 * fights for attention with page content.
 */
export function ZeroGWatermark() {
  return (
    <a
      href="/"
      aria-label="0G-BRAIN — powered by 0G"
      className="fixed bottom-3 right-3 z-[80] inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/80 backdrop-blur-md shadow-[0_4px_18px_-6px_rgba(0,0,0,0.6)] opacity-70 hover:opacity-100 hover:border-primary/70 transition-opacity outline-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-4 sm:right-4"
    >
      <Sparkles className="h-3 w-3 text-primary" aria-hidden />
      <span className="text-primary">0G-BRAIN</span>
    </a>
  );
}