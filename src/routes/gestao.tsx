import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Sparkles, Repeat } from "lucide-react";

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

type MenuItem = {
  to: string;
  label: string;
  icon: typeof Sparkles;
  exact?: boolean;
};

const MENU: MenuItem[] = [
  { to: "/gestao/prompts", label: "Prompts", icon: Sparkles },
  { to: "/gestao/tarefas-recorrentes", label: "Tarefas Recorrentes", icon: Repeat },
];

function GestaoLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-8 px-6 py-8">
      <aside
        className="sticky top-[73px] hidden h-[calc(100vh-97px)] w-[240px] shrink-0 rounded-2xl border bg-white p-3 md:block"
        style={{ borderColor: "#EDEDED" }}
      >
        <div
          className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#4F46E5", letterSpacing: "0.08em" }}
        >
          Gestão
        </div>
        <nav className="flex flex-col gap-0.5">
          {MENU.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: "#4F46E5", color: "#FFFFFF" }
                    : { backgroundColor: "transparent", color: "#6B7280" }
                }
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "#FAFAFA";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
