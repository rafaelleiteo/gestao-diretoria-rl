export type AreaValue =
  | "geral"
  | "diretoria"
  | "financeiro"
  | "consultorio"
  | "versa3d"
  | "especializacao"
  | "graduacao"
  | "doutorado"
  | "dentistas-petropolis"
  | "connect-lab";

export type TabArea = Exclude<AreaValue, "geral">;

export type AreaDef = {
  slug: TabArea;
  label: string;
  phase1?: boolean;
};

export const TAB_AREAS: AreaDef[] = [
  { slug: "diretoria", label: "Diretoria", phase1: true },
  { slug: "financeiro", label: "Financeiro", phase1: true },
  { slug: "consultorio", label: "Consultório", phase1: true },
  { slug: "versa3d", label: "Versa3D" },
  { slug: "especializacao", label: "Especialização" },
  { slug: "graduacao", label: "Graduação" },
  { slug: "doutorado", label: "Doutorado" },
  { slug: "dentistas-petropolis", label: "Dentistas Petrópolis" },
  { slug: "connect-lab", label: "Connect Lab" },
];

export const ALL_AREA_OPTIONS: { value: AreaValue; label: string }[] = [
  { value: "geral", label: "Área Geral" },
  ...TAB_AREAS.map((a) => ({ value: a.slug as AreaValue, label: a.label })),
];

export function areaLabel(value: AreaValue): string {
  if (value === "geral") return "Área Geral";
  return TAB_AREAS.find((a) => a.slug === value)?.label ?? value;
}
