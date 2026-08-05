import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const cardSchema = z.object({
  tab: z.enum(['distribuir', 'descarga', 'rotina_padrao', 'semana_1', 'semana_2', 'semana_3', 'semana_4']),
  coluna: z.string(),
  area: z.string().nullable(),
  tipo_linha: z.enum(['card', 'divisor']),
  texto: z.string(),
  concluido: z.boolean(),
  ordem: z.number(),
});

export const getRotinaCards = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("rotina_cards")
      .select("*")
      .order("ordem", { ascending: true });
    
    if (error) throw error;
    return data;
  });

export const saveRotinaCard = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    id: z.string().optional(),
    ...cardSchema.shape
  }).parse(data))
  .handler(async ({ data }) => {
    const { id, ...payload } = data;
    if (id) {
      const { data: updated, error } = await supabaseAdmin
        .from("rotina_cards")
        .update(payload as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("rotina_cards")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return inserted;
    }
  });

export const deleteRotinaCard = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("rotina_cards")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const batchUpdateRotinaCards = createServerFn({ method: "POST" })
  .validator((data: any) => z.array(z.object({
    id: z.string(),
    tab: z.string(),
    coluna: z.string(),
    ordem: z.number(),
    concluido: z.boolean().optional(),
  })).parse(data))
  .handler(async ({ data }) => {
    for (const card of data) {
      await supabaseAdmin
        .from("rotina_cards")
        .update({
          tab: card.tab as any,
          coluna: card.coluna,
          ordem: card.ordem,
          ...(card.concluido !== undefined ? { concluido: card.concluido } : {})
        })
        .eq("id", card.id);
    }
    return { success: true };
  });

export const restoreDefaultRotina = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({ 
    tab: z.string().optional(),
    dia: z.string().optional(),
    all: z.boolean().optional(),
    cards: z.array(z.any())
  }).parse(data))
  .handler(async ({ data }) => {
    let query = supabaseAdmin.from("rotina_cards").delete();
    
    if (data.all) {
      // Delete everything
      query = query.not("id", "is", null);
    } else {
      if (data.tab) query = query.eq("tab", data.tab);
      if (data.dia) query = query.eq("coluna", data.dia);
    }
    
    const { error: delError } = await query;
    if (delError) throw delError;

    if (data.cards && data.cards.length > 0) {
      // Batch insert in chunks of 50 to avoid payload limits
      const batchSize = 50;
      for (let i = 0; i < data.cards.length; i += batchSize) {
        const batch = data.cards.slice(i, i + batchSize);
        const { error: insError } = await supabaseAdmin
          .from("rotina_cards")
          .insert(batch);
        if (insError) throw insError;
      }
    }
    
    return { success: true };
  });
