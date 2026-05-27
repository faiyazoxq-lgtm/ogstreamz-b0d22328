import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/analytics")({
  beforeLoad: exactPathRedirect("/boss/analytics", () => ({
    to: "/boss/ops",
    hash: "analytics",
  })),
  component: () => null,
});
