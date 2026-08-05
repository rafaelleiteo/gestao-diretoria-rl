import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FileText, FileSignature, Inbox as InboxIcon, Link as LinkIcon } from "lucide-react";
import { AreaSidebarLayout, type SidebarMenuItem } from "@/components/AreaSidebar";

export const Route = createFileRoute("/consultorio")({
  head: () => ({
    meta: [
      { title: "Consultório — Rafael Leite" },
      { name: "description", content: "Ferramentas do Consultório." },
      { property: "og:title", content: "Consultório — Rafael Leite" },
      { property: "og:description", content: "Ferramentas do Consultório." },
    ],
  }),
  component: ConsultorioLayout,
});

const MENU: SidebarMenuItem[] = [
  { to: "/consultorio", label: "Visão Geral", icon: InboxIcon, exact: true },
  { to: "/consultorio/ficha-planejamento", label: "Ficha de Planejamento", icon: FileText },
  { to: "/consultorio/modelos-documentos", label: "Modelos de Documentos", icon: FileSignature },
  { to: "/consultorio/links", label: "Links", icon: LinkIcon },
];

function ConsultorioLayout() {
  return (
    <AreaSidebarLayout title="Consultório" menu={MENU}>
      <Outlet />
    </AreaSidebarLayout>
  );
}
