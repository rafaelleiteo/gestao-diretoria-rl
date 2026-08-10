import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Diretoria Geral" },
      { name: "description", content: "Defina uma nova senha para sua conta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.navigate({ to: "/unlock" });
      }, 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border bg-white p-8"
        style={{ borderColor: "#EDEDED" }}
      >
        <h1 className="text-2xl font-bold" style={{ color: "#111111", letterSpacing: "-0.02em" }}>
          Nova senha
        </h1>

        {done ? (
          <p className="mt-3 text-[13px]" style={{ color: "#111111" }}>
            Senha redefinida com sucesso. Redirecionando para o login...
          </p>
        ) : (
          <>
            <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
              {ready
                ? "Defina sua nova senha de acesso."
                : "Abra esta página pelo link recebido por e-mail para redefinir sua senha."}
            </p>

            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>
                  Nova senha
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] outline-none focus:border-[#4F46E5]"
                  style={{ borderColor: "#EDEDED", color: "#111111" }}
                  required
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>
                  Confirmar nova senha
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] outline-none focus:border-[#4F46E5]"
                  style={{ borderColor: "#EDEDED", color: "#111111" }}
                  required
                />
              </label>

              {error && (
                <p className="text-[12px]" style={{ color: "#B45309" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !ready || !password || !confirm}
                className="mt-2 h-10 rounded-full text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "#4F46E5" }}
              >
                {loading ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
