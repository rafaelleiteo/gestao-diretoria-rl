import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const populateRotinaDefaults = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { cards: any[] } }) => {
    // 1. Delete all existing records
    const { error: delError } = await supabaseAdmin
      .from("rotina_cards")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Match all

    if (delError) throw delError;

    // 2. Insert new records
    if (data.cards && data.cards.length > 0) {
      const { error: insError } = await supabaseAdmin
        .from("rotina_cards")
        .insert(data.cards.map(c => ({
          tab: c.tab,
          coluna: c.coluna,
          area: c.area,
          tipo_linha: c.tipo_linha,
          texto: c.texto,
          concluido: c.concluido,
          ordem: c.ordem
        })));
      if (insError) throw insError;
    }
    
    return { success: true };
  });
