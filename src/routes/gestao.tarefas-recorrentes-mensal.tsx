import { createFileRoute } from "@tanstack/react-router";
import { TarefasRecorrentesMensal } from "@/components/TarefasRecorrentesMensal";

export const Route = createFileRoute("/gestao/tarefas-recorrentes-mensal")({
  head: () => ({
    meta: [
      { title: "Tarefas Recorrentes Mensal — Gestão — Rafael Leite" },
      { name: "description", content: "Grade mensal de tarefas recorrentes com dia fixo." },
      { property: "og:title", content: "Tarefas Recorrentes Mensal — Gestão" },
      { property: "og:description", content: "Grade mensal de tarefas recorrentes com dia fixo." },
    ],
  }),
  component: TarefasRecorrentesMensalPage,
});

function TarefasRecorrentesMensalPage() {
  const ano = new Date().getFullYear();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: "#111111", letterSpacing: "-0.02em" }}>
          Tarefas Recorrentes Mensal
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "#6B7280" }}>
          Grade de acompanhamento para tarefas que ocorrem em dias fixos do mês.
          Meses passados sem conclusão ficam com destaque de alerta. Ano: {ano}.
        </p>
      </div>
      <TarefasRecorrentesMensal />
    </div>
  );
}
