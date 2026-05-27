import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/syndicate-overlord")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/syndicate-overlord") {
      throw redirect({ to: "/boss/ops", hash: "overlord", replace: true });
    }
  },
  component: () => null,
});
