import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/portal-costs")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/portal-costs") {
      throw redirect({ to: "/boss/content", hash: "coin-costs", replace: true });
    }
  },
  component: () => null,
});
