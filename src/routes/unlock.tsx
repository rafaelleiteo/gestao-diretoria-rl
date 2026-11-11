import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getUnlockStatus } from "@/lib/gate.functions";
import { supabase } from "@/integrations/supabase/client";
import { processOAuthUserAccess } from "@/lib/auth-gate";

export const Route = createFileRoute("/unlock")({
  head: () => ({
    meta: [
      { title: "Acesso — Diretoria Geral" },
      { name: "description", content: "Área restrita. Faça login para continuar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await getUnlockStatus();
    if (unlocked) throw redirect({ to: "/" });
  },
  component: UnlockPage,
});

function UnlockPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (user) {
        const result = await processOAuthUserAccess(user);
        if (!active) return;

        if (result.success) {
          await router.invalidate();
          await router.navigate({ to: "/" });
        } else {
          setErrorMessage(result.error);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleGoogleLogin() {
    setErrorMessage(null);
    setLoading(true);

    const redirectUrl = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error("Erro ao iniciar login com Google:", error);
      setErrorMessage(error.message);
      setLoading(false);
    }
  }

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
          className="text-2xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          Diretoria Geral
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
          Área restrita. Faça login para continuar.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left">
            <p className="text-[13px] font-medium text-red-700">{errorMessage}</p>
          </div>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-full border bg-white px-5 text-[14px] font-semibold transition-all hover:bg-gray-50 focus:outline-none disabled:opacity-50"
            style={{ borderColor: "#D1D5DB", color: "#1F2937" }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.15C3.25 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.28C.46 8.2.01 10.04.01 12c0 1.96.45 3.8 1.27 5.42l4-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.58l4 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            {loading ? "Verificando acesso..." : "Continuar com Google"}
          </button>
        </div>
      </div>
    </div>
  );
}
