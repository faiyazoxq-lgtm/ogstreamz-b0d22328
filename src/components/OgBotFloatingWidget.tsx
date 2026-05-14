import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { SiteGuideSwearChat } from "@/components/SiteGuideSwearChat";
import ogBotAvatar from "@/assets/og-streamz-wallpaper.png";

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

  // On auth/login flows the form lives in the lower half of the screen on
  // mobile, so the default bottom-right launcher and panel can sit on top
  // of email/password inputs and the submit button. Detect those routes
  // and pin the widget to the top-right (small) instead so it never
  // covers a critical form control.
  const AUTH_PREFIXES = [
    "/auth",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/vault-login",
  ];
  const isAuthRoute = AUTH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

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
        className={`group fixed inline-flex items-center justify-center rounded-full border-2 border-[oklch(0.72_0.22_245/0.7)] bg-black/60 text-white shadow-[0_0_40px_-8px_oklch(0.72_0.22_245/0.9)] backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-[oklch(0.72_0.22_245)] hover:shadow-[0_0_55px_-6px_oklch(0.72_0.22_245)] ${
          isAuthRoute
            ? "right-3 top-3 md:right-6 md:top-6 h-11 w-11"
            : "right-4 bottom-20 md:bottom-6 h-16 w-16"
        } ${
          modalOpen
            ? "z-0 pointer-events-none opacity-0 scale-90"
            : "z-40 opacity-100"
        }`}
        style={isAuthRoute ? undefined : { paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {open ? (
          <X className={isAuthRoute ? "h-4 w-4" : "h-5 w-5"} />
        ) : (
          <>
            <img
              src={ogBotAvatar}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full rounded-full object-cover"
            />
            {/* Subtle inner ring + gradient sheen */}
            <span className="absolute inset-0 rounded-full ring-1 ring-white/15" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/40 via-transparent to-white/10" />
            {/* Live status pulse dot */}
            <span
              className={`absolute ${isAuthRoute ? "right-0 top-0 h-2.5 w-2.5" : "right-0.5 top-0.5 h-3 w-3"} rounded-full bg-emerald-400 ring-2 ring-black animate-pulse`}
              aria-hidden="true"
            />
          </>
        )}
        <span className="sr-only">OG Bot assistant</span>
      </button>

      {open && !modalOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="OG Bot assistant"
          className={`fixed z-40 overflow-hidden rounded-2xl shadow-2xl ${
            isAuthRoute
              ? // Anchor to the top-right under the launcher on auth flows
                // and cap the height so login inputs below stay visible
                // and tappable on small screens.
                "right-3 left-3 top-16 md:left-auto md:right-6 md:top-20 md:w-[380px] max-h-[55vh]"
              : "right-3 left-3 bottom-36 md:left-auto md:right-6 md:bottom-24 md:w-[380px] max-h-[70vh]"
          }`}
        >
          <SiteGuideSwearChat />
        </div>
      )}
    </>
  );
}