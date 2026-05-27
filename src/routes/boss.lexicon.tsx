import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/lexicon")({
  beforeLoad: exactPathRedirect("/boss/lexicon", () => ({
    to: "/boss/content",
    hash: "lexicon",
  })),
  component: () => null,
});
