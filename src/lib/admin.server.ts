// Somente servidor. Nao importe em componentes nem em rotas.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Confere no servidor se o usuario logado (context.userId, validado pelo
// requireSupabaseAuth) tem role 'admin' em public.profiles. Lanca erro se nao tiver.
// Usa o supabaseAdmin SOMENTE para ler o role do proprio usuario (mesmo padrao de getCurrentUser).
export async function exigirAdmin(context: { userId: string }): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar o acesso.");
  if (!data || data.role !== "admin") {
    throw new Error("Acesso restrito a administradores");
  }
}
