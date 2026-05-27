import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/todo")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/todo") {
      throw redirect({ to: "/boss/ops", hash: "todo", replace: true });
    }
  },
  component: () => null,
});
