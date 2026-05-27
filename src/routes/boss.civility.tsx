import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/civility")({
  beforeLoad: exactPathRedirect("/boss/civility", () => ({
    to: "/boss/content",
    hash: "civility",
  })),
  component: () => null,
});
