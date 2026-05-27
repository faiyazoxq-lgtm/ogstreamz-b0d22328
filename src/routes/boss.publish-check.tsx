import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/publish-check")({
  beforeLoad: exactPathRedirect("/boss/publish-check", () => ({
    to: "/boss/ops",
    hash: "publish",
  })),
  component: () => null,
});
