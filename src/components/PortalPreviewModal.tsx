import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles, Eye } from "lucide-react";
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  href: string;
  portal: { name: string; niche?: string | null; vibe?: string | null };
  kind: string;
  accent?: string;
}) {
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
          className="rounded-xl border bg-black/30 px-4 py-3 space-y-2"
          style={{ borderColor: `${accent}33` }}
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
            <Sparkles className="h-3 w-3" style={{ color: accent }} />
            <span className="truncate">{portal.niche || kind}</span>
          </div>
          <h3
            className="font-[Montserrat] font-black text-lg leading-tight tracking-tight"
            style={{ color: accent }}
          >
            {portal.name}
          </h3>
          {portal.vibe && (
            <p className="text-xs text-foreground/85 leading-relaxed line-clamp-4">
              {portal.vibe}
            </p>
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
