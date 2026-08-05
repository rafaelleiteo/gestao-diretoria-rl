import { supabase } from "@/integrations/supabase/client";
import { type AreaValue } from "./areas";

export type LinkRapido = {
  id: string;
  area: string;
  titulo: string;
  url: string;
  criado_em: string;
};

export async function getLinksByArea(area: AreaValue) {
  const { data, error } = await supabase
    .from("links_rapidos")
    .select("*")
    .eq("area", area)
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return data as LinkRapido[];
}

export async function createLink(area: AreaValue, titulo: string, url: string) {
  const { data, error } = await supabase
    .from("links_rapidos")
    .insert([{ area, titulo, url }])
    .select()
    .single();

  if (error) throw error;
  return data as LinkRapido;
}

export async function deleteLink(id: string) {
  const { error } = await supabase.from("links_rapidos").delete().eq("id", id);
  if (error) throw error;
  return true;
}
