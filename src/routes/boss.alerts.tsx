import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/alerts")({
  beforeLoad: exactPathRedirect("/boss/alerts", () => ({
    to: "/boss/ops",
    hash: "alerts",
  })),
  component: () => null,
});
