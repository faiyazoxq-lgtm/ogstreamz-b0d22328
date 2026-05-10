import { Sparkles } from "lucide-react";

/**
 * Inline "Powered by 0G-BRAIN" tag. Drop it inside AI-powered surfaces
 * (MusicHUB, JokesHUB, ToolHUB, TradeHUB) — NOT as a global watermark.
 *
 *   <ZeroGBadge />                 // default inline pill
 *   <ZeroGBadge className="mt-4" />
 */
export function ZeroGBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Powered by 0G-BRAIN (Gemini)"
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/80 backdrop-blur-md ${className}`}
    >
      <Sparkles className="h-3 w-3 text-primary" />
      <span>Powered by <span className="text-primary">0G-BRAIN</span> · Gemini</span>
    </span>
  );
}