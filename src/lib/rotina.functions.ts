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
  .input(z.object({
    id: z.string().optional(),
    ...cardSchema.shape
  }))
  .handler(async ({ data }) => {
    const { id, ...payload } = data;
    if (id) {
      const { data: updated, error } = await supabaseAdmin
        .from("rotina_cards")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("rotina_cards")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return inserted;
    }
  });

export const deleteRotinaCard = createServerFn({ method: "POST" })
  .input(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("rotina_cards")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const batchUpdateRotinaCards = createServerFn({ method: "POST" })
  .input(z.array(z.object({
    id: z.string(),
    tab: z.string(),
    coluna: z.string(),
    ordem: z.number(),
    concluido: z.boolean().optional(),
  })))
  .handler(async ({ data }) => {
    // We use a transaction-like approach by updating each card
    // In a real high-scale app, we'd use a RPC function for bulk upsert
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
  .input(z.object({ 
    tab: z.string().optional(),
    dia: z.string().optional() 
  }))
  .handler(async ({ data }) => {
    // This will be implemented to seed default data for a specific tab or day
    // For now, let's just clear and we'll handle the logic in the component/helper
    let query = supabaseAdmin.from("rotina_cards").delete();
    if (data.tab) query = query.eq("tab", data.tab);
    if (data.dia) query = query.eq("coluna", data.dia);
    
    const { error } = await query;
    if (error) throw error;
    return { success: true };
  });
