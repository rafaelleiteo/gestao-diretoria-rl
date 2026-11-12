import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirAdmin } from "@/lib/admin.server";
import { getLinksByArea, createLink, deleteLink } from "./links.server";
import { type AreaValue } from "./areas";

// Seguranca: toda funcao exige login (requireSupabaseAuth) e admin (exigirAdmin).
// O acesso a links_rapidos usa o cliente do usuario (context.supabase), entao a RLS vale.

export const getLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { area: string }) => data)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    return getLinksByArea(context.supabase, data.area as AreaValue);
  });

export const addLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      area: z.string(),
      titulo: z.string().min(1, "Título é obrigatório"),
      url: z.string().url("URL inválida").startsWith("http", "URL deve começar com http:// ou https://"),
    }).parse
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    return createLink(context.supabase, data.area as AreaValue, data.titulo, data.url);
  });

export const removeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    return deleteLink(context.supabase, data.id);
  });
