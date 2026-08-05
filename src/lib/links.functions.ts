import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getLinksByArea, createLink, deleteLink } from "./links.server";
import { type AreaValue } from "./areas";

export const getLinks = createServerFn({ method: "GET" })
  .inputValidator((data: { area: string }) => data)
  .handler(async ({ data }) => {
    return getLinksByArea(data.area as AreaValue);
  });

export const addLink = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      area: z.string(),
      titulo: z.string().min(1, "Título é obrigatório"),
      url: z.string().url("URL inválida").startsWith("http", "URL deve começar com http:// ou https://"),
    }).parse
  )
  .handler(async ({ data }) => {
    return createLink(data.area as AreaValue, data.titulo, data.url);
  });

export const removeLink = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return deleteLink(data.id);
  });
