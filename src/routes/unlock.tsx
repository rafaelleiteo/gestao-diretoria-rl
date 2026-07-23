import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getUnlockStatus, unlockSite } from "@/lib/gate.functions";

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      const { ok } = await unlock({ data: { username, password } });
      if (ok) {
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
        </div>
      </form>
    </div>
  );
}
