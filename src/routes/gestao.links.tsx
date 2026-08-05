import { createFileRoute } from "@tanstack/react-router";
import { LinksRapidos } from "@/components/LinksRapidos";

export const Route = createFileRoute("/gestao/links")({
  component: () => (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <LinksRapidos area="gestao" />
    </div>
  ),
});
