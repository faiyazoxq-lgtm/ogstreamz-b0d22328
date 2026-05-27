import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/portals")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/portals") {
      throw redirect({ to: "/boss/content", hash: "portals", replace: true });
    }
  },
  component: () => null,
});
