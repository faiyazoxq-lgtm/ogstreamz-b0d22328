import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/portal-usage")({
  beforeLoad: () => {
    throw redirect({ to: "/boss/content", hash: "usage", replace: true });
  },
  component: () => null,
});
