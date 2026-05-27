import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/portal-costs")({
  beforeLoad: () => {
    throw redirect({ to: "/boss/content", hash: "coin-costs", replace: true });
  },
  component: () => null,
});
