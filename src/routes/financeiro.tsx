import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Inbox as InboxIcon, Wallet, Link as LinkIcon, FileText } from "lucide-react";
import { AreaSidebarLayout, type SidebarMenuItem } from "@/components/AreaSidebar";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Rafael Leite" },
      { name: "description", content: "Ferramentas financeiras." },
      { property: "og:title", content: "Financeiro — Rafael Leite" },
      { property: "og:description", content: "Ferramentas financeiras." },
    ],
  }),
  component: FinanceiroLayout,
});

const MENU: SidebarMenuItem[] = [
  { to: "/financeiro", label: "Visão Geral", icon: InboxIcon, exact: true },
  { to: "/financeiro/pagamentos-recorrentes", label: "Pagamentos Recorrentes", icon: Wallet },
  { to: "/financeiro/protocolos", label: "Protocolos", icon: FileText },
  { to: "/financeiro/links", label: "Links", icon: LinkIcon },
];

function FinanceiroLayout() {
  return (
    <AreaSidebarLayout title="Financeiro" menu={MENU}>
      <Outlet />
    </AreaSidebarLayout>
  );
}
