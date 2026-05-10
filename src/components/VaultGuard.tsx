import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { isVaultUnlocked } from "@/lib/vault-unlock";
import { VaultLockButton } from "@/components/VaultLockButton";

type Props = {
  children: ReactNode;
  /** Where to send the user when locked. Defaults to `/vault-login`. */
  redirectTo?: string;
  /** Optional fallback while we're verifying / redirecting. */
  fallback?: ReactNode;
};

/**
 * Client-side guard. Renders children only when the vault portal session
 * (sessionStorage flag set by VaultLoginModal) is unlocked. Otherwise it
 * navigates to the vault login flow with a `redirect` search param so the
 * user can be returned to the original page after unlocking.
 *
 * Usage in a route component:
 *   function VipPage() {
 *     return <VaultGuard><VipContent /></VaultGuard>;
 *   }
 */
export function VaultGuard({ children, redirectTo = "/vault-login", fallback }: Props) {
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      const ok = isVaultUnlocked();
      setUnlocked(ok);
      setChecked(true);
      if (!ok) {
        navigate({
          to: redirectTo,
          search: { redirect: location.href },
          replace: true,
        } as never);
      }
    };
    evaluate();
    const onChange = () => evaluate();
    window.addEventListener("vault:unlock-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("vault:unlock-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [navigate, location.href, redirectTo]);

  if (!checked || !unlocked) {
    return (
      <>{fallback ?? (
        <div className="flex min-h-[60vh] items-center justify-center text-cyan-200/80">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Lock className="h-6 w-6" />
              <Loader2 className="absolute -right-3 -top-3 h-4 w-4 animate-spin" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em]">Verifying vault access…</p>
          </div>
        </div>
      )}</>
    );
  }

  return (
    <>
      {children}
      <VaultLockButton variant="floating" />
    </>
  );
}