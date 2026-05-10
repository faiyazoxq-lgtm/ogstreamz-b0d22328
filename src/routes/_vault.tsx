import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { isVaultUnlocked } from "@/lib/vault-unlock";

export const Route = createFileRoute("/_vault")({
  component: VaultGuard,
});

function VaultGuard() {
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
          to: "/vault-login",
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
  }, [navigate, location.href]);

  if (!checked || !unlocked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-cyan-200/80">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Lock className="h-6 w-6" />
            <Loader2 className="absolute -right-3 -top-3 h-4 w-4 animate-spin" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em]">Verifying vault access…</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}