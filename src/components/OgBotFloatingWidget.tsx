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
  const [modalOpen, setModalOpen] = useState(false);

  // Close the panel automatically when the user navigates so it never
  // covers fresh content after a route change.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Detect any open Radix/Vaul dialog, sheet, drawer, or alert-dialog so
  // the floating widget can step out of the way (hide entirely on mobile,
  // sink behind the modal on desktop). Shadcn primitives expose
  // [data-state="open"] on their root portal nodes; vaul drawers expose
  // [vaul-drawer][data-state="open"]. A MutationObserver on <body>
  // catches every portal mount/unmount with no per-component wiring.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const SELECTOR = [
      '[role="dialog"][data-state="open"]',
      '[role="alertdialog"][data-state="open"]',
      '[vaul-drawer][data-state="open"]',
      '[data-radix-popper-content-wrapper] [data-state="open"][role="dialog"]',
    ].join(",");
    const check = () => {
      // Ignore the widget's own panel (aria-modal="false") so it doesn't
      // hide itself when opened.
      const nodes = document.querySelectorAll<HTMLElement>(SELECTOR);
      let found = false;
      nodes.forEach((n) => {
        if (n.getAttribute("aria-label") === "OG Bot assistant") return;
        found = true;
      });
      setModalOpen(found);
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => obs.disconnect();
  }, []);

  // While a modal is open, auto-collapse the chat panel and step the
  // launcher out of the user's way.
  useEffect(() => {
    if (modalOpen) setOpen(false);
  }, [modalOpen]);

  return (
    <>
      {/* Floating launcher — sits above the mobile BottomDock (bottom-20 on
          small screens) and tucks neatly into the corner on desktop. */}
      <button
        type="button"
        aria-label={open ? "Close OG Bot" : "Open OG Bot assistant"}
        aria-expanded={open}
        aria-hidden={modalOpen || undefined}
        tabIndex={modalOpen ? -1 : 0}
        onClick={() => setOpen((o) => !o)}
        className={`fixed right-4 bottom-20 md:bottom-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[oklch(0.72_0.22_245/0.6)] bg-black/70 text-white shadow-[0_0_30px_-6px_oklch(0.72_0.22_245/0.7)] backdrop-blur-xl transition hover:scale-105 hover:border-[oklch(0.72_0.22_245)] ${
          modalOpen
            ? "z-0 pointer-events-none opacity-0 scale-90"
            : "z-40 opacity-100"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <Bot className="h-6 w-6" style={{ color: "var(--neon-blue-bright, #6cb6ff)" }} />
        )}
        <span className="sr-only">OG Bot assistant</span>
      </button>

      {open && !modalOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="OG Bot assistant"
          className="fixed z-40 right-3 left-3 bottom-36 md:left-auto md:right-6 md:bottom-24 md:w-[380px] max-h-[70vh] overflow-hidden rounded-2xl shadow-2xl"
        >
          <SiteGuideSwearChat />
        </div>
      )}
    </>
  );
}