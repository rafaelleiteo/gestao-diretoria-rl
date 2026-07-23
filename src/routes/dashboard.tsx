import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/InboxSummary";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Visão completa — Rafael Leite" },
      { name: "description", content: "Painel com pendentes por área, prioridade e histórico de conclusões." },
      { property: "og:title", content: "Visão completa — Rafael Leite" },
      { property: "og:description", content: "Painel com pendentes por área, prioridade e histórico de conclusões." },
    ],
  }),
  component: DashboardView,
});
