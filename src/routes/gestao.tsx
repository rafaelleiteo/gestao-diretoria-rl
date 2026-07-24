import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sparkles, Repeat } from "lucide-react";
import { AreaSidebarLayout, type SidebarMenuItem } from "@/components/AreaSidebar";

export const Route = createFileRoute("/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão — Rafael Leite" },
      { name: "description", content: "Ferramentas de apoio à gestão do dia a dia." },
      { property: "og:title", content: "Gestão — Rafael Leite" },
      { property: "og:description", content: "Ferramentas de apoio à gestão do dia a dia." },
    ],
  }),
  component: GestaoLayout,
});

const MENU: SidebarMenuItem[] = [
  { to: "/gestao/prompts", label: "Prompts", icon: Sparkles },
  { to: "/gestao/tarefas-recorrentes", label: "Tarefas Recorrentes", icon: Repeat },
];

function GestaoLayout() {
  return (
    <AreaSidebarLayout title="Gestão" menu={MENU}>
      <Outlet />
    </AreaSidebarLayout>
  );
}
