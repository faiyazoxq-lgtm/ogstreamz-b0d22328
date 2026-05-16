import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/use-auth";
import { LogIn, Gift, ShieldCheck, Sparkles, Music2, Smile, Wrench, Zap, Lock, ArrowRight, Coins } from "lucide-react";

// Fallback used while the live value loads or if the request fails.
// Live value comes from public.app_settings (key: signup_bonus_credits).
export const SIGNUP_BONUS_CREDITS = 2;
import { useEffect, type ReactNode } from "react";
import { useSignupBonus } from "@/hooks/use-signup-bonus";

// Routes a non-signed-in visitor is allowed to see. Everything else
// bounces to /welcome so the marketing/landing screen is the single
// entry point for unauthenticated traffic.
const PUBLIC_PATHS = [
  "/welcome",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/sitemap",
  "/sitemap.xml",
  "/robots.txt",
];

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, hasStoredSession } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/api/");

  // Remember the destination so the auth page can return us here after sign-in.
  // Skip auth/public pages — we want to return the user to whatever route
  // they were on (including "/") when they clicked Sign in.
  useEffect(() => {
    if (user || isPublic) return;
    if (!pathname) return;
    try {
      const qs = typeof window !== "undefined" ? window.location.search : "";
      const target = pathname + (qs || "");
      // Defense-in-depth: never persist a public path as the post-auth
      // redirect target. If we did, /auth could redirect back to /auth on
      // sign-in and trigger a silent loop.
      const targetPath = target.split("?")[0];
      const isPublicTarget =
        PUBLIC_PATHS.some((p) => targetPath === p || targetPath.startsWith(p + "/")) ||
        targetPath.startsWith("/api/");
      if (isPublicTarget) return;
      sessionStorage.setItem("post_auth_redirect", target);
    } catch { /* ignore */ }
  }, [user, isPublic, pathname]);

  // Once we've confirmed the visitor isn't signed in (and isn't mid-restore),
  // send them to the public /welcome screen instead of rendering protected
  // content inline. The post_auth_redirect above will return them here
  // after sign-in.
  useEffect(() => {
    if (user || isPublic) return;
    if (loading || hasStoredSession) return;
    navigate({ to: "/welcome", replace: true });
  }, [user, isPublic, loading, hasStoredSession, navigate]);

  if (isPublic || user) return <>{children}</>;

  // Loading state covers both "session restoring" and "redirect in flight".
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-xs uppercase tracking-[0.3em] text-white/40">Loading…</div>
    </div>
  );
}

function PromoLanding() {
  const bonus = useSignupBonus();
  return (
    <main className="relative mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#001a33]/35 via-[#000914]/30 to-black/40 backdrop-blur-md p-6 sm:p-10 shadow-[0_30px_120px_-20px_rgba(0,170,255,0.45)]">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#00aaff]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative">
          <h2
            className="text-center font-black uppercase tracking-[0.18em] leading-[0.95] bg-gradient-to-b from-white via-[#bfe6ff] to-[#3aa0ff] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,170,255,0.55)]"
            style={{ fontSize: "clamp(2.25rem, 7vw, 4.5rem)" }}
          >
            OG STREAMZ
          </h2>

          <div className="mt-5 mx-auto inline-flex items-center gap-2 rounded-full border border-[#00aaff]/40 bg-[#00aaff]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#7fd5ff]">
            <Lock className="h-3 w-3" />
            Members only
          </div>

          <h1 className="mt-4 text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-[1.05]">
            Sign up to unlock
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
                  +{bonus}
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

          <div className="mt-7">
            <Link
              to="/auth"
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00aaff] to-[#0077cc] px-6 py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_10px_40px_-10px_rgba(0,170,255,0.8)] transition hover:scale-[1.02]"
            >
              <LogIn className="h-4 w-4" />
              Sign in
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          <ul className="mt-7 grid gap-2.5 sm:grid-cols-3">
            {[
              { icon: Gift, text: `${bonus} free credits on signup` },
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