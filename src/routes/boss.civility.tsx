import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Crown, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { CivilityPanel } from "@/components/boss/CivilityPanel";

export const Route = createFileRoute("/boss/civility")({
  head: () => ({
    meta: [
      { title: "Civility Controls · Boss Portal" },
      { name: "description", content: "Toggle the Guttermouth swear-chat per portal, battle, or custom hub — and set the global default." },
    ],
  }),
  component: CivilityPage,
});

function CivilityPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const isBoss = profile?.rank === "boss" || isAdmin;

  useEffect(() => {
    if (loading) return;
    if (!user || !isBoss) navigate({ to: "/" });
  }, [loading, user, isBoss, navigate]);

  if (loading || !isBoss) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-6 pb-28 md:pb-12 space-y-6">
      <Link to="/boss" className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Boss portal
      </Link>
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6" style={{ color: "#ffd166" }} />
        <h1 className="syndicate-header text-2xl md:text-3xl text-white/95">Civility Controls</h1>
      </div>
      <CivilityPanel />
    </main>
  );
}