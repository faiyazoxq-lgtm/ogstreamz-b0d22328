import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/portals")({
  beforeLoad: exactPathRedirect("/boss/portals", () => ({
    to: "/boss/content",
    hash: "portals",
  })),
  component: () => null,
});
