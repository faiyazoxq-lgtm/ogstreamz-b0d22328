import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /boss/power is now an alias for /boss/overview. The canonical power
 * controls (payment mode, coin freeze, swear default), pending queue
 * summary and reverse-purchases tool all live on /boss/overview as
 * shared panels. Preserve old deep-links by mapping any incoming hash
 * straight through to the same anchors on the overview page.
 */
export const Route = createFileRoute("/boss/power")({
  beforeLoad: ({ location }) => {
    const hash = location.hash && location.hash.length > 0 ? location.hash : "power";
    throw redirect({ to: "/boss/overview", hash, replace: true });
  },
  component: () => null,
});