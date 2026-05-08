import { Sparkles } from "lucide-react";

/**
 * Pinned bottom-right badge advertising the 0G-BRAIN reasoning engine.
 * Subtle, non-blocking, links to nothing — purely status / branding.
 */
export function ZeroGBadge() {
  return (
    <div
      aria-label="AI Powered by 0G-BRAIN (Gemini)"
      className="pointer-events-none fixed bottom-3 right-3 z-40 select-none"
    >
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/80 shadow-lg backdrop-blur-md">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        <Sparkles className="h-3 w-3 text-primary" />
        <span>AI Powered by <span className="text-primary">0G-BRAIN</span> · Gemini</span>
      </div>
    </div>
  );
}