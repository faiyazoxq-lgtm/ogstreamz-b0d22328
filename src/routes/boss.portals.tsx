import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/portals")({
  beforeLoad: () => {
    throw redirect({ to: "/boss/content", hash: "portals", replace: true });
  },
  component: () => null,
});
