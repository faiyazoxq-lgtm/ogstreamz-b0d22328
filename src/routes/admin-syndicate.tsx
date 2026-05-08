import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-syndicate")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});