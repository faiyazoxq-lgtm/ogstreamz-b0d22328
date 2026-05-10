import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/power")({
  beforeLoad: async (ctx) => {
    await requireBoss(ctx);
    throw redirect({ to: "/boss/overview", hash: "power" });
  },
  component: () => null,
});
