import { CheckSquare, Square } from "lucide-react";
import { TAB_AREAS } from "@/lib/areas";

export const AREA_MENU_ITEMS: Record<string, { label: string; key: string }[]> = {
  diretoria: [{ label: "Visão Geral", key: "index" }],
  financeiro: [
    { label: "Visão Geral", key: "index" },
    { label: "Pagamentos Recorrentes", key: "pagamentos-recorrentes" },
    { label: "Links", key: "links" },
  ],
  consultorio: [
    { label: "Visão Geral", key: "index" },
    { label: "Ficha de Planejamento", key: "ficha-planejamento" },
    { label: "Modelos de Documentos", key: "modelos-documentos" },
    { label: "Protocolos", key: "protocolos" },
    { label: "Links", key: "links" },
  ],
  gestao: [
    { label: "Prompts", key: "prompts" },
    { label: "Tarefas Recorrentes", key: "tarefas-recorrentes" },
    { label: "Recorrentes Mensal", key: "tarefas-recorrentes-mensal" },
    { label: "Rotina", key: "rotina" },
    { label: "Links", key: "links" },
  ],
  versa3d: [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
  especializacao: [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
  graduacao: [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
  doutorado: [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
  "dentistas-petropolis": [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
  "connect-lab": [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
};

export type Permission = { area: string; item_menu: string };

export function togglePermission(
  permissions: Permission[],
  area: string,
  item: string,
): Permission[] {
  const exists = permissions.some((p) => p.area === area && p.item_menu === item);

  if (exists) {
    return permissions.filter((p) => !(p.area === area && p.item_menu === item));
  }

  let next = [...permissions, { area, item_menu: item }];
  if (item === "*") {
    next = next.filter((p) => p.area !== area || p.item_menu === "*");
  } else {
    next = next.filter((p) => !(p.area === area && p.item_menu === "*"));
  }
  return next;
}

export function PermissionsPanel({
  permissions,
  onToggle,
}: {
  permissions: Permission[];
  onToggle: (area: string, item: string) => void;
}) {
  const has = (area: string, item: string) =>
    permissions.some((p) => p.area === area && p.item_menu === item);

  return (
    <div className="space-y-4">
      {TAB_AREAS.map((area) => {
        const items = AREA_MENU_ITEMS[area.slug] ?? [];
        const full = has(area.slug, "*");
        return (
          <div
            key={area.slug}
            className="rounded-xl border p-4"
            style={{ borderColor: "#EDEDED" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold" style={{ color: "#111111" }}>
                {area.label}
              </span>
              <button
                type="button"
                onClick={() => onToggle(area.slug, "*")}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium"
                style={
                  full
                    ? { borderColor: "#4F46E5", color: "#4F46E5", backgroundColor: "#EEF2FF" }
                    : { borderColor: "#EDEDED", color: "#6B7280" }
                }
              >
                {full ? <CheckSquare size={13} /> : <Square size={13} />}
                Área inteira
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const active = full || has(area.slug, item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={full}
                    onClick={() => onToggle(area.slug, item.key)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium disabled:opacity-60"
                    style={
                      active
                        ? { borderColor: "#4F46E5", color: "#4F46E5", backgroundColor: "#EEF2FF" }
                        : { borderColor: "#EDEDED", color: "#6B7280" }
                    }
                  >
                    {active ? <CheckSquare size={12} /> : <Square size={12} />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
