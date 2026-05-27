import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/portal-usage")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/portal-usage") {
      throw redirect({ to: "/boss/content", hash: "usage", replace: true });
    }
  },
  component: () => null,
});
