import { z } from "zod";

// Areas em que o quadro Metas aparece. Para liberar outra area, inclua o slug aqui.
export const AREAS_METAS_HABILITADAS: string[] = ["versa3d"];

export function areaMetasHabilitada(area: string): boolean {
  return AREAS_METAS_HABILITADAS.includes(area);
}

// Valores oficiais (iguais aos checks da tabela public.metas)
export const TIPOS = ["tarefa", "decisao", "ideia", "bloqueio"] as const;
export const PROJETOS = [
  "Plataforma Gestão",
  "Ortounifase",
  "Consultório",
  "Versa3D",
  "Dentistas Petrópolis",
  "Financeira",
  "Versa3D Medidor",
  "Versa3D Inicial",
  "LabConect",
] as const;
export const FRENTES = [
  "Técnico",
  "Jurídico",
  "Comercial",
  "Financeiro",
  "Operação",
  "Conteúdo",
  "Pessoas",
] as const;
export const RESPONSAVEIS = ["Rafael", "Daniel", "Terceiro", "Indefinido"] as const;
export const PRIORIDADES = ["urgente", "importante", "depois"] as const;
export const STATUS = [
  "backlog",
  "a_fazer",
  "em_andamento",
  "aguardando",
  "concluido",
  "descartado",
] as const;
export const ORIGENS = ["sugestao_rafael", "sugestao_daniel", "discutido_ambos"] as const;

export type Tipo = (typeof TIPOS)[number];
export type Prioridade = (typeof PRIORIDADES)[number];
export type Status = (typeof STATUS)[number];

export const STATUS_FECHADOS: Status[] = ["concluido", "descartado"];

export const ROTULOS: Record<string, string> = {
  tarefa: "Tarefa",
  decisao: "Decisão",
  ideia: "Ideia",
  bloqueio: "Bloqueio",
  urgente: "Urgente",
  importante: "Importante",
  depois: "Depois",
  backlog: "Backlog",
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluido: "Concluído",
  descartado: "Descartado",
  sugestao_rafael: "Sugestão do Rafael",
  sugestao_daniel: "Sugestão do Daniel",
  discutido_ambos: "Discutido por ambos",
};

export function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof Error && e.message ? e.message : padrao;
}

export function rotulo(valor: string | null | undefined): string {
  if (!valor) return "";
  return ROTULOS[valor] ?? valor;
}

export type Meta = {
  id: string;
  area_gestao: string;
  tipo: Tipo;
  titulo: string;
  titulo_normalizado: string;
  detalhe: string | null;
  projeto: string;
  frente: string | null;
  responsaveis: string[];
  nome_terceiro: string | null;
  prioridade: Prioridade;
  prazo: string | null;
  status: Status;
  origem_discussao: string | null;
  fonte: string | null;
  resolucao: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  concluido_em: string | null;
};

export type MetaInsert = Omit<
  Meta,
  "id" | "resolucao" | "criado_em" | "atualizado_em" | "concluido_em"
>;

// ---------------------------------------------------------------------
// Normalizacao
// ---------------------------------------------------------------------

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// minusculas, sem acento, espacos colapsados
export function normalizarTitulo(titulo: string): string {
  return semAcento(titulo).toLowerCase().replace(/\s+/g, " ").trim();
}

// chave de comparacao para valores de lista ("A Fazer", "a_fazer" e "a-fazer" batem)
function chave(s: string): string {
  return semAcento(s)
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

export function valorOficial<T extends string>(
  valores: readonly T[],
  entrada: string,
): T | undefined {
  const k = chave(entrada);
  return valores.find((v) => chave(v) === k);
}

// ---------------------------------------------------------------------
// Validacao (zod) de um item no formato de importacao
// ---------------------------------------------------------------------

function vazioParaUndefined(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
}

function listaFlex<T extends string>(valores: readonly T[], campo: string) {
  return z.preprocess(
    (v) => (typeof v === "string" ? (valorOficial(valores, v) ?? v.trim()) : v),
    z.enum(valores as unknown as [T, ...T[]], {
      errorMap: (_issue, ctx) => ({
        message:
          ctx.data === undefined
            ? `${campo}: obrigatório`
            : `${campo}: "${String(ctx.data)}" não é aceito (aceitos: ${valores.join(", ")})`,
      }),
    }),
  );
}

// campo vazio vira undefined, e o schema interno devolve "<campo>: obrigatório"
function obrigatorio<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(vazioParaUndefined, schema);
}

function opcional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(vazioParaUndefined, schema.optional());
}

const textoOpcional = opcional(z.string().transform((s) => s.trim()));

// aceita AAAA-MM-DD ou DD/MM/AAAA; grava AAAA-MM-DD
const prazoSchema = z.string().transform((s, ctx) => {
  const t = s.trim();
  let a: number, m: number, d: number;
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (r) {
    [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  } else if ((r = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t))) {
    [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
  } else {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `prazo: "${t}" não é uma data (use AAAA-MM-DD ou DD/MM/AAAA)`,
    });
    return z.NEVER;
  }
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `prazo: "${t}" não é uma data válida` });
    return z.NEVER;
  }
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
});

export const itemImportacaoSchema = z.object({
  tipo: obrigatorio(listaFlex(TIPOS, "tipo")),
  titulo: obrigatorio(
    z
      .string({
        required_error: "titulo: obrigatório",
        invalid_type_error: "titulo: precisa ser texto",
      })
      .transform((s) => s.trim()),
  ),
  detalhe: textoOpcional,
  projeto: obrigatorio(listaFlex(PROJETOS, "projeto")),
  // "area" no JSON vira a coluna frente
  area: opcional(listaFlex(FRENTES, "area")),
  responsaveis: z.preprocess(
    (v) => {
      if (v === null || v === undefined || v === "") return [];
      if (typeof v === "string")
        return v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      return v;
    },
    z.array(listaFlex(RESPONSAVEIS, "responsaveis"), {
      invalid_type_error: "responsaveis: precisa ser uma lista",
    }),
  ),
  nome_terceiro: textoOpcional,
  prioridade: obrigatorio(listaFlex(PRIORIDADES, "prioridade")),
  prazo: opcional(prazoSchema),
  status: opcional(listaFlex(STATUS, "status")),
  origem_discussao: opcional(listaFlex(ORIGENS, "origem_discussao")),
  fonte: textoOpcional,
});

export type ItemImportacao = z.infer<typeof itemImportacaoSchema>;

export function paraInsert(item: ItemImportacao, area: string): MetaInsert {
  return {
    area_gestao: area,
    tipo: item.tipo,
    titulo: item.titulo,
    titulo_normalizado: normalizarTitulo(item.titulo),
    detalhe: item.detalhe ?? null,
    projeto: item.projeto,
    frente: item.area ?? null,
    responsaveis: Array.from(new Set(item.responsaveis)),
    nome_terceiro: item.nome_terceiro ?? null,
    prioridade: item.prioridade,
    prazo: item.prazo ?? null,
    status: item.status ?? "backlog",
    origem_discussao: item.origem_discussao ?? null,
    fonte: item.fonte ?? null,
  };
}

// ---------------------------------------------------------------------
// Analise do lote (usada na previa e de novo na confirmacao)
// ---------------------------------------------------------------------

export type PreviaImportacao = {
  ok: boolean;
  erroGeral?: string;
  novos: { indice: number; meta: MetaInsert }[];
  duplicados: { indice: number; titulo: string; projeto: string; motivo: string }[];
  invalidos: { indice: number; titulo: string; motivos: string[] }[];
};

export function chaveDuplicidade(projeto: string, tituloNormalizado: string): string {
  return `${projeto}\u0000${tituloNormalizado}`;
}

export function analisarLote(
  jsonText: string,
  area: string,
  existentes: Set<string>,
): PreviaImportacao {
  const vazio: PreviaImportacao = { ok: false, novos: [], duplicados: [], invalidos: [] };

  let dados: unknown;
  try {
    dados = JSON.parse(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro de sintaxe";
    return { ...vazio, erroGeral: "JSON inválido: " + msg };
  }
  if (!Array.isArray(dados)) {
    return { ...vazio, erroGeral: "O JSON precisa ser um array: [ {...}, {...} ]" };
  }

  const resultado: PreviaImportacao = { ok: true, novos: [], duplicados: [], invalidos: [] };
  const noLote = new Map<string, number>();

  dados.forEach((bruto, i) => {
    const indice = i + 1;
    const tituloCampo =
      bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>).titulo : undefined;
    const tituloBruto = typeof tituloCampo === "string" ? tituloCampo.trim() : "";

    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
      resultado.invalidos.push({ indice, titulo: "", motivos: ["não é um objeto"] });
      return;
    }

    const parsed = itemImportacaoSchema.safeParse(bruto);
    if (!parsed.success) {
      resultado.invalidos.push({
        indice,
        titulo: tituloBruto,
        motivos: parsed.error.issues.map((iss) => iss.message),
      });
      return;
    }

    const meta = paraInsert(parsed.data, area);
    if (!meta.titulo_normalizado) {
      resultado.invalidos.push({ indice, titulo: tituloBruto, motivos: ["titulo: obrigatório"] });
      return;
    }

    const k = chaveDuplicidade(meta.projeto, meta.titulo_normalizado);
    if (existentes.has(k)) {
      resultado.duplicados.push({
        indice,
        titulo: meta.titulo,
        projeto: meta.projeto,
        motivo: "já existe no banco",
      });
      return;
    }
    const anterior = noLote.get(k);
    if (anterior !== undefined) {
      resultado.duplicados.push({
        indice,
        titulo: meta.titulo,
        projeto: meta.projeto,
        motivo: `repetido no lote (igual ao item #${anterior})`,
      });
      return;
    }
    noLote.set(k, indice);
    resultado.novos.push({ indice, meta });
  });

  return resultado;
}
