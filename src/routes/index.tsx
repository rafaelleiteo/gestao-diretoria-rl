import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  InboxEditProvider,
  InboxForm,
  InboxList,
  TodayList,
  FeedbackList,
} from "@/components/Inbox";
import { HomeSummary } from "@/components/InboxSummary";

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

type Tab = "hoje" | "feedback" | "todos";

const TABS: { value: Tab; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "feedback", label: "Feedback" },
  { value: "todos", label: "Todos os itens" },
];

function Home() {
  const [tab, setTab] = useState<Tab>("hoje");

  return (
    <InboxEditProvider>
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

        <div className="mt-6 flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors hover:bg-[#FAFAFA]"
                style={
                  active
                    ? { backgroundColor: "#4F46E5", color: "#FFFFFF" }
                    : {
                        backgroundColor: "transparent",
                        color: "#6B7280",
                        border: "1px solid #EDEDED",
                      }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "hoje" && <TodayList />}
        {tab === "feedback" && <FeedbackList />}
        {tab === "todos" && (
          <InboxList
            includeFeedback
            emptyLabel="Nenhum item ainda. Adicione o primeiro acima."
          />
        )}

        <HomeSummary />
      </div>
    </InboxEditProvider>
  );
}
