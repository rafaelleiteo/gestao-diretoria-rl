import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const populateRotinaDefaults = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    cards: z.array(z.any())
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Delete all existing records
    const { error: delError } = await supabaseAdmin
      .from("rotina_cards")
      .delete()
      .not("id", "is", null);

    if (delError) throw delError;

    // 2. Insert new records in batches
    if (data.cards && data.cards.length > 0) {
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
