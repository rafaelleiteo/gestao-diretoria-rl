import { createFileRoute } from "@tanstack/react-router";
import { InboxForm, InboxList, TodayList } from "@/components/Inbox";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Rafael Leite" },
      { name: "description", content: "Caixa de entrada geral de mensagens, ideias e tarefas." },
      { property: "og:title", content: "Início — Rafael Leite" },
      { property: "og:description", content: "Caixa de entrada geral de mensagens, ideias e tarefas." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          Caixa de Entrada Geral
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "#6B7280" }}>
          Registre rapidamente qualquer mensagem, ideia ou tarefa e marque a qual área ela pertence.
        </p>
      </div>

      <InboxForm />
      <InboxList emptyLabel="Nenhum item ainda. Adicione o primeiro acima." />
    </div>
  );
}
