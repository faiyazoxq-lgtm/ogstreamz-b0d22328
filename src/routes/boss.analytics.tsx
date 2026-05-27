import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/analytics")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/analytics") {
      throw redirect({ to: "/boss/ops", hash: "analytics", replace: true });
    }
  },
  component: () => null,
});
