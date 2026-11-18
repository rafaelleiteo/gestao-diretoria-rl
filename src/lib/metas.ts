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
// A Gestao e de uso exclusivo do Rafael.
export const RESPONSAVEIS = ["Rafael", "Terceiro", "Indefinido"] as const;
export const PRIORIDADES = ["urgente", "importante", "depois"] as const;
export const STATUS = [
  "backlog",
  "a_fazer",
  "em_andamento",
  "aguardando",
  "concluido",
  "descartado",
] as const;
export const ORIGENS = ["sugestao_rafael"] as const;

// fonte gravada na importacao quando o JSON nao informa outra
export const FONTE_PADRAO_IMPORTACAO = "importacao";
// valores de fonte reservados para teste e medicao no banco
const FONTES_RESERVADAS = ["teste", "medicao", "medicao_tmp"];

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

// concluido_em so vai no insert quando status = 'concluido' e a data veio no JSON
export type MetaInsert = Omit<
  Meta,
  "id" | "resolucao" | "criado_em" | "atualizado_em" | "concluido_em"
> & { concluido_em?: string };

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

// o nome do campo e acrescentado na analise do lote (mensagemDoIssue)
const textoOpcional = opcional(
  z.string({ invalid_type_error: "precisa ser texto" }).transform((s) => s.trim()),
);

function dataValida(a: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// aceita AAAA-MM-DD ou DD/MM/AAAA; grava AAAA-MM-DD
const prazoSchema = z
  .string({ invalid_type_error: "prazo: precisa ser texto (AAAA-MM-DD)" })
  .transform((s, ctx) => {
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
    if (!dataValida(a, m, d)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `prazo: "${t}" não é uma data válida` });
      return z.NEVER;
    }
    return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });

// concluido_em (formato ISO):
// - AAAA-MM-DD: gravado como meio-dia de Brasilia (12:00 -03:00), para a data
//   nao mudar de dia por causa de fuso;
// - data e hora com fuso (Z ou +-HH:MM): gravado como veio.
// Data e hora SEM fuso e recusada (seria interpretada em UTC no banco).
const concluidoEmSchema = z
  .string({ invalid_type_error: "concluido_em: precisa ser texto (AAAA-MM-DD)" })
  .transform((s, ctx) => {
    const t = s.trim();
    const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (soData) {
      if (dataValida(Number(soData[1]), Number(soData[2]), Number(soData[3]))) {
        return `${t}T12:00:00-03:00`;
      }
    } else {
      const comHora =
        /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(t);
      if (
        comHora &&
        dataValida(Number(comHora[1]), Number(comHora[2]), Number(comHora[3])) &&
        !Number.isNaN(Date.parse(t))
      ) {
        return t;
      }
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `concluido_em: "${t}" não é aceito (use AAAA-MM-DD, ou data e hora com fuso, ex.: 2026-01-15T10:00:00-03:00)`,
    });
    return z.NEVER;
  });

const fonteSchema = opcional(
  z
    .string({ invalid_type_error: "fonte: precisa ser texto" })
    .transform((s) => s.trim())
    .refine(
      (s) => !FONTES_RESERVADAS.includes(s.toLowerCase()),
      (s) => ({
        message: `fonte: "${s}" é reservado para teste (use outro valor ou deixe vazio para "${FONTE_PADRAO_IMPORTACAO}")`,
      }),
    ),
);

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
  concluido_em: opcional(concluidoEmSchema),
  origem_discussao: opcional(listaFlex(ORIGENS, "origem_discussao")),
  fonte: fonteSchema,
});

export type ItemImportacao = z.infer<typeof itemImportacaoSchema>;

// fontePadrao: usada quando o item nao traz fonte (importacao: "importacao";
// formulario Nova meta: null, como antes).
export function paraInsert(
  item: ItemImportacao,
  area: string,
  fontePadrao: string | null = null,
): MetaInsert {
  const status = item.status ?? "backlog";
  const row: MetaInsert = {
    area_gestao: area,
    tipo: item.tipo,
    titulo: item.titulo,
    // sempre calculado aqui (no servidor), nunca vindo do navegador
    titulo_normalizado: normalizarTitulo(item.titulo),
    detalhe: item.detalhe ?? null,
    projeto: item.projeto,
    frente: item.area ?? null,
    responsaveis: Array.from(new Set(item.responsaveis)),
    nome_terceiro: item.nome_terceiro ?? null,
    prioridade: item.prioridade,
    prazo: item.prazo ?? null,
    status,
    origem_discussao: item.origem_discussao ?? null,
    fonte: item.fonte ?? fontePadrao,
  };
  // concluido_em somente quando status = concluido E a data veio no JSON
  if (status === "concluido" && item.concluido_em) row.concluido_em = item.concluido_em;
  return row;
}

// ---------------------------------------------------------------------
// Analise do lote (usada na previa e de novo na confirmacao)
// ---------------------------------------------------------------------

export type PreviaImportacao = {
  // true quando o JSON foi lido (array, ou objeto com "metas")
  ok: boolean;
  // true somente com ok, nenhum invalido e pelo menos 1 novo (tudo ou nada)
  podeGravar: boolean;
  erroGeral?: string;
  total: number;
  // fonte aplicada aos itens que nao trazem fonte propria
  fonte: string;
  avisosGerais: string[];
  novos: { indice: number; meta: MetaInsert }[];
  duplicados: { indice: number; titulo: string; projeto: string; motivo: string }[];
  invalidos: { indice: number; titulo: string; motivos: string[] }[];
  avisos: { indice: number; titulo: string; mensagens: string[] }[];
};

export function chaveDuplicidade(projeto: string, tituloNormalizado: string): string {
  return `${projeto}\u0000${tituloNormalizado}`;
}

const CAMPOS_ITEM = new Set(Object.keys(itemImportacaoSchema.shape));

const DICA_CAMPO: Record<string, string> = {
  frente: 'no JSON a frente vai no campo "area"',
  titulo_normalizado: "é calculado pelo servidor a partir do titulo",
  area_gestao: "vem da área da tela",
  id: "é gerado pelo banco",
  criado_em: "é preenchido pelo banco",
  atualizado_em: "é preenchido pelo banco",
  resolucao: "não é importado; preencha na tela depois",
};

function mensagemCampoDesconhecido(campo: string): string {
  const dica = DICA_CAMPO[campo];
  return `campo "${campo}" não existe e será ignorado${dica ? ` (${dica})` : ""}`;
}

// garante que toda mensagem diga o campo (as mensagens padrao do zod nao dizem)
export function mensagemDoIssue(iss: z.ZodIssue): string {
  const campo = iss.path.length ? String(iss.path[0]) : "";
  if (!campo || iss.message.startsWith(`${campo}:`)) return iss.message;
  return `${iss.path.join(".")}: ${iss.message}`;
}

export function analisarLote(
  jsonText: string,
  area: string,
  existentes: Set<string>,
): PreviaImportacao {
  const vazio: PreviaImportacao = {
    ok: false,
    podeGravar: false,
    total: 0,
    fonte: FONTE_PADRAO_IMPORTACAO,
    avisosGerais: [],
    novos: [],
    duplicados: [],
    invalidos: [],
    avisos: [],
  };
  const formatoAceito =
    'Use um array [ {...}, {...} ] ou um objeto { "fonte": "...", "metas": [ {...} ] }';

  let dados: unknown;
  try {
    dados = JSON.parse(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro de sintaxe";
    return { ...vazio, erroGeral: "JSON inválido: " + msg };
  }

  // Formato 1: array de metas. Formato 2: { "fonte": "...", "metas": [...] }
  let itens: unknown[];
  let fonteLote = FONTE_PADRAO_IMPORTACAO;
  const avisosGerais: string[] = [];
  if (Array.isArray(dados)) {
    itens = dados;
  } else if (dados && typeof dados === "object") {
    const obj = dados as Record<string, unknown>;
    if (!Array.isArray(obj.metas)) {
      return { ...vazio, erroGeral: `Falta o array "metas". ${formatoAceito}` };
    }
    itens = obj.metas;
    if (obj.fonte !== undefined && obj.fonte !== null && obj.fonte !== "") {
      const f = fonteSchema.safeParse(obj.fonte);
      if (!f.success || !f.data) {
        return {
          ...vazio,
          erroGeral:
            "fonte do lote: " +
            (f.success ? "inválida" : f.error.issues.map((i) => i.message).join("; ")),
        };
      }
      fonteLote = f.data;
    }
    for (const k of Object.keys(obj)) {
      if (k !== "metas" && k !== "fonte") {
        avisosGerais.push(`campo "${k}" do lote não existe e será ignorado`);
      }
    }
  } else {
    return { ...vazio, erroGeral: `O JSON precisa ser uma lista de metas. ${formatoAceito}` };
  }

  const resultado: PreviaImportacao = {
    ...vazio,
    ok: true,
    total: itens.length,
    fonte: fonteLote,
    avisosGerais,
  };
  const noLote = new Map<string, number>();

  itens.forEach((bruto, i) => {
    const indice = i + 1;
    const tituloCampo =
      bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>).titulo : undefined;
    const tituloBruto = typeof tituloCampo === "string" ? tituloCampo.trim() : "";

    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
      resultado.invalidos.push({ indice, titulo: "", motivos: ["não é um objeto"] });
      return;
    }

    // campos desconhecidos: aviso (nunca ignorados em silencio)
    const avisosItem = Object.keys(bruto)
      .filter((k) => !CAMPOS_ITEM.has(k))
      .map(mensagemCampoDesconhecido);

    const parsed = itemImportacaoSchema.safeParse(bruto);
    if (!parsed.success) {
      resultado.invalidos.push({
        indice,
        titulo: tituloBruto,
        motivos: parsed.error.issues.map(mensagemDoIssue),
      });
      if (avisosItem.length) {
        resultado.avisos.push({ indice, titulo: tituloBruto, mensagens: avisosItem });
      }
      return;
    }

    const meta = paraInsert(parsed.data, area, fonteLote);

    if (parsed.data.concluido_em && meta.status !== "concluido") {
      avisosItem.push('concluido_em ignorado: só é gravado com status "concluido"');
    }
    if (meta.status === "concluido" && !parsed.data.concluido_em) {
      avisosItem.push(
        "status concluido sem concluido_em: o banco preenche com o momento da gravação",
      );
    }
    if (avisosItem.length) {
      resultado.avisos.push({ indice, titulo: meta.titulo || tituloBruto, mensagens: avisosItem });
    }

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
        motivo: "já existe no banco (não será alterado)",
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

  resultado.podeGravar = resultado.invalidos.length === 0 && resultado.novos.length > 0;
  return resultado;
}
