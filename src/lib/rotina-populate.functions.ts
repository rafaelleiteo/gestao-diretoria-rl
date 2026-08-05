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

    // 2. Insert new records
    if (data.cards && data.cards.length > 0) {
      const { error: insError } = await supabaseAdmin
        .from("rotina_cards")
        .insert(data.cards as any);
      if (insError) throw insError;
    }
    
    return { success: true };
  });
