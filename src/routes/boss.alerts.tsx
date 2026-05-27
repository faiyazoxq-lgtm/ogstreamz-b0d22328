import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/alerts")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/alerts") {
      throw redirect({ to: "/boss/ops", hash: "alerts", replace: true });
    }
  },
  component: () => null,
});
