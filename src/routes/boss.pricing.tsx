import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/pricing")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/pricing") {
      throw redirect({ to: "/boss/content", hash: "pricing", replace: true });
    }
  },
  component: () => null,
});
