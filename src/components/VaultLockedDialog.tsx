import { Lock, Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function VaultLockedDialog({
  open,
  onOpenChange,
  itemName,
  cost = 1,
  isAuthenticated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemName: string;
  cost?: number;
  isAuthenticated: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[oklch(0.72_0.22_245/0.5)] bg-card shadow-[0_0_80px_-10px_oklch(0.72_0.22_245/0.7)]">
        <DialogHeader className="items-center text-center">
          <div className="h-16 w-16 rounded-full bg-[oklch(0.72_0.22_245/0.15)] border border-[oklch(0.72_0.22_245/0.5)] flex items-center justify-center mb-2 animate-pulse-gold">
            <Lock className="h-7 w-7" style={{ color: "var(--neon-blue-bright)" }} />
          </div>
          <DialogTitle className="text-metallic text-2xl uppercase tracking-[0.2em]">Vault Locked</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            <span className="text-foreground font-semibold">{itemName}</span> is reserved for VIP members or costs{" "}
            <span className="text-foreground font-semibold">{cost} credit{cost !== 1 ? "s" : ""}</span> to unlock.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-3">
          {isAuthenticated ? (
            <Link
              to="/profile"
              className="btn-glass-blue inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md text-xs uppercase tracking-[0.25em] font-bold text-white"
            >
              <Crown className="h-4 w-4" /> View Vault
            </Link>
          ) : (
            <Link
              to="/auth"
              className="btn-glass-blue inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md text-xs uppercase tracking-[0.25em] font-bold text-white"
            >
              Join the Syndicate
            </Link>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="uppercase tracking-[0.25em] text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}