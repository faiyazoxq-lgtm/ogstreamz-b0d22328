import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/")({
  beforeLoad: () => {
    throw redirect({ to: "/boss/overview" });
  },
});
