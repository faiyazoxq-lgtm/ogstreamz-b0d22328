import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/civility")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/civility") {
      throw redirect({ to: "/boss/content", hash: "civility", replace: true });
    }
  },
  component: () => null,
});
