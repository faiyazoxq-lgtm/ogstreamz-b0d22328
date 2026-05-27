import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/pricing")({
  beforeLoad: exactPathRedirect("/boss/pricing", () => ({
    to: "/boss/content",
    hash: "pricing",
  })),
  component: () => null,
});
