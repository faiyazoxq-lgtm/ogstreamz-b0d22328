import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bot, X } from "lucide-react";
import { SiteGuideSwearChat } from "@/components/SiteGuideSwearChat";

/**
 * Global floating "OG Bot" assistant. Pinned to the bottom-right corner on
 * every page (except auth/onboarding screens). Tapping the icon opens a
 * compact chat panel that wraps SiteGuideSwearChat so members can ask the
 * site guide anything from anywhere.
 */
export function OgBotFloatingWidget() {
  const [open, setOpen] = useState(false);

  // Close the panel automatically when the user navigates so it never
  // covers fresh content after a route change.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Floating launcher — sits above the mobile BottomDock (bottom-20 on
          small screens) and tucks neatly into the corner on desktop. */}
      <button
        type="button"
        aria-label={open ? "Close OG Bot" : "Open OG Bot assistant"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 bottom-20 md:bottom-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[oklch(0.72_0.22_245/0.6)] bg-black/70 text-white shadow-[0_0_30px_-6px_oklch(0.72_0.22_245/0.7)] backdrop-blur-xl transition hover:scale-105 hover:border-[oklch(0.72_0.22_245)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <Bot className="h-6 w-6" style={{ color: "var(--neon-blue-bright, #6cb6ff)" }} />
        )}
        <span className="sr-only">OG Bot assistant</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="OG Bot assistant"
          className="fixed z-50 right-3 left-3 bottom-36 md:left-auto md:right-6 md:bottom-24 md:w-[380px] max-h-[70vh] overflow-hidden rounded-2xl shadow-2xl"
        >
          <SiteGuideSwearChat />
        </div>
      )}
    </>
  );
}