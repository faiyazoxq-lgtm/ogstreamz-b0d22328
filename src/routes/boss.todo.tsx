import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";

export const Route = createFileRoute("/boss/todo")({
  beforeLoad: exactPathRedirect("/boss/todo", () => ({
    to: "/boss/ops",
    hash: "todo",
  })),
  component: () => null,
});
