import { redirect, type ParsedLocation } from "@tanstack/react-router";

/**
 * Shared backward-compatibility helper for legacy /boss/* routes that now
 * live as tabs inside one of the canonical mega-dashboards
 * (/boss/overview, /boss/members, /boss/content, /boss/ops,
 * /boss/infrastructure).
 *
 * Only redirects when the URL is an EXACT match for `exactPath` so that
 * nested child routes (e.g. /boss/hubs/new, /boss/hubs/$id/edit) keep
 * working through the parent's <Outlet />.
 *
 * Use as the `beforeLoad` of a legacy route:
 *
 *   beforeLoad: exactPathRedirect(
 *     "/boss/civility",
 *     () => ({ to: "/boss/content", hash: "civility" })
 *   ),
 *
 * The options factory is a thunk so TanStack Router's typed `to` literal
 * is preserved at each call site.
 */
export function exactPathRedirect<
  T extends () => Parameters<typeof redirect>[0],
>(exactPath: string, buildOptions: T) {
  return ({ location }: { location: ParsedLocation }) => {
    if (location.pathname.replace(/\/$/, "") === exactPath) {
      throw redirect({ ...buildOptions(), replace: true });
    }
  };
}