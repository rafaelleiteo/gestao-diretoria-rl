import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { processOAuthUserAccess } from "@/lib/auth-gate";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Autenticando — Diretoria Geral" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      try {
        if (typeof window === "undefined") return;

        console.log("[DIAG] === INÍCIO DO CALLBACK OAUTH ===");
        console.log("[DIAG] URL completa:", window.location.href);
        console.log("[DIAG] Search params:", window.location.search);
        console.log("[DIAG] Hash params:", window.location.hash);

        // 1. Check for error in query or hash
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const errorDesc =
          searchParams.get("error_description") ||
          hashParams.get("error_description") ||
          searchParams.get("error") ||
          hashParams.get("error");

        if (errorDesc) {
          console.error("[DIAG] OAuth error_description/error encontrado na URL:", errorDesc);
          if (active) setErrorMessage(`Erro no login Google: ${errorDesc}`);
          return;
        }

        // 2. Check if PKCE code is in query string
        const code = searchParams.get("code");
        console.log("[DIAG] Parâmetro 'code' extraído da URL:", code ? `${code.substring(0, 10)}... (tamanho: ${code.length})` : "NULL");

        if (code) {
          console.log("[DIAG] Chamando supabase.auth.exchangeCodeForSession(code)...");
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          console.log("[DIAG] Resultado exchangeCodeForSession -> data:", exchangeData, "| error:", exchangeError);

          if (exchangeError) {
            console.error("[DIAG] Erro ao trocar código PKCE:", exchangeError.message, exchangeError);
            if (active) setErrorMessage(`Falha ao confirmar autenticação: ${exchangeError.message}`);
            return;
          }

          if (exchangeData.session?.user) {
            console.log("[DIAG] Usuário obtido via exchangeCodeForSession:", exchangeData.session.user.email, exchangeData.session.user.id);
            const result = await processOAuthUserAccess(exchangeData.session.user);
            console.log("[DIAG] Resultado processOAuthUserAccess:", result);
            if (!active) return;
            if (result.success) {
              await router.invalidate();
              await router.navigate({ to: "/" });
              return;
            } else {
              setErrorMessage(result.error);
              return;
            }
          }
        }

        // 2.5 Check if implicit flow tokens (access_token & refresh_token) exist in hash string
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        console.log("[DIAG] Parâmetro 'access_token' no hash:", accessToken ? "PRESENT" : "NULL");

        if (accessToken) {
          console.log("[DIAG] Chamando supabase.auth.setSession({ access_token, refresh_token })...");
          const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          });
          console.log("[DIAG] Resultado setSession -> data:", setSessionData, "| error:", setSessionError);

          if (setSessionError) {
            console.error("[DIAG] Erro no setSession:", setSessionError.message, setSessionError);
            if (active) setErrorMessage(`Falha ao confirmar autenticação: ${setSessionError.message}`);
            return;
          }

          if (setSessionData.session?.user) {
            console.log("[DIAG] Usuário obtido via setSession:", setSessionData.session.user.email, setSessionData.session.user.id);
            const result = await processOAuthUserAccess(setSessionData.session.user);
            console.log("[DIAG] Resultado processOAuthUserAccess (setSession):", result);
            if (!active) return;
            if (result.success) {
              await router.invalidate();
              await router.navigate({ to: "/" });
              return;
            } else {
              setErrorMessage(result.error);
              return;
            }
          }
        }

        // 3. Check existing session with getSession()
        console.log("[DIAG] Chamando supabase.auth.getSession()...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log("[DIAG] Resultado getSession() -> session:", session ? { user: session.user.email, id: session.user.id } : "NULL", "| error:", sessionError);

        if (sessionError) {
          console.error("[DIAG] Erro em getSession():", sessionError.message, sessionError);
          if (active) setErrorMessage("Erro ao verificar sessão do usuário.");
          return;
        }

        if (session?.user) {
          console.log("[DIAG] Usuário obtido via getSession():", session.user.email, session.user.id);
          const result = await processOAuthUserAccess(session.user);
          console.log("[DIAG] Resultado processOAuthUserAccess (getSession):", result);
          if (!active) return;
          if (result.success) {
            await router.invalidate();
            await router.navigate({ to: "/" });
            return;
          } else {
            setErrorMessage(result.error);
            return;
          }
        }

        // 4. Listen for auth state change if session is being processed asynchronously
        console.log("[DIAG] Inscrevendo em supabase.auth.onAuthStateChange...");
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          console.log("[DIAG] Evento onAuthStateChange recebido -> event:", event, "| session:", currentSession ? currentSession.user.email : "NULL");
          if (currentSession?.user && active) {
            subscription.unsubscribe();
            const result = await processOAuthUserAccess(currentSession.user);
            console.log("[DIAG] Resultado processOAuthUserAccess (onAuthStateChange):", result);
            if (!active) return;
            if (result.success) {
              await router.invalidate();
              await router.navigate({ to: "/" });
            } else {
              setErrorMessage(result.error);
            }
          }
        });

        // 5. Fallback timeout after 8 seconds
        setTimeout(() => {
          if (active && !session?.user) {
            console.warn("[DIAG] TIMEOUT 8s atingido sem encontrar sessão ativa!");
            subscription.unsubscribe();
            setErrorMessage("Sessão não encontrada após o login. Tente fazer login novamente.");
          }
        }, 8000);
      } catch (err) {
        console.error("[DIAG] Exceção não tratada no callback:", err);
        if (active) setErrorMessage("Erro inesperado durante a autenticação.");
      }
    }

    handleCallback();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm text-center"
        style={{ borderColor: "#EDEDED" }}
      >
        <h1
          className="text-xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          {errorMessage ? "Acesso Restrito" : "Diretoria Geral"}
        </h1>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-left">
            <p className="text-[13px] font-medium text-red-700">{errorMessage}</p>
            <a
              href="/unlock"
              className="mt-4 inline-block rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-red-700"
            >
              Voltar ao Login
            </a>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-[13px]" style={{ color: "#6B7280" }}>
              Verificando permissões do seu perfil Google...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
