import { createFileRoute, notFound } from "@tanstack/react-router";
import { TAB_AREAS, type TabArea } from "@/lib/areas";
import { InboxList } from "@/components/Inbox";
import { AreaSummary } from "@/components/InboxSummary";

export const Route = createFileRoute("/$area")({
  loader: ({ params }) => {
    const found = TAB_AREAS.find((a) => a.slug === params.area);
    if (!found) throw notFound();
    return { area: found };
  },
  head: ({ loaderData }) => {
    const label = loaderData?.area.label ?? "Área";
    return {
      meta: [
        { title: `${label} — Rafael Leite` },
        { name: "description", content: `Área ${label} — conteúdo em construção.` },
        { property: "og:title", content: `${label} — Rafael Leite` },
        { property: "og:description", content: `Área ${label} — conteúdo em construção.` },
      ],
    };
  },
  component: AreaPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-2xl font-bold" style={{ color: "#111111" }}>
        Área não encontrada
      </h1>
    </div>
  ),
});

function AreaPage() {
  const { area } = Route.useLoaderData();
  const slug = area.slug as TabArea;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <h1
          className="text-4xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          {area.label}
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: "#6B7280" }}>
          Conteúdo desta área em construção.
        </p>
      </div>

      <div className="mt-6">
        <h2
          className="text-lg font-semibold"
          style={{ color: "#111111", letterSpacing: "-0.01em" }}
        >
          Caixa de Entrada · {area.label}
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
          Itens marcados com esta área. Para adicionar novos itens, use a caixa de entrada geral na página inicial.
        </p>
        <InboxList
          areaFilter={slug}
          emptyLabel={`Nenhum item marcado como ${area.label} ainda.`}
        />
      </div>
    </div>
  );
}
