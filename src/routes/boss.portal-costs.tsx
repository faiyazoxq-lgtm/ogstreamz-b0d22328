import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/portal-costs")({
  beforeLoad: exactPathRedirect("/boss/portal-costs", () => ({
    to: "/boss/content",
    hash: "coin-costs",
  })),
  component: () => null,
});
