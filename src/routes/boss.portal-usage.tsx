import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/portal-usage")({
  beforeLoad: exactPathRedirect("/boss/portal-usage", () => ({
    to: "/boss/content",
    hash: "usage",
  })),
  component: () => null,
});
