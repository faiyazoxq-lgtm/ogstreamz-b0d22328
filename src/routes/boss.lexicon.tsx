import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/boss/lexicon")({
  beforeLoad: () => {
    throw redirect({ to: "/boss/content", hash: "lexicon", replace: true });
  },
  component: () => null,
});
