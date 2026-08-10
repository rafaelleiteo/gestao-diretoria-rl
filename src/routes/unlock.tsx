import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getUnlockStatus, unlockSite } from "@/lib/gate.functions";
import { supabase } from "@/integrations/supabase/client";

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
  const unlock = useServerFn(unlockSite);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  async function onReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResetMsg(null);
    setResetErr(null);
    setResetLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        setResetErr(resetError.message);
        return;
      }
      setResetMsg("Enviamos um link de redefinição para o seu e-mail.");
    } catch (err) {
      setResetErr(err instanceof Error ? err.message : "Falha ao enviar o e-mail.");
    } finally {
      setResetLoading(false);
    }
  }


  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      const { ok } = await unlock({ data: { username, password } });
      if (ok) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: "rafael@example.com",
          password,
        });
        if (authError) {
          console.error("Falha ao autenticar o perfil do administrador", authError);
          setError(true);
          return;
        }
        await router.invalidate();
        await router.navigate({ to: "/" });
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border bg-white p-8"
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

        <div className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>
              Usuário
            </span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>
              Senha
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
              required
            />
          </label>

          {error && (
            <p className="text-[12px]" style={{ color: "#B45309" }}>
              Usuário ou senha incorretos.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="mt-2 h-10 rounded-full text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "#4F46E5" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            onClick={() => setShowReset((v) => !v)}
            className="mt-1 text-[12px] underline"
            style={{ color: "#6B7280" }}
          >
            Esqueci minha senha
          </button>
        </div>
      </form>

      {showReset && (
        <form
          onSubmit={onReset}
          className="mt-3 w-full max-w-sm rounded-2xl border bg-white p-6"
          style={{ borderColor: "#EDEDED" }}
        >
          <p className="text-[13px] font-semibold" style={{ color: "#111111" }}>
            Redefinir senha
          </p>
          <label className="mt-3 flex flex-col gap-1">
            <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>
              E-mail
            </span>
            <input
              type="email"
              autoComplete="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
              required
            />
          </label>

          {resetErr && (
            <p className="mt-2 text-[12px]" style={{ color: "#B45309" }}>
              {resetErr}
            </p>
          )}
          {resetMsg && (
            <p className="mt-2 text-[12px]" style={{ color: "#111111" }}>
              {resetMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={resetLoading || !resetEmail}
            className="mt-3 h-10 w-full rounded-full text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "#4F46E5" }}
          >
            {resetLoading ? "Enviando..." : "Enviar link de redefinição"}
          </button>
        </form>
      )}

    </div>
  );
}
