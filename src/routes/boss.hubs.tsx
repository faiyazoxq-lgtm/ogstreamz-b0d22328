import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/hubs")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/hubs") {
      throw redirect({ to: "/boss/content", hash: "hubs", replace: true });
    }
  },
  component: () => <Outlet />,
});
