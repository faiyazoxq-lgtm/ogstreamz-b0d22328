import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "../hooks/use-auth";
import { UserPlus, LogIn, Gift, ShieldCheck, Sparkles, Music2, Smile, Wrench, Zap, Lock, ArrowRight, Coins } from "lucide-react";

// Fallback used while the live value loads or if the request fails.
// Live value comes from public.app_settings (key: signup_bonus_credits).
export const SIGNUP_BONUS_CREDITS = 2;
import { useEffect, type ReactNode } from "react";
import { useSignupBonus } from "@/hooks/use-signup-bonus";

const PUBLIC_PATHS = ["/auth", "/forgot-password", "/reset-password"];

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, hasStoredSession } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/api/");

  // Remember the destination so the auth page can return us here after sign-in.
  // Skip the homepage (default landing) and auth pages.
  useEffect(() => {
    if (user || isPublic) return;
    if (pathname === "/" || pathname === "") return;
    try {
      const qs = typeof window !== "undefined" ? window.location.search : "";
      const target = pathname + (qs || "");
      sessionStorage.setItem("post_auth_redirect", target);
    } catch { /* ignore */ }
  }, [user, isPublic, pathname]);

  if (isPublic || user) return <>{children}</>;

  // Avoid the unauthenticated flash while session restores
  if (loading || hasStoredSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-xs uppercase tracking-[0.3em] text-white/40">Loading…</div>
      </div>
    );
  }

  return <PromoLanding />;
}

function PromoLanding() {
  const bonus = useSignupBonus();
  return (
    <main className="relative mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#001a33] via-[#000914] to-black p-6 sm:p-10 shadow-[0_30px_120px_-20px_rgba(0,170,255,0.45)]">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#00aaff]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00aaff]/40 bg-[#00aaff]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#7fd5ff]">
            <Lock className="h-3 w-3" />
            Members only
          </div>

          <h1 className="mt-5 text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-[1.05]">
            Sign up to unlock
            <span className="block bg-gradient-to-r from-[#7fd5ff] via-white to-[#ff77ff] bg-clip-text text-transparent">
              0G-PORTAL
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-sm sm:text-base text-white/75 leading-relaxed">
            MusicHUB, JokesHUB, ToolHUB and the full neon platform are reserved for members.
            Free account, no card, instant access.
          </p>

          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-300/15 via-amber-300/5 to-transparent px-4 py-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/50 bg-amber-300/15 shadow-[0_0_30px_-6px_rgba(252,211,77,0.7)]">
              <Coins className="h-6 w-6 text-amber-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-amber-200 tracking-tight">
                  +{SIGNUP_BONUS_CREDITS}
                </span>
                <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-amber-200/80">
                  credits waiting
                </span>
              </div>
              <p className="mt-0.5 text-[11px] sm:text-xs text-white/65">
                Land in your wallet the moment your account is confirmed.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00aaff] to-[#0077cc] px-6 py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_10px_40px_-10px_rgba(0,170,255,0.8)] transition hover:scale-[1.02]"
            >
              <UserPlus className="h-4 w-4" />
              Create free account
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-white/90 backdrop-blur transition hover:bg-white/10"
            >
              <LogIn className="h-4 w-4" />
              Members sign in
            </Link>
          </div>

          <ul className="mt-7 grid gap-2.5 sm:grid-cols-3">
            {[
              { icon: Gift, text: `${SIGNUP_BONUS_CREDITS} free credits on signup` },
              { icon: ShieldCheck, text: "No card required" },
              { icon: Sparkles, text: "All portals unlocked" },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[11px] uppercase tracking-[0.2em] font-bold text-white/85"
              >
                <Icon className="h-3.5 w-3.5 text-[#7fd5ff]" />
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3">
              What's behind the wall
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                { icon: Music2, label: "MusicHUB", tint: "#00aaff" },
                { icon: Smile, label: "JokesHUB", tint: "#ffcc00" },
                { icon: Wrench, label: "ToolHUB", tint: "#ff77ff" },
              ].map(({ icon: Icon, label, tint }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: tint }} />
                    <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/90">
                      {label}
                    </span>
                  </div>
                  <Lock className="h-3.5 w-3.5 text-white/40" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-7 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/55">
            <Zap className="h-3.5 w-3.5 text-[#7fd5ff]" />
            Sign up takes 20 seconds. Cancel anytime.
          </div>
        </div>
      </div>
    </main>
  );
}