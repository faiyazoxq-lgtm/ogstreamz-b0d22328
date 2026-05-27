import { createFileRoute, Outlet } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/hubs")({
  beforeLoad: exactPathRedirect("/boss/hubs", () => ({
    to: "/boss/content",
    hash: "hubs",
  })),
  component: () => <Outlet />,
});
