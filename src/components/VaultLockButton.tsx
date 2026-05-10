import { Lock } from "lucide-react";
import { toast } from "sonner";
import { clearVaultUnlock } from "@/lib/vault-unlock";

type Props = {
  /** Visual variant. `floating` pins to the bottom-right; `inline` is a normal button. */
  variant?: "floating" | "inline";
  className?: string;
  label?: string;
};

/**
 * Locks the vault: clears the sessionStorage unlock flag and fires
 * `vault:unlock-changed`, which `VaultGuard` listens to and uses to
 * redirect the user back to `/vault-login`.
 */
export function VaultLockButton({ variant = "inline", className = "", label = "Lock vault" }: Props) {
  const onLock = () => {
    clearVaultUnlock();
    toast.success("Vault locked", { description: "Re-enter the key to unlock again." });
  };

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={onLock}
        aria-label={label}
        title={label}
        className={[
          "fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-full",
          "border border-cyan-300/50 bg-black/70 backdrop-blur px-3 py-2",
          "text-[10px] uppercase tracking-[0.25em] font-bold text-cyan-100",
          "hover:bg-cyan-400/10 shadow-[0_0_25px_-5px_rgba(56,189,248,0.6)]",
          className,
        ].join(" ")}
      >
        <Lock className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onLock}
      aria-label={label}
      className={[
        "inline-flex items-center gap-1.5 rounded-md border border-cyan-300/40",
        "bg-black/40 hover:bg-cyan-400/10 px-3 py-2",
        "text-[10px] uppercase tracking-[0.25em] font-bold text-cyan-100",
        className,
      ].join(" ")}
    >
      <Lock className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export default VaultLockButton;
