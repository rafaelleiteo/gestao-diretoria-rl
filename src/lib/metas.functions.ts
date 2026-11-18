import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRIORIDADES,
  STATUS,
  analisarLote,
  areaMetasHabilitada,
  chaveDuplicidade,
  itemImportacaoSchema,
  mensagemDoIssue,
  paraInsert,
  type Meta,
  type PreviaImportacao,
} from "@/lib/metas";
import { exigirAdmin } from "@/lib/admin.server";

// Seguranca:
// 1. Toda funcao exige login (requireSupabaseAuth) e chama exigirAdmin antes de qualquer acao.
// 2. exigirAdmin usa o supabaseAdmin SOMENTE para ler o role do proprio usuario em profiles
//    (mesmo padrao de getCurrentUser).
// 3. Todas as leituras e gravacoes em public.metas usam o cliente do usuario (context.supabase),
//    entao a RLS da tabela (is_admin(auth.uid())) tambem e aplicada.

type Ctx = { supabase: unknown; userId: string };

// A tabela metas ainda nao esta em types.ts (arquivo gerado); acesso sem tipagem do banco.
function metas(context: Ctx) {
  return (context.supabase as SupabaseClient).from("metas");
}

const areaSchema = z
  .string()
  .refine(areaMetasHabilitada, { message: "Metas não está habilitado nesta área" });

async function chavesExistentes(context: Ctx): Promise<Set<string>> {
  // O indice unico e (projeto, titulo_normalizado) em toda a tabela, nao so na area.
  // Le em paginas: a API do Supabase devolve no maximo 1000 linhas por consulta,
  // e sem paginar um duplicado alem da linha 1000 nao seria detectado na previa.
  const PAGINA = 1000;
  const chaves = new Set<string>();
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await metas(context)
      .select("projeto, titulo_normalizado")
      .order("id", { ascending: true })
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw new Error("Erro ao conferir duplicados: " + error.message);
    const linhas = (data ?? []) as { projeto: string; titulo_normalizado: string }[];
    for (const r of linhas) chaves.add(chaveDuplicidade(r.projeto, r.titulo_normalizado));
    if (linhas.length < PAGINA) break;
  }
  return chaves;
}

export const listarMetas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ area: areaSchema }).parse(data))
  .handler(async ({ data, context }): Promise<Meta[]> => {
    await exigirAdmin(context);
    const { data: rows, error } = await metas(context)
      .select("*")
      .eq("area_gestao", data.area)
      .order("criado_em", { ascending: false });
    if (error) throw new Error("Erro ao carregar metas: " + error.message);
    return (rows ?? []) as Meta[];
  });

export const criarMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ area: areaSchema, item: z.record(z.unknown()) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<Meta> => {
    await exigirAdmin(context);
    const parsed = itemImportacaoSchema.safeParse(data.item);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map(mensagemDoIssue).join("; "));
    }
    const row = paraInsert(parsed.data, data.area);
    if (!row.titulo_normalizado) throw new Error("titulo: obrigatório");

    const { data: criada, error } = await metas(context).insert(row).select("*").single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe uma meta com este título neste projeto.");
      }
      throw new Error("Erro ao criar meta: " + error.message);
    }
    return criada as Meta;
  });

// Atualiza somente: status, prioridade, detalhe, resolucao e prazo.
export const atualizarMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        area: areaSchema,
        alteracoes: z
          .object({
            status: z.enum(STATUS).optional(),
            prioridade: z.enum(PRIORIDADES).optional(),
            detalhe: z.string().nullable().optional(),
            resolucao: z.string().nullable().optional(),
            prazo: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, "prazo: use AAAA-MM-DD")
              .nullable()
              .optional(),
          })
          .strict(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<Meta> => {
    await exigirAdmin(context);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.alteracoes)) {
      if (v === undefined) continue;
      patch[k] =
        typeof v === "string" && k !== "status" && k !== "prioridade" && v.trim() === "" ? null : v;
    }
    if (Object.keys(patch).length === 0) throw new Error("Nada para atualizar.");

    const { data: atualizada, error } = await metas(context)
      .update(patch)
      .eq("id", data.id)
      .eq("area_gestao", data.area)
      .select("*")
      .maybeSingle();
    if (error) throw new Error("Erro ao atualizar meta: " + error.message);
    if (!atualizada) throw new Error("Meta não encontrada.");
    return atualizada as Meta;
  });

const importacaoSchema = z.object({
  area: areaSchema,
  jsonText: z.string().min(1, "Cole um array JSON").max(1_000_000),
});

// Etapa 1: previa. Nao grava nada.
export const previaImportacaoMetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => importacaoSchema.parse(data))
  .handler(async ({ data, context }): Promise<PreviaImportacao> => {
    await exigirAdmin(context);
    const existentes = await chavesExistentes(context);
    return analisarLote(data.jsonText, data.area, existentes);
  });

// Etapa 2: confirmacao. Refaz a analise no servidor (o banco pode ter mudado desde a previa).
// Tudo ou nada:
// - se qualquer item for invalido, nada e gravado;
// - os novos vao em UM insert (uma unica instrucao no banco): ou entram todos, ou nenhum.
// Nunca atualiza nem sobrescreve: e insert puro (sem upsert). Se uma meta igual surgir
// entre a analise e a gravacao, o indice unico recusa o lote inteiro.
export const confirmarImportacaoMetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => importacaoSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const existentes = await chavesExistentes(context);
    const analise = analisarLote(data.jsonText, data.area, existentes);
    if (!analise.ok) throw new Error(analise.erroGeral ?? "Lote inválido.");
    if (analise.invalidos.length > 0) {
      throw new Error(
        `${analise.invalidos.length} item(ns) inválido(s). Corrija o JSON e gere a prévia de novo. Nada foi gravado.`,
      );
    }
    if (analise.novos.length === 0) throw new Error("Nenhuma meta nova para gravar.");

    const { data: rows, error } = await metas(context)
      .insert(analise.novos.map((n) => n.meta))
      .select("id");
    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "Uma das metas passou a existir depois da prévia. Nada foi gravado. Gere a prévia de novo.",
        );
      }
      throw new Error("Erro ao gravar (nada foi gravado): " + error.message);
    }

    return {
      inseridos: (rows ?? []).length,
      duplicados: analise.duplicados.length,
      avisos: analise.avisos.length,
    };
  });
