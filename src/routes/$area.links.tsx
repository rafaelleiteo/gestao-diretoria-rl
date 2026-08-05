import { createFileRoute } from "@tanstack/react-router";
import { LinksRapidos } from "@/components/LinksRapidos";
import { type AreaValue } from "@/lib/areas";

export const Route = createFileRoute("/$area/links")({
  component: AreaLinksPage,
});

function AreaLinksPage() {
  const { area } = Route.useParams();
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <LinksRapidos area={area as AreaValue} />
    </div>
  );
}
