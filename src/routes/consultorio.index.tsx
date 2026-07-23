import { createFileRoute } from "@tanstack/react-router";
import { InboxList } from "@/components/Inbox";
import { AreaSummary } from "@/components/InboxSummary";

export const Route = createFileRoute("/consultorio/")({
  component: ConsultorioIndex,
});

function ConsultorioIndex() {
  return (
    <div>
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <h1
          className="text-4xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          Consultório
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: "#6B7280" }}>
          Selecione uma ferramenta no menu à esquerda.
        </p>
      </div>

      <AreaSummary area="consultorio" />

      <div className="mt-6">
        <h2
          className="text-lg font-semibold"
          style={{ color: "#111111", letterSpacing: "-0.01em" }}
        >
          Caixa de Entrada · Consultório
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
          Itens marcados como Consultório.
        </p>
        <InboxList
          areaFilter="consultorio"
          emptyLabel="Nenhum item marcado como Consultório ainda."
        />
      </div>
    </div>
  );
}
