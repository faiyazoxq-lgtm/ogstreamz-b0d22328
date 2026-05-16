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
import { AppShell } from "../components/AppShell";
import { AuthProvider } from "../hooks/use-auth";
import { Toaster } from "../components/ui/sonner";
import { PaymentTestModeBanner } from "../components/PaymentTestModeBanner";
import { GlobalMoodProvider } from "../hooks/use-global-mood";
import { LiveThinkingFeed } from "../components/LiveThinkingFeed";
import { SystemGlitchOverlay } from "../components/SystemGlitchOverlay";
import { EnforcerConsole } from "../components/EnforcerConsole";
import { SpotlightEyes } from "../components/SpotlightEyes";
import { ReducedMotionToggle } from "../components/ReducedMotionToggle";
import { AuthGate } from "../components/AuthGate";
import { VipPromoBanner } from "../components/VipPromoBanner";
import { VipReferralPromoBanner } from "../components/VipReferralPromoBanner";
import { SiteWallpaper } from "../components/SiteWallpaper";
import { CloudflareAnalytics } from "../components/CloudflareAnalytics";
import { DomainDenylistGuard } from "../components/DomainDenylistGuard";
import { SiteFooter } from "../components/SiteFooter";
import { AlignmentQAOverlay } from "../components/AlignmentQAOverlay";
import { PupilCalibrator } from "../components/PupilCalibrator";
import { HubsStrip } from "../components/HubsStrip";
import { OgBotFloatingWidget } from "../components/OgBotFloatingWidget";
import { useAuth } from "../hooks/use-auth";

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
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "0G-PORTAL — Luxury Street Hub" },
      { name: "twitter:description", content: "0G-PORTAL: MusicHUB, JokesHUB, and ToolHUB. A cinematic neon platform." },
      { property: "og:image", content: "https://ogstreamz.co.uk/brand/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "OG-PORTAL — Luxury Street Hub" },
      { name: "twitter:image", content: "https://ogstreamz.co.uk/brand/og-image.jpg" },
      { name: "twitter:image:alt", content: "OG-PORTAL — Luxury Street Hub" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Cinzel:wght@600;800;900&family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@700;800;900&family=JetBrains+Mono:wght@700;800&display=swap",
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
          <div className="relative min-h-screen text-foreground overflow-x-hidden bg-background">
            {/* Brand wallpaper — visible at the start of every page, scrolls
                away into pure black as the user moves down the page. */}
            <SiteWallpaper />
            <div className="relative z-10">
            <PaymentTestModeBanner />
            <SpotlightEyes />
            <VipPromoBanner />
            <VipReferralPromoBanner />
            <AppShell>
              <HubsStripSlot />
              <AuthGate>
                <Outlet />
              </AuthGate>
              <SiteFooter />
            </AppShell>
            <TeleportOverlay />
            <EyeGlowTuner />
            <SystemGlitchOverlay />
            {/* LiveThinkingFeed removed — was a bottom-right Boss watermark popup */}
            <EnforcerConsole />
            <HomeOnlyMotionToggle />
            <AlignmentQAOverlay />
            <PupilCalibrator />
            <OgBotFloatingWidget />
            </div>
          </div>
          <Toaster />
          <CloudflareAnalytics />
          <DomainDenylistGuard />
        </GlobalMoodProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Renders the All-Hubs strip on the home page and every hub route, in a
// fixed slot so navigating between hubs doesn't cause layout shift.
function HubsStripSlot() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, profile } = useAuth();
  const isBoss = isAdmin || profile?.rank === "boss";
  // Hubs are Boss-only — hide the strip from members and VIPs.
  if (!isBoss) return null;
  const HUB_ROUTES = new Set(["/", "/music", "/jokes", "/trade", "/connect", "/battle", "/tools"]);
  const showStrip = HUB_ROUTES.has(pathname) || pathname.startsWith("/hub/");
  if (!showStrip) return null;
  return <HubsStrip className="pt-4 pb-2" />;
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
