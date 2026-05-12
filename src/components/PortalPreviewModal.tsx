import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles, Eye, Check, UserCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Lightweight "Preview portal" modal shown after a successful coin purchase
 * but before the user navigates into the portal. Gives them a final glance
 * at what they unlocked and lets them stay on the hub if they want.
 */
export function PortalPreviewModal({
  open,
  onOpenChange,
  href,
  portal,
  kind,
  accent = "oklch(0.85 0.18 88)",
  creator,
  highlights,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  href: string;
  portal: { name: string; niche?: string | null; vibe?: string | null };
  kind: string;
  accent?: string;
  /** Creator / provider attribution. Defaults to "OG Streamz". */
  creator?: string | null;
  /** Optional 3 bullet highlights. Auto-derived from kind when omitted. */
  highlights?: string[];
}) {
  const providerName = (creator && creator.trim()) || "OG Streamz";
  const bullets = (highlights && highlights.length ? highlights : defaultHighlights(kind)).slice(0, 3);
  const description =
    (portal.vibe && portal.vibe.trim()) ||
    `A ${kind} portal tuned for ${portal.niche || "your audience"} — ready the moment you step inside.`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm border-2 sm:max-w-sm w-[min(100vw-1.5rem,24rem)]"
        style={{ borderColor: `${accent}66` }}
      >
        <DialogHeader>
          <div
            className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: `${accent}22`, color: accent }}
          >
            <Eye className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-[Montserrat] font-black tracking-tight">
            Preview portal
          </DialogTitle>
          <DialogDescription className="text-center">
            Quick look before you jump in.
          </DialogDescription>
        </DialogHeader>

        <section
          aria-label="Portal preview"
          className="rounded-xl border bg-black/30 px-4 py-3 space-y-3"
          style={{ borderColor: `${accent}33` }}
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
            <Sparkles className="h-3 w-3" style={{ color: accent }} />
            <span className="truncate">{portal.niche || kind}</span>
          </div>
          <div>
            <h3
              className="font-[Montserrat] font-black text-lg leading-tight tracking-tight"
              style={{ color: accent }}
            >
              {portal.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <UserCircle2 className="h-3 w-3" style={{ color: accent }} />
              <span className="truncate">
                by <span className="font-semibold text-foreground/90">{providerName}</span>
              </span>
            </div>
          </div>
          <p className="text-xs text-foreground/85 leading-relaxed line-clamp-4">
            {description}
          </p>
          {bullets.length > 0 && (
            <ul className="space-y-1.5 pt-1" aria-label="Highlights">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-foreground/85 leading-snug">
                  <span
                    className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${accent}22`, color: accent }}
                  >
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <span className="line-clamp-2">{b}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-1 flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.25em] font-bold"
              style={{ borderColor: `${accent}55`, color: accent }}
            >
              {kind}
            </span>
            <span className="text-[10px] text-emerald-300/90 font-bold uppercase tracking-[0.2em]">
              Unlocked
            </span>
          </div>
        </section>

        <DialogFooter className="gap-2 sm:gap-2">
          <div className="flex w-full flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 min-h-12"
            >
              Stay here
            </Button>
            <Button
              asChild
              type="button"
              className="portal-button-motion portal-button-motion--lg flex-1 inline-flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] text-xs text-black border-2"
              style={{ background: accent, borderColor: accent, boxShadow: `0 0 32px -8px ${accent}` }}
            >
              <Link to={href as any} onClick={() => onOpenChange(false)}>
                <ArrowUpRight className="h-4 w-4" /> Open portal
              </Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultHighlights(kind: string): string[] {
  const k = kind.toLowerCase();
  if (k.includes("joke")) {
    return [
      "5 freshly-generated bits in your chosen voice",
      "Regenerate any line you don't vibe with",
      "Share-ready clips for socials",
    ];
  }
  if (k.includes("music")) {
    return [
      "Mood-driven landing page for the release",
      "One-tap player + share links",
      "Auto-styled artwork & vibe copy",
    ];
  }
  if (k.includes("trade")) {
    return [
      "Live signal feed for the tracked angle",
      "Compact dashboard tuned to the niche",
      "Quick-glance levels & sentiment",
    ];
  }
  if (k.includes("connect")) {
    return [
      "ICP-tuned outbound landing page",
      "Single, focused offer + CTA",
      "Built-in lead capture",
    ];
  }
  if (k.includes("tool")) {
    return [
      "Purpose-built calculator / utility",
      "Themed for your audience",
      "Mobile-first, instant results",
    ];
  }
  return [
    "Custom-styled landing experience",
    "Tuned to your niche & vibe",
    "Ready to share immediately",
  ];
}
