import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const populateRotinaDefaults = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    cards: z.array(z.object({
      tab: z.string(),
      coluna: z.string(),
      area: z.string().nullable(),
      tipo_linha: z.string(),
      texto: z.string(),
      concluido: z.boolean(),
      ordem: z.number()
    }))
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Delete all existing records
    const { error: delError } = await supabaseAdmin
      .from("rotina_cards")
      .delete()
      .not("id", "is", null); // Correct way to match all rows

    if (delError) throw delError;

    // 2. Insert new records
    if (data.cards && data.cards.length > 0) {
      const { error: insError } = await supabaseAdmin
        .from("rotina_cards")
        .insert(data.cards);
      if (insError) throw insError;
    }
    
    return { success: true };
  });
