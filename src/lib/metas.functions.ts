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
  const { data, error } = await metas(context).select("projeto, titulo_normalizado");
  if (error) throw new Error("Erro ao conferir duplicados: " + error.message);
  return new Set(
    ((data ?? []) as { projeto: string; titulo_normalizado: string }[]).map((r) =>
      chaveDuplicidade(r.projeto, r.titulo_normalizado),
    ),
  );
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
      throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
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

// Etapa 2: confirmacao. Refaz a analise no servidor (o banco pode ter mudado desde a previa)
// e grava somente os novos. Nunca atualiza nem sobrescreve: on conflict do nothing.
export const confirmarImportacaoMetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => importacaoSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const existentes = await chavesExistentes(context);
    const analise = analisarLote(data.jsonText, data.area, existentes);
    if (!analise.ok) throw new Error(analise.erroGeral ?? "Lote inválido.");

    let inseridos = 0;
    if (analise.novos.length > 0) {
      const { data: rows, error } = await metas(context)
        .upsert(
          analise.novos.map((n) => n.meta),
          { onConflict: "projeto,titulo_normalizado", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw new Error("Erro ao gravar: " + error.message);
      inseridos = (rows ?? []).length;
    }

    return {
      inseridos,
      ignoradosNaGravacao: analise.novos.length - inseridos,
      duplicados: analise.duplicados.length,
      invalidos: analise.invalidos.length,
    };
  });
