import { createFileRoute } from "@tanstack/react-router";
import { Route as ProfileRoute } from "./profile";

export const Route = createFileRoute("/dashboard")({
  head: ProfileRoute.options.head,
  component: ProfileRoute.options.component!,
});