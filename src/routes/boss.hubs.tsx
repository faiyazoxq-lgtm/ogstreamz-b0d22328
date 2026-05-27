import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/hubs")({
  beforeLoad: () => {
    throw redirect({ to: "/boss/content", hash: "hubs", replace: true });
  },
  component: () => null,
});
