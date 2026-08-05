import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  InboxEditProvider,
  InboxForm,
  InboxList,
  TodayList,
  DIA_FILTER_OPTIONS,
  CATEGORIA_OPTIONS,
  PRIORIDADE_FILTER_OPTIONS,
  type DiaSemana,
  type Categoria,
  type Prioridade,
} from "@/components/Inbox";
import { Layers } from "lucide-react";
import { HomeSummary } from "@/components/InboxSummary";
import { HomeFilterSidebarLayout, type FilterItem } from "@/components/HomeFilterSidebar";

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

type Tab = "hoje" | "todos";

const TABS: { value: Tab; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "todos", label: "Todos os itens" },
];

function Pill({
  label,
  active,
  onClick,
  small,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full font-medium transition-colors hover:bg-[#FAFAFA] ${
        small ? "px-3 py-1 text-[12px]" : "px-4 py-1.5 text-[13px]"
      }`}
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
      {label}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: "#6B7280", letterSpacing: "0.08em" }}
    >
      {children}
    </div>
  );
}

function Home() {
  const [tab, setTab] = useState<Tab>("hoje");
  const [dia, setDia] = useState<DiaSemana | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [prioridades, setPrioridades] = useState<Prioridade[]>([]);

  const toggleCategoria = (c: Categoria) =>
    setCategorias((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  const togglePrioridade = (p: Prioridade) =>
    setPrioridades((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );

  const sidebarItems: FilterItem[] = [
    ...TABS.map((t) => ({
      key: t.value,
      label: t.label,
      active: tab === t.value,
      onSelect: () => setTab(t.value),
    })),
    {
      key: "atalho-feedback",
      label: "Feedback",
      active: tab === "todos" && categorias.includes("feedback"),
      onSelect: () => {
        setTab("todos");
        setCategorias((prev) =>
          prev.includes("feedback") ? prev : [...prev, "feedback"],
        );
      },
    },
    ...(tab === "todos"
      ? DIA_FILTER_OPTIONS.map((d) => ({
          key: `dia-${d.value}`,
          label: d.label,
          sub: true,
          active: dia === d.value,
          onSelect: () => setDia(dia === d.value ? null : d.value),
        }))
      : []),
    {
      key: "envio-em-lote",
      label: "Envio em lote",
      icon: Layers,
      active: false, // Ocupado pelo atalho, ativado via pathname se necessário
      onSelect: () => {
        window.location.href = "/envio-em-lote";
      },
    },
  ];

  return (
    <InboxEditProvider>
      <HomeFilterSidebarLayout title="Filtros" items={sidebarItems}>
      <div className="mx-auto max-w-3xl">
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

        <HomeSummary />

        <div className="mt-6 flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <Pill
              key={t.value}
              label={t.label}
              active={tab === t.value}
              onClick={() => setTab(t.value)}
            />
          ))}
        </div>


        <div className="mt-4 flex flex-col gap-3">
          <div>
            <GroupLabel>Categoria</GroupLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIA_OPTIONS.map((c) => (
                <Pill
                  key={c.value}
                  small
                  label={c.label}
                  active={categorias.includes(c.value)}
                  onClick={() => toggleCategoria(c.value)}
                />
              ))}
            </div>
          </div>

          <div>
            <GroupLabel>Prioridade</GroupLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRIORIDADE_FILTER_OPTIONS.map((p) => (
                <Pill
                  key={p.value}
                  small
                  label={p.label}
                  active={prioridades.includes(p.value)}
                  onClick={() => togglePrioridade(p.value)}
                />
              ))}
            </div>
          </div>

          {tab === "todos" && (
            <div>
              <GroupLabel>Dia</GroupLabel>
              <div className="flex flex-wrap items-center gap-1.5">
                {DIA_FILTER_OPTIONS.map((d) => (
                  <Pill
                    key={d.value}
                    small
                    label={d.label}
                    active={dia === d.value}
                    onClick={() => setDia(dia === d.value ? null : d.value)}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === "todos" && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="mostrar-concluidos"
                checked={mostrarConcluidos}
                onChange={(e) => setMostrarConcluidos(e.target.checked)}
                className="h-4 w-4 rounded border-[#EDEDED] text-[#4F46E5] focus:ring-[#4F46E5]"
              />
              <label
                htmlFor="mostrar-concluidos"
                className="text-[12px] font-medium"
                style={{ color: "#6B7280" }}
              >
                Mostrar concluídos
              </label>
            </div>
          )}
        </div>

        {tab === "hoje" && (
          <TodayList categorias={categorias} prioridades={prioridades} />
        )}
        {tab === "todos" && (
          <InboxList
            includeFeedback
            diaFilter={dia}
            categorias={categorias}
            prioridades={prioridades}
            mostrarConcluidos={mostrarConcluidos}
            emptyLabel="Nenhum item ainda. Adicione o primeiro acima."
          />
        )}
      </div>

      </HomeFilterSidebarLayout>
    </InboxEditProvider>

  );
}
