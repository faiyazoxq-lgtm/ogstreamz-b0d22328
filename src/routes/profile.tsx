import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Crown, Coins, LogOut, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import bgFlame from "@/assets/bg-flame.png";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Vault · 0G-PORTAL" },
      { name: "description", content: "Your 0G-PORTAL membership vault." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Loading vault…</main>;
  }

  const isVip = profile?.status === "vip";

  return (
    <main className="relative min-h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img src={bgFlame} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
      </div>

      <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <header className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
            Member Vault
          </p>
          <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-5xl text-metallic">
            Welcome back
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">{profile?.email ?? user.email}</p>
        </header>

        <section className="grid sm:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8 animate-pulse-gold">
            <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em]">
              {isVip ? <Crown className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              Access Level
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-[Montserrat] font-black text-4xl sm:text-5xl text-metallic">
                {isVip ? "VIP" : "Free"}
              </span>
              {isVip && <Sparkles className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {isVip ? "All vaults unlocked. Premium frequencies active." : "Unlock VIP for premium tracks and tools."}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em]">
              <Coins className="h-4 w-4" />
              Credit Balance
            </div>
            <div className="mt-4">
              <span className="digital-display inline-block px-5 py-3 text-4xl sm:text-5xl">
                {profile?.credits ?? 0}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Spend credits to unlock single VIP items.</p>
          </div>
        </section>

        <section className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAdmin && (
            <Link
              to="/admin"
              className="btn-glass-blue inline-flex items-center gap-2 px-6 py-3 rounded-md text-xs uppercase tracking-[0.25em] font-bold text-white"
            >
              <Shield className="h-4 w-4" />
              Admin Console
            </Link>
          )}
          <Button onClick={signOut} variant="outline" className="h-11 px-6 uppercase tracking-[0.25em] text-xs font-bold">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </section>
      </div>
    </main>
  );
}