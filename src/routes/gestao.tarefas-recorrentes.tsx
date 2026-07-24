import { createFileRoute } from "@tanstack/react-router";
import { TarefasRecorrentesModule } from "@/components/TarefasRecorrentes";

export const Route = createFileRoute("/gestao/tarefas-recorrentes")({
  head: () => ({
    meta: [
      { title: "Tarefas Recorrentes — Gestão — Rafael Leite" },
      { name: "description", content: "Hábitos e tarefas que se repetem, agrupadas por área." },
      { property: "og:title", content: "Tarefas Recorrentes — Gestão" },
      { property: "og:description", content: "Hábitos e tarefas que se repetem, agrupadas por área." },
    ],
  }),
  component: TarefasRecorrentesPage,
});

function TarefasRecorrentesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: "#111111", letterSpacing: "-0.02em" }}>
          Tarefas Recorrentes
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "#6B7280" }}>
          Marque como concluída quando terminar — a tarefa volta a aparecer sozinha na próxima ocorrência.
        </p>
      </div>
      <TarefasRecorrentesModule />
    </div>
  );
}
