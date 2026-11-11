import { supabase } from "@/integrations/supabase/client";
import { lockSite, unlockSite } from "@/lib/gate.functions";
import { verifyAndRegisterOAuthAccess } from "@/lib/auth.functions";
import type { User } from "@supabase/supabase-js";

export type AuthGateResult =
  | { success: true }
  | { success: false; error: string };

export async function processOAuthUserAccess(user: User): Promise<AuthGateResult> {
  const email = user.email?.trim().toLowerCase();
  console.log("[LOG_DIAGNOSTICO] 1. Usuário Autenticado via Google OAuth:");
  console.log("[LOG_DIAGNOSTICO]   - User ID:", user.id);
  console.log("[LOG_DIAGNOSTICO]   - E-mail recebido:", email);
  console.log("[LOG_DIAGNOSTICO]   - Metadata:", user.user_metadata);

  if (!email) {
    console.error("[LOG_DIAGNOSTICO] ERRO: E-mail não fornecido pelo Google OAuth.");
    await supabase.auth.signOut();
    await lockSite();
    return {
      success: false,
      error: "Seu e-mail não foi fornecido na autenticação do Google.",
    };
  }

  try {
    const googleName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      undefined;

    console.log("[LOG_DIAGNOSTICO] 2. Chamando verifyAndRegisterOAuthAccess (Server Function)...");

    const res = await verifyAndRegisterOAuthAccess({
      data: {
        userId: user.id,
        email,
        googleName,
      },
    });

    console.log("[LOG_DIAGNOSTICO] 5. Resultado final retornado por verifyAndRegisterOAuthAccess:", res);

    if (res.success) {
      console.log("[LOG_DIAGNOSTICO]   - Acesso PERMITIDO. Desbloqueando site...");
      await unlockSite();
      return { success: true };
    } else {
      console.warn("[LOG_DIAGNOSTICO]   - Acesso NEGADO. Efetuando signOut e lockSite...");
      await supabase.auth.signOut();
      await lockSite();
      return {
        success: false,
        error: res.error || "Acesso não autorizado.",
      };
    }
  } catch (err) {
    console.error("[LOG_DIAGNOSTICO] EXCEÇÃO em processOAuthUserAccess:", err);
    await supabase.auth.signOut();
    await lockSite();
    return {
      success: false,
      error: "Erro ao verificar credenciais. Tente novamente.",
    };
  }
}
