import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { NavBar } from "../components/NavBar";
import { AuthProvider } from "../hooks/use-auth";
import { Toaster } from "../components/ui/sonner";
import { PaymentTestModeBanner } from "../components/PaymentTestModeBanner";
import { GlobalMoodProvider } from "../hooks/use-global-mood";
import { BottomDock } from "../components/BottomDock";
import { LiveThinkingFeed } from "../components/LiveThinkingFeed";
import { SystemGlitchOverlay } from "../components/SystemGlitchOverlay";
import { EnforcerConsole } from "../components/EnforcerConsole";
import { SpotlightEyes } from "../components/SpotlightEyes";
import { ReducedMotionToggle } from "../components/ReducedMotionToggle";
import { AuthGate } from "../components/AuthGate";
import { VipPromoBanner } from "../components/VipPromoBanner";
import { FlameBackdrop } from "../components/FlameBackdrop";
import { CloudflareAnalytics } from "../components/CloudflareAnalytics";
import { DomainDenylistGuard } from "../components/DomainDenylistGuard";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "0G-PORTAL — Luxury Street Hub" },
      { name: "description", content: "0G-PORTAL: MusicHUB, JokesHUB, and ToolHUB. A cinematic neon platform." },
      { property: "og:title", content: "0G-PORTAL — Luxury Street Hub" },
      { property: "og:description", content: "0G-PORTAL: MusicHUB, JokesHUB, and ToolHUB. A cinematic neon platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "0G-PORTAL — Luxury Street Hub" },
      { name: "twitter:description", content: "0G-PORTAL: MusicHUB, JokesHUB, and ToolHUB. A cinematic neon platform." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/7V7FIf0kcJXdLEMCppSP8BpMUv72/social-images/social-1778296602159-1.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/7V7FIf0kcJXdLEMCppSP8BpMUv72/social-images/social-1778296602159-1.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@700;800;900&family=JetBrains+Mono:wght@700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GlobalMoodProvider>
          <div className="min-h-screen bg-background text-foreground">
            {/* Brand wallpaper — fixed flame backdrop behind all content */}
            <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
              <FlameBackdrop
                style={{
                  WebkitMaskImage:
                    "radial-gradient(ellipse 70% 55% at 50% 60%, transparent 0%, rgba(0,0,0,0.35) 45%, #000 80%)",
                  maskImage:
                    "radial-gradient(ellipse 70% 55% at 50% 60%, transparent 0%, rgba(0,0,0,0.35) 45%, #000 80%)",
                }}
              />
            </div>
            <div className="relative z-10">
            <PaymentTestModeBanner />
            <SpotlightEyes />
            <VipPromoBanner />
            <NavBar />
            <AuthGate>
              <Outlet />
            </AuthGate>
            <TeleportOverlay />
            <EyeGlowTuner />
            <SystemGlitchOverlay />
            <LiveThinkingFeed />
            <EnforcerConsole />
            <BottomDock />
            <ReducedMotionToggle />
            </div>
          </div>
          <Toaster />
          <CloudflareAnalytics />
          <DomainDenylistGuard />
          <ZeroGWatermark />
        </GlobalMoodProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function TeleportOverlay() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // see EyeGlowTuner below — separate component to keep state-changes scoped.
  const [show, setShow] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    setPulseKey((k) => k + 1);
    setShow(true);
    const t = setTimeout(() => setShow(false), 520);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!show) return null;
  return (
    <div
      key={pulseKey}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ animation: "tp-flash 520ms ease-out forwards" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 3px), radial-gradient(ellipse at center, rgba(0,170,255,0.35), transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      <style>{`
        @keyframes tp-flash {
          0% { opacity: 0; transform: scale(1.02); }
          25% { opacity: 1; }
          100% { opacity: 0; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * Per-hub tuning of the TrackingEye glow intensity. Sets a CSS variable on
 * the document root that TrackingEye multiplies into its `--eye-glow` value,
 * so the same component reads slightly different on each hub:
 *   MusicHUB → louder, JokesHUB → softer, ToolHUB → balanced.
 */
function EyeGlowTuner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const p = pathname || "/";
    let mult = 1;
    if (p.startsWith("/music")) mult = 1.25;
    else if (p.startsWith("/jokes")) mult = 0.8;
    else if (p.startsWith("/tools")) mult = 1.05;
    document.documentElement.style.setProperty("--eye-glow-multiplier", String(mult));
    return () => {
      document.documentElement.style.removeProperty("--eye-glow-multiplier");
    };
  }, [pathname]);
  return null;
}
