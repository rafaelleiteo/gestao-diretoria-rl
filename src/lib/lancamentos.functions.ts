import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function addMonthsToCompetencia(comp: string, monthsToAdd: number): string {
  if (!comp) return comp;
  const parts = comp.split('/');
  if (parts.length !== 2) return comp;
  let month = parseInt(parts[0], 10);
  let year = parseInt(parts[1], 10);
  if (isNaN(month) || isNaN(year)) return comp;

  let totalMonths = year * 12 + (month - 1) + monthsToAdd;
  let newYear = Math.floor(totalMonths / 12);
  let newMonth = (totalMonths % 12) + 1;

  const mStr = String(newMonth).padStart(2, "0");
  return `${mStr}/${newYear}`;
}

function addMonthsToDateString(dateStr: string, monthsToAdd: number): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  let day = 1,
    month = 1,
    year = 2026;
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    day = parseInt(parts[0], 10) || 1;
    month = parseInt(parts[1], 10) || 1;
    year = parseInt(parts[2], 10) || 2026;
  } else if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    year = parseInt(parts[0], 10) || 2026;
    month = parseInt(parts[1], 10) || 1;
    day = parseInt(parts[2], 10) || 1;
  }

  const d = new Date(year, month - 1 + monthsToAdd, day);
  const targetMonth = (((month - 1 + monthsToAdd) % 12) + 12) % 12;
  while (d.getMonth() !== targetMonth) {
    d.setDate(d.getDate() - 1);
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const getFinanceiroAreas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("financeiro_areas")
      .select("*")
      .order("ordem", { ascending: true });

    if (error) throw error;
    return data ?? [];
  });

export const createFinanceiroArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ nome: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nomeTrimmed = data.nome.trim();

    const { data: existing } = await supabaseAdmin
      .from("financeiro_areas")
      .select("id")
      .ilike("nome", nomeTrimmed)
      .maybeSingle();

    if (existing) {
      throw new Error(`A área "${nomeTrimmed}" já existe.`);
    }

    const { data: allAreas } = await supabaseAdmin
      .from("financeiro_areas")
      .select("ordem");

    const maxOrdem = (allAreas ?? []).reduce((max, a) => Math.max(max, a.ordem), 0);

    const { data: created, error } = await supabaseAdmin
      .from("financeiro_areas")
      .insert({
        nome: nomeTrimmed,
        ordem: maxOrdem + 1,
        ativo: true,
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  });

export const deactivateFinanceiroArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("financeiro_areas")
      .update({ ativo: false })
      .eq("id", data.id);

    if (error) throw error;
    return { ok: true };
  });

export const getLancamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ status: z.enum(["pendente", "validado"]) }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: items, error } = await supabaseAdmin
      .from("financeiro_lancamentos")
      .select("*")
      .eq("status", data.status)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false });

    if (error) throw error;
    return items ?? [];
  });

export const importLancamentosLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ jsonText: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let items: any[] = [];
    try {
      const parsed = JSON.parse(data.jsonText);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e: any) {
      return {
        ok: false,
        error: "JSON inválido: " + e.message,
        createdCount: 0,
        supplierSuggestedCount: 0,
        errorCount: 1,
        errors: ["Sintaxe JSON inválida."],
      };
    }

    const { data: fornecedores } = await supabaseAdmin
      .from("fornecedores_conhecidos")
      .select("*");

    const rowsToInsert: any[] = [];
    const errors: string[] = [];
    let supplierSuggestedCount = 0;

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const idxStr = `Item #${index + 1}`;

      if (!item || typeof item !== "object") {
        errors.push(`${idxStr}: Elemento inválido no array.`);
        continue;
      }

      const itemData = item.data ? String(item.data).trim() : "";
      const itemCompetencia = item.competencia ? String(item.competencia).trim() : "";
      const itemEmpresa = item.empresa ? String(item.empresa).trim() : "";
      const itemValorRaw = item.valor !== undefined && item.valor !== null ? Number(item.valor) : NaN;
      const itemValorTotalRaw = item.valor_total !== undefined && item.valor_total !== null ? Number(item.valor_total) : itemValorRaw;

      if (!itemData || !itemCompetencia || !itemEmpresa || isNaN(itemValorRaw) || isNaN(itemValorTotalRaw)) {
        const missing = [];
        if (!itemData) missing.push("data");
        if (!itemCompetencia) missing.push("competencia");
        if (!itemEmpresa) missing.push("empresa");
        if (isNaN(itemValorRaw)) missing.push("valor");
        if (isNaN(itemValorTotalRaw)) missing.push("valor_total");
        errors.push(`${idxStr} (${itemEmpresa || "Empresa não informada"}): Faltam campos obrigatórios: ${missing.join(", ")}`);
        continue;
      }

      let categoria = item.categoria ? String(item.categoria).trim() : null;
      let area = item.area ? String(item.area).trim() : null;
      let responsavel = item.responsavel ? String(item.responsavel).trim() : null;
      let fixo_variavel = item.fixo_variavel ? String(item.fixo_variavel).trim() : null;
      let carne_leao = item.carne_leao ? String(item.carne_leao).trim() : null;
      let divide = item.divide ? String(item.divide).trim() : null;

      const fMatch = (fornecedores ?? []).find(
        (f) => f.padrao_nome && f.padrao_nome.trim().toLowerCase() === itemEmpresa.toLowerCase()
      );

      if (fMatch) {
        let suggested = false;
        if (!categoria && fMatch.categoria) { categoria = fMatch.categoria; suggested = true; }
        if (!area && fMatch.area) { area = fMatch.area; suggested = true; }
        if (!responsavel && fMatch.responsavel) { responsavel = fMatch.responsavel; suggested = true; }
        if (!fixo_variavel && fMatch.fixo_variavel) { fixo_variavel = fMatch.fixo_variavel; suggested = true; }
        if (!carne_leao && fMatch.carne_leao) { carne_leao = fMatch.carne_leao; suggested = true; }
        if (!divide && fMatch.divide) { divide = fMatch.divide; suggested = true; }
        if (suggested) supplierSuggestedCount++;
      }

      const parcelasTotais = Math.max(1, parseInt(item.parcelas_totais, 10) || 1);
      const compraId = crypto.randomUUID();
      const valorTotal = itemValorTotalRaw;
      const baseValor = Math.round((valorTotal / parcelasTotais) * 100) / 100;

      for (let p = 1; p <= parcelasTotais; p++) {
        const parcelaValor =
          p === parcelasTotais
            ? Math.round((valorTotal - baseValor * (parcelasTotais - 1)) * 100) / 100
            : baseValor;

        const parcelaCompetencia = addMonthsToCompetencia(itemCompetencia, p - 1);
        const parcelaData = addMonthsToDateString(itemData, p - 1);

        rowsToInsert.push({
          compra_id: compraId,
          data: parcelaData,
          competencia: parcelaCompetencia,
          empresa: itemEmpresa,
          descricao: item.descricao ? String(item.descricao).trim() : null,
          categoria,
          area,
          valor: parcelaValor,
          pago: Boolean(item.pago),
          forma_pagamento: item.forma_pagamento ? String(item.forma_pagamento).trim() : null,
          responsavel,
          fixo_variavel,
          carne_leao,
          observacao: item.observacao ? String(item.observacao).trim() : null,
          divide,
          parcelas_totais: parcelasTotais,
          parcela_atual: p,
          valor_total: valorTotal,
          status: "pendente",
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("financeiro_lancamentos")
        .insert(rowsToInsert);

      if (insertErr) {
        throw new Error("Erro ao inserir lançamentos: " + insertErr.message);
      }
    }

    return {
      ok: true,
      createdCount: rowsToInsert.length,
      supplierSuggestedCount,
      errorCount: errors.length,
      errors,
    };
  });

export const updateLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        changes: z.record(z.unknown()),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("financeiro_lancamentos")
      .update(data.changes as any)
      .eq("id", data.id);

    if (error) throw error;
    return { ok: true };
  });

export const deleteLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("financeiro_lancamentos")
      .delete()
      .eq("id", data.id);

    if (error) throw error;
    return { ok: true };
  });

export const validarLancamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ ids: z.array(z.string().min(1)).min(1) }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const { data: updatedRows, error: updateErr } = await supabaseAdmin
      .from("financeiro_lancamentos")
      .update({
        status: "validado",
        validado_em: nowIso,
      })
      .in("id", data.ids)
      .select("*");

    if (updateErr) throw updateErr;

    // Supplier Learning (Upsert into fornecedores_conhecidos) once per compra_id
    const processedCompraIds = new Set<string>();

    for (const row of updatedRows ?? []) {
      if (!row.empresa) continue;
      const key = row.compra_id || row.id;

      if (processedCompraIds.has(key)) continue;
      processedCompraIds.add(key);

      const padraoNome = row.empresa.trim();

      const { data: existing } = await supabaseAdmin
        .from("fornecedores_conhecidos")
        .select("id")
        .ilike("padrao_nome", padraoNome)
        .maybeSingle();

      const supplierFields = {
        padrao_nome: padraoNome,
        categoria: row.categoria || null,
        area: row.area || null,
        responsavel: row.responsavel || null,
        fixo_variavel: row.fixo_variavel || null,
        carne_leao: row.carne_leao || null,
        divide: row.divide || null,
        atualizado_em: nowIso,
      };

      if (existing) {
        await supabaseAdmin
          .from("fornecedores_conhecidos")
          .update(supplierFields)
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("fornecedores_conhecidos")
          .insert(supplierFields);
      }
    }

    return { ok: true, validatedCount: updatedRows?.length ?? 0 };
  });

export const voltarParaPendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ ids: z.array(z.string().min(1)).min(1) }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("financeiro_lancamentos")
      .update({
        status: "pendente",
        validado_em: null,
      })
      .in("id", data.ids);

    if (error) throw error;
    return { ok: true };
  });

export const getFornecedoresConhecidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("fornecedores_conhecidos")
      .select("*")
      .order("padrao_nome", { ascending: true });

    if (error) throw error;
    return data ?? [];
  });

export const getDashboardLancamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("financeiro_lancamentos")
      .select("*")
      .eq("status", "validado");

    if (error) throw error;
    return data ?? [];
  });
