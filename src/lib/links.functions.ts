import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getLinksByArea, createLink, deleteLink } from "./links.server";
import { type AreaValue } from "./areas";

export const getLinks = createServerFn({ method: "GET" })
  .input(z.object({ area: z.string() }))
  .handler(async ({ input }) => {
    return getLinksByArea(input.area as AreaValue);
  });

export const addLink = createServerFn({ method: "POST" })
  .input(
    z.object({
      area: z.string(),
      titulo: z.string().min(1, "Título é obrigatório"),
      url: z.string().url("URL inválida").startsWith("http", "URL deve começar com http:// ou https://"),
    })
  )
  .handler(async ({ input }) => {
    return createLink(input.area as AreaValue, input.titulo, input.url);
  });

export const removeLink = createServerFn({ method: "POST" })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    return deleteLink(input.id);
  });
