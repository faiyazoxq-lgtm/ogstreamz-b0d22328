import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/publish-check")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/publish-check") {
      throw redirect({ to: "/boss/ops", hash: "publish", replace: true });
    }
  },
  component: () => null,
});
