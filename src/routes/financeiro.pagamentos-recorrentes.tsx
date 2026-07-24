import { createFileRoute } from "@tanstack/react-router";
import { PagamentosRecorrentes } from "@/components/PagamentosRecorrentes";

export const Route = createFileRoute("/financeiro/pagamentos-recorrentes")({
  head: () => ({
    meta: [
      { title: "Pagamentos Recorrentes — Financeiro — Rafael Leite" },
      { name: "description", content: "Grade mensal de impresso/pago para pagamentos recorrentes." },
      { property: "og:title", content: "Pagamentos Recorrentes — Financeiro" },
      { property: "og:description", content: "Grade mensal de impresso/pago para pagamentos recorrentes." },
    ],
  }),
  component: PagamentosRecorrentesPage,
});

function PagamentosRecorrentesPage() {
  const ano = new Date().getFullYear();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: "#111111", letterSpacing: "-0.02em" }}>
          Pagamentos Recorrentes
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "#6B7280" }}>
          Marque <strong>Imp</strong> quando imprimir o boleto e <strong>Pago</strong> quando quitar.
          Meses passados sem nenhuma marca ficam com destaque de alerta. Ano exibido: {ano}.
        </p>
      </div>
      <PagamentosRecorrentes />
    </div>
  );
}
