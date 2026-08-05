import { createFileRoute } from "@tanstack/react-router";
import { AreaIndexPage } from "./$area";

export const Route = createFileRoute("/$area/")({
  component: AreaIndexPage,
});
